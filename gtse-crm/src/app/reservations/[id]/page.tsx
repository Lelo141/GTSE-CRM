import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { CrmHeader } from '@/components/crm-header';
import {
  updateBookingAction,
  touchBookingAction,
  addSupplierCostAction,
  deleteSupplierCostAction,
} from '../actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
});

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile, supabase } = await requireRole(['reservations', 'admin']);
  const { id } = await params;

  const [{ data: booking }, { data: staff }, { data: suppliers }] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        *,
        organizations ( name, country, city_state ),
        sports_events ( name, venue, start_date ),
        booking_supplier_costs (
          id, service_type, service_dates, confirmation_ref, confirmation_status, net_cost, internal_notes,
          supplier:organizations!supplier_org_id ( name )
        )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['reservations', 'admin'])
      .order('full_name'),
    supabase
      .from('organizations')
      .select('id, name')
      .eq('type', 'supplier')
      .order('name'),
  ]);

  if (!booking) notFound();

  const costs = booking.booking_supplier_costs || [];
  const totalSupplierCost = costs.reduce(
    (sum: number, c: { net_cost: number }) => sum + Number(c.net_cost || 0),
    0
  );
  const revenue = Number(booking.client_price || 0);
  const grossProfit = revenue - totalSupplierCost;
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmHeader fullName={profile.full_name} role={profile.role} />

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/reservations" className="text-sm text-slate-500 hover:underline">
              &larr; Back to Reservations Log
            </Link>
            <h1 className="mt-1 text-2xl font-bold">
              Booking #{booking.inquiry_number} &mdash; {booking.organizations?.name}
            </h1>
            <p className="text-sm text-slate-600">
              {booking.sports_events?.name || booking.destination_city} &bull;{' '}
              <span className="uppercase">{booking.category}</span> ({booking.participant_count} pax)
            </p>
          </div>

          <form action={touchBookingAction.bind(null, booking.id)}>
            <Button type="submit" variant="outline">
              Log Check-In (Reset Last Touched)
            </Button>
          </form>
        </div>

        {/* Live Financial Rollup */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500">Client Price</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-bold">{currency.format(revenue)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500">Total Supplier Cost</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-bold">{currency.format(totalSupplierCost)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500">Gross Profit</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-bold text-emerald-700">
              {currency.format(grossProfit)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500">Gross Margin</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-bold">{marginPct.toFixed(1)}%</CardContent>
          </Card>
        </div>

        {/* Booking Details & Assignment Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking Details &amp; Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateBookingAction} className="grid gap-4 sm:grid-cols-3">
              <input type="hidden" name="id" value={booking.id} />

              <div className="space-y-1">
                <Label htmlFor="reservations_owner_id">Assigned Reservations Owner</Label>
                <select
                  id="reservations_owner_id"
                  name="reservations_owner_id"
                  defaultValue={booking.reservations_owner_id || ''}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {(staff || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="stage">Booking Stage</Label>
                <select
                  id="stage"
                  name="stage"
                  defaultValue={booking.stage}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="new_inquiry">New Inquiry</option>
                  <option value="qualified">Qualified</option>
                  <option value="preparing_experience">Preparing Experience</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="delivery_stage">Delivery Stage</Label>
                <select
                  id="delivery_stage"
                  name="delivery_stage"
                  defaultValue={booking.delivery_stage || ''}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Not Started</option>
                  <option value="planning">Planning</option>
                  <option value="arrangements_booked">Arrangements Booked</option>
                  <option value="ready_for_travel">Ready for Travel</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="invoice_number">GTSE Invoice #</Label>
                <Input
                  id="invoice_number"
                  name="invoice_number"
                  defaultValue={booking.invoice_number || ''}
                  placeholder="GTSE-2026-001"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="execution_date">Execution / Travel Date</Label>
                <Input
                  id="execution_date"
                  name="execution_date"
                  type="date"
                  defaultValue={booking.execution_date || ''}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="participant_count">Participants (≤9 Leisure / ≥10 M.I.C.E.)</Label>
                <Input
                  id="participant_count"
                  name="participant_count"
                  type="number"
                  min={1}
                  defaultValue={booking.participant_count}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="client_price">Client Price (USD)</Label>
                <Input
                  id="client_price"
                  name="client_price"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={booking.client_price}
                />
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button type="submit">Save Booking Changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Supplier Cost Items (Protected by RLS — hidden from Sales) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier Costs &amp; Trip Arrangements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Confirmation Ref</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Net Cost</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-slate-500">
                      No supplier cost entries yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  costs.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="capitalize font-medium">{c.service_type}</TableCell>
                      <TableCell>{c.supplier?.name || '—'}</TableCell>
                      <TableCell>{c.service_dates || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{c.confirmation_ref || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {c.confirmation_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {currency.format(Number(c.net_cost))}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={deleteSupplierCostAction.bind(null, c.id, booking.id)}>
                          <Button type="submit" size="sm" variant="ghost" className="text-red-600">
                            Remove
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Add Supplier Cost Row */}
            <form
              action={addSupplierCostAction}
              className="grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-6"
            >
              <input type="hidden" name="booking_id" value={booking.id} />

              <div className="space-y-1">
                <Label>Service Type</Label>
                <select
                  name="service_type"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="tickets">Tickets</option>
                  <option value="hotel">Hotel</option>
                  <option value="transportation">Transportation</option>
                  <option value="wellness">Wellness</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>Supplier</Label>
                <select
                  name="supplier_org_id"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">Select supplier...</option>
                  {(suppliers || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Service Dates</Label>
                <Input name="service_dates" placeholder="Oct 22-24" className="bg-white" />
              </div>

              <div className="space-y-1">
                <Label>Conf. Ref</Label>
                <Input name="confirmation_ref" placeholder="REF-123" className="bg-white" />
              </div>

              <div className="space-y-1">
                <Label>Net Cost (USD)</Label>
                <Input
                  name="net_cost"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  className="bg-white"
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Add Cost
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}