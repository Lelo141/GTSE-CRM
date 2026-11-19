import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { CrmHeader } from '@/components/crm-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NewBookingModal } from './new-booking-modal';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function daysSince(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const { profile, supabase } = await requireRole(['reservations', 'admin']);
  const params = await searchParams;
  const query = (params.q || '').trim().toLowerCase();
  const stageFilter = params.stage || 'all';

  const [
    { data: bookings, error },
    { data: organizations },
    { data: contacts },
    { data: events },
    { data: staff },
    ] = await Promise.all([
    supabase
        .from('bookings')
        .select(`
        id,
        inquiry_number,
        invoice_number,
        stage,
        delivery_stage,
        execution_date,
        destination_city,
        participant_count,
        category,
        client_price,
        last_touched_at,
        organizations ( name ),
        sports_events ( name ),
        reservations_owner:profiles!reservations_owner_id ( full_name ),
        booking_supplier_costs ( net_cost )
        `)
        .order('created_at', { ascending: false }),
    supabase
        .from('organizations')
        .select('id, name')
        .neq('type', 'supplier')
        .order('name'),
    supabase
        .from('contacts')
        .select('id, organization_id, first_name, last_name')
        .order('first_name'),
    supabase
        .from('sports_events')
        .select('id, name, city, start_date')
        .order('start_date'),
    supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['reservations', 'admin'])
        .order('full_name'),
    ]);

  if (error) {
    throw new Error(`Failed to load bookings: ${error.message}`);
  }

  const enriched = (bookings || []).map((b: any) => {
    const supplierCost = (b.booking_supplier_costs || []).reduce(
      (sum: number, item: { net_cost: number }) => sum + Number(item.net_cost || 0),
      0
    );
    const revenue = Number(b.client_price || 0);
    const grossProfit = revenue - supplierCost;
    const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const staleDays = daysSince(b.last_touched_at);

    return {
      ...b,
      orgName: b.organizations?.name || '—',
      eventName: b.sports_events?.name || b.destination_city || '—',
      ownerName: b.reservations_owner?.full_name || 'Unassigned',
      revenue,
      supplierCost,
      grossProfit,
      marginPct,
      staleDays,
    };
  });

  // Confirmed bookings financial totals (per Section 4.2 rule)
  const confirmed = enriched.filter((b) => b.stage === 'confirmed');
  const totalRevenue = confirmed.reduce((s, b) => s + b.revenue, 0);
  const totalCost = confirmed.reduce((s, b) => s + b.supplierCost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const filtered = enriched.filter((b) => {
    const matchesStage = stageFilter === 'all' || b.stage === stageFilter;
    const matchesQuery =
      !query ||
      b.orgName.toLowerCase().includes(query) ||
      b.eventName.toLowerCase().includes(query) ||
      String(b.inquiry_number).includes(query) ||
      (b.invoice_number || '').toLowerCase().includes(query);
    return matchesStage && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmHeader fullName={profile.full_name} role={profile.role} />

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservations &amp; Booking Log</h1>
            <p className="text-sm text-slate-600">
              Manage assigned bookings, track untouched inquiries, and monitor supplier margins.
            </p>
          </div>
          <NewBookingModal
            organizations={organizations || []}
            contacts={contacts || []}
            events={events || []}
            staff={staff || []}
            currentUserId={profile.id}
            />
        </div>

        {/* Confirmed Financial KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Confirmed Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{confirmed.length}</div>
              <p className="text-xs text-slate-500">{enriched.length} total in log</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Confirmed Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency.format(totalRevenue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Supplier Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency.format(totalCost)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Gross Profit &amp; Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">
                {currency.format(totalProfit)}
              </div>
              <p className="text-xs text-slate-500">{totalMargin.toFixed(1)}% gross margin</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Stage Filter */}
        <form className="flex flex-wrap items-center gap-3">
          <Input
            name="q"
            defaultValue={params.q || ''}
            placeholder="Search agency, event, invoice #..."
            className="max-w-xs bg-white"
          />
          <select
            name="stage"
            defaultValue={stageFilter}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">All Stages</option>
            <option value="new_inquiry">New Inquiry</option>
            <option value="qualified">Qualified</option>
            <option value="preparing_experience">Preparing Experience</option>
            <option value="proposal_sent">Proposal Sent</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="closed_lost">Closed Lost</option>
          </select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>

        {/* Booking Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref / Invoice</TableHead>
                  <TableHead>Agency &amp; Event</TableHead>
                  <TableHead>Pax / Type</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Last Touched</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit (Margin)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                      No bookings match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <div>#{b.inquiry_number}</div>
                        <div className="text-xs text-slate-500">{b.invoice_number || 'No invoice'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{b.orgName}</div>
                        <div className="text-xs text-slate-500">{b.eventName}</div>
                      </TableCell>
                      <TableCell>
                        <span className="mr-2">{b.participant_count}</span>
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {b.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.stage === 'confirmed' ? 'default' : 'secondary'}>
                          {b.stage.replaceAll('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{b.ownerName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            b.staleDays >= 7
                              ? 'destructive'
                              : b.staleDays >= 3
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {b.staleDays === 0 ? 'Today' : `${b.staleDays}d ago`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {currency.format(b.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium text-emerald-700">
                          {currency.format(b.grossProfit)}
                        </div>
                        <div className="text-xs text-slate-500">{b.marginPct.toFixed(1)}%</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                            href={`/reservations/${b.id}`}
                            className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                            Manage
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}