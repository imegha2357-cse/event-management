'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { LineItems, type SvcOpt } from '@/components/line-items';
import { saveQuotationAction } from '../actions';

export type QuoteInit = {
  id?: string; bookingId?: string; customerId: string; eventType: string; eventTitle: string; eventDate: string; startTime: string; endTime: string;
  venue: string; guests: number; validUntil: string; discount: number; notes: string; items: { desc: string; qty: number; rate: number }[]; gst: boolean;
};

export function QuoteForm({ init, customers, today, services, eventTypes, gstRate, gstAllowed, linkedTitle }: {
  init: QuoteInit; customers: { id: string; name: string; phone: string }[]; today: string; services: SvcOpt[]; eventTypes: string[]; gstRate: number; gstAllowed: boolean; linkedTitle?: string;
}) {
  const { state, action, onSubmit, pending } = useFormAction(saveQuotationAction);
  const fe = state?.fieldErrors ?? {};
  const [cust, setCust] = useState(init.customerId || (customers.length ? '' : '__new'));
  const [guests, setGuests] = useState(String(init.guests || ''));
  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      {init.id && <input type="hidden" name="rid" value={init.id} />}
      {init.bookingId && <input type="hidden" name="bookingId" value={init.bookingId} />}
      <div className="body">
        <FormMessage state={state} />
        {linkedTitle && <div className="notice">For the enquiry <b>{linkedTitle}</b>. When the customer accepts, that enquiry becomes a confirmed booking.</div>}
        <div className="panel">
          <div className="panel-h"><h2>Customer & event</h2></div>
          <div className="panel-b grid3">
            <Field label="Customer" htmlFor="customerId" error={fe.customerId} required>
              <select id="customerId" name="customerId" className="input" value={cust} onChange={e => setCust(e.target.value)} aria-invalid={!!fe.customerId || undefined}>
                <option value="">Choose a customer…</option>
                <option value="__new">+ New customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
              </select>
            </Field>
            {cust === '__new' ? (<>
              <Field label="New customer name" htmlFor="newName" error={fe.newName} required><input id="newName" name="newName" className="input" placeholder="e.g. Rakesh Sharma" /></Field>
              <Field label="Mobile number (WhatsApp)" htmlFor="newPhone" error={fe.newPhone} required><input id="newPhone" name="newPhone" className="input" inputMode="tel" placeholder="98765 43210" /></Field>
            </>) : <><div /><div /></>}
            <Field label="Event type" htmlFor="eventType" error={fe.eventType} required>
              <select id="eventType" name="eventType" className="input" defaultValue={init.eventType}><option value="">Choose…</option>{eventTypes.map(t => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Event title" htmlFor="eventTitle" error={fe.eventTitle} required><input id="eventTitle" name="eventTitle" className="input" placeholder="e.g. Priya & Arun wedding" defaultValue={init.eventTitle} /></Field>
            <Field label="Event date" htmlFor="eventDate" error={fe.eventDate} required><input id="eventDate" name="eventDate" type="date" min={today} className="input" defaultValue={init.eventDate} /></Field>
            <div className="grid2" style={{ gap: 8 }}>
              <Field label="Start time" htmlFor="startTime" error={fe.startTime}><input id="startTime" name="startTime" type="time" className="input" defaultValue={init.startTime} /></Field>
              <Field label="End time" htmlFor="endTime" error={fe.endTime}><input id="endTime" name="endTime" type="time" className="input" defaultValue={init.endTime} /></Field>
            </div>
            <Field label="Guests" htmlFor="guests" error={fe.guests}><input id="guests" name="guests" type="number" min={0} className="input" value={guests} onChange={e => setGuests(e.target.value)} /></Field>
            <Field label="Valid until" htmlFor="validUntil" error={fe.validUntil} required><input id="validUntil" name="validUntil" type="date" min={today} className="input" defaultValue={init.validUntil} /></Field>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Venue" htmlFor="venue" error={fe.venue} required><input id="venue" name="venue" className="input" placeholder="Hall name, area, city" defaultValue={init.venue} /></Field></div>
          </div>
        </div>
        <LineItems initial={init.items} services={services} guests={Number(guests) || 0} discount={init.discount} gst={init.gst} gstRate={gstRate} gstAllowed={gstAllowed} error={fe.items} showAdvance />
        <div className="panel"><div className="panel-b">
          <Field label="Notes for the customer" htmlFor="notes" error={fe.notes} hint="Shown on the quotation and in the WhatsApp confirmation."><textarea id="notes" name="notes" rows={3} className="input" defaultValue={init.notes} /></Field>
        </div></div>
      </div>
      <div className="formfoot" style={{ position: 'sticky', bottom: 0 }}>
        <SubmitButton pending={pending} pendingText="Saving…">{init.id ? 'Save changes' : 'Save quotation'}</SubmitButton>
        <Link className="btn" href={init.id ? `/quotations/${init.id}` : '/quotations'}>Cancel</Link>
        <span className="small muted" style={{ alignSelf: 'center' }}>Status: Draft → Sent → Accepted. Accepting creates the booking.</span>
      </div>
    </form>
  );
}
