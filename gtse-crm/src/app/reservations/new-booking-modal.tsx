'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDirectBookingAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface OrgOption {
  id: string;
  name: string;
}

interface ContactOption {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
}

interface EventOption {
  id: string;
  name: string;
  city: string | null;
  start_date: string | null;
}

interface StaffOption {
  id: string;
  full_name: string;
}

interface NewBookingModalProps {
  organizations: OrgOption[];
  contacts: ContactOption[];
  events: EventOption[];
  staff: StaffOption[];
  currentUserId: string;
}

export function NewBookingModal({
  organizations,
  contacts,
  events,
  staff,
  currentUserId,
}: NewBookingModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  const [participants, setParticipants] = useState(2);

  const orgContacts = contacts.filter((c) => c.organization_id === selectedOrgId);
  const categoryPreview = participants <= 9 ? 'LEISURE' : 'M.I.C.E.';

  function handleEventChange(eventId: string) {
    const matched = events.find((e) => e.id === eventId);
    if (!matched) return;
    if (matched.city && !destinationCity) setDestinationCity(matched.city);
    if (matched.start_date && !executionDate) setExecutionDate(matched.start_date);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createDirectBookingAction(formData);

    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setOpen(false);
    setSelectedOrgId('');
    setDestinationCity('');
    setExecutionDate('');
    setParticipants(2);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New Direct Booking</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Direct Booking</DialogTitle>
            <DialogDescription>
              Log a direct inquiry or booking. Leisure (≤9 pax) and M.I.C.E. (≥10 pax) classify automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="organization_id">Agency / Client *</Label>
                <select
                  id="organization_id"
                  name="organization_id"
                  required
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Select organization...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="contact_id">Contact</Label>
                <select
                  id="contact_id"
                  name="contact_id"
                  disabled={!selectedOrgId}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100"
                >
                  <option value="">
                    {selectedOrgId ? 'Select contact (optional)...' : 'Choose organization first'}
                  </option>
                  {orgContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="event_id">Sports Event</Label>
                <select
                  id="event_id"
                  name="event_id"
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">None / Custom Trip</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reservations_owner_id">Assigned Owner</Label>
                <select
                  id="reservations_owner_id"
                  name="reservations_owner_id"
                  defaultValue={currentUserId}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="destination_city">Destination City</Label>
                <Input
                  id="destination_city"
                  name="destination_city"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  placeholder="e.g. Austin, London"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="execution_date">Execution / Travel Date</Label>
                <Input
                  id="execution_date"
                  name="execution_date"
                  type="date"
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="participant_count">Participants *</Label>
                  <Badge variant="outline" className="text-[10px]">
                    {categoryPreview}
                  </Badge>
                </div>
                <Input
                  id="participant_count"
                  name="participant_count"
                  type="number"
                  min={1}
                  required
                  value={participants}
                  onChange={(e) => setParticipants(Math.max(1, Number(e.target.value) || 1))}
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
                  defaultValue={0}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="stage">Initial Stage</Label>
                <select
                  id="stage"
                  name="stage"
                  defaultValue="new_inquiry"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="new_inquiry">New Inquiry</option>
                  <option value="qualified">Qualified</option>
                  <option value="preparing_experience">Preparing Experience</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="invoice_number">GTSE Invoice # (Optional)</Label>
                <Input
                  id="invoice_number"
                  name="invoice_number"
                  placeholder="GTSE-2026-002"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="service_description">Service Description</Label>
              <textarea
                id="service_description"
                name="service_description"
                rows={2}
                placeholder="Tickets, hotel nights, airport transfers, hospitality..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Booking'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}