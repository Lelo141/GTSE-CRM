'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';

export async function updateBookingAction(formData: FormData) {
  const { supabase } = await requireRole(['reservations', 'admin']);

  const id = String(formData.get('id'));
  const stage = String(formData.get('stage'));
  const deliveryStageRaw = String(formData.get('delivery_stage') || '');
  const ownerRaw = String(formData.get('reservations_owner_id') || '');
  const invoiceNumber = String(formData.get('invoice_number') || '').trim() || null;
  const executionDate = String(formData.get('execution_date') || '') || null;
  const participantCount = Math.max(1, Number(formData.get('participant_count') || 1));
  const clientPrice = Math.max(0, Number(formData.get('client_price') || 0));

  const updatePayload: Record<string, unknown> = {
    stage,
    delivery_stage: deliveryStageRaw || null,
    reservations_owner_id: ownerRaw || null,
    invoice_number: invoiceNumber,
    execution_date: executionDate,
    participant_count: participantCount,
    client_price: clientPrice,
    last_touched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (stage === 'confirmed') {
    updatePayload.confirmed_date = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/reservations');
  revalidatePath(`/reservations/${id}`);
}

export async function touchBookingAction(bookingId: string) {
  const { supabase } = await requireRole(['reservations', 'admin']);

  const { error } = await supabase
    .from('bookings')
    .update({
      last_touched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (error) throw new Error(error.message);

  revalidatePath('/reservations');
  revalidatePath(`/reservations/${bookingId}`);
}

export async function addSupplierCostAction(formData: FormData) {
  const { supabase } = await requireRole(['reservations', 'admin']);

  const bookingId = String(formData.get('booking_id'));
  const supplierOrgId = String(formData.get('supplier_org_id') || '') || null;
  const serviceType = String(formData.get('service_type'));
  const serviceDates = String(formData.get('service_dates') || '').trim() || null;
  const confirmationRef = String(formData.get('confirmation_ref') || '').trim() || null;
  const confirmationStatus = String(formData.get('confirmation_status') || 'pending');
  const netCost = Math.max(0, Number(formData.get('net_cost') || 0));
  const internalNotes = String(formData.get('internal_notes') || '').trim() || null;

  const { error } = await supabase.from('booking_supplier_costs').insert({
    booking_id: bookingId,
    supplier_org_id: supplierOrgId,
    service_type: serviceType,
    service_dates: serviceDates,
    confirmation_ref: confirmationRef,
    confirmation_status: confirmationStatus,
    net_cost: netCost,
    internal_notes: internalNotes,
  });

  if (error) throw new Error(error.message);

  // Stamp booking accountability timestamp
  await supabase
    .from('bookings')
    .update({ last_touched_at: new Date().toISOString() })
    .eq('id', bookingId);

  revalidatePath('/reservations');
  revalidatePath(`/reservations/${bookingId}`);
}

export async function deleteSupplierCostAction(costId: string, bookingId: string) {
  const { supabase } = await requireRole(['reservations', 'admin']);

  const { error } = await supabase
    .from('booking_supplier_costs')
    .delete()
    .eq('id', costId);

  if (error) throw new Error(error.message);

  revalidatePath('/reservations');
  revalidatePath(`/reservations/${bookingId}`);
}

export async function createDirectBookingAction(formData: FormData) {
  const { supabase } = await requireRole(['reservations', 'admin']);

  const organizationId = String(formData.get('organization_id') || '');
  if (!organizationId) {
    return { error: 'Please select an agency or client organization.' };
  }

  const contactId = String(formData.get('contact_id') || '') || null;
  const eventId = String(formData.get('event_id') || '') || null;
  const ownerId = String(formData.get('reservations_owner_id') || '') || null;
  const stage = String(formData.get('stage') || 'new_inquiry');
  const invoiceNumber = String(formData.get('invoice_number') || '').trim() || null;
  const executionDate = String(formData.get('execution_date') || '') || null;
  const destinationCity = String(formData.get('destination_city') || '').trim() || null;
  const serviceDescription = String(formData.get('service_description') || '').trim() || null;
  const participantCount = Math.max(1, Number(formData.get('participant_count') || 1));
  const clientPrice = Math.max(0, Number(formData.get('client_price') || 0));

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      organization_id: organizationId,
      contact_id: contactId,
      event_id: eventId,
      reservations_owner_id: ownerId,
      stage,
      confirmed_date: stage === 'confirmed' ? new Date().toISOString().slice(0, 10) : null,
      invoice_number: invoiceNumber,
      execution_date: executionDate,
      destination_city: destinationCity,
      service_description: serviceDescription,
      participant_count: participantCount,
      client_price: clientPrice,
      last_touched_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/reservations');
  return { id: data.id };
}