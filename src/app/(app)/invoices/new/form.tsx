'use client';
import Link from 'next/link';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { LineItems, type SvcOpt } from '@/components/line-items';
import { createInvoiceAction } from '../actions';

export function InvoiceForm({ bookingId, items, discount, gst, gstRate, gstAllowed, services, today, guests }: {
  bookingId: string; items: { desc: string; qty: number; rate: number }[]; discount: number; gst: boolean; gstRate: number; gstAllowed: boolean; services: SvcOpt[]; today: string; guests: number;
}) {
  const { state, action, onSubmit, pending } = useFormAction(createInvoiceAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="body">
        <FormMessage state={state} />
        <div className="panel"><div className="panel-b grid3">
          <Field label="Invoice date" htmlFor="issuedOn" error={fe.issuedOn} required><input id="issuedOn" name="issuedOn" type="date" className="input" defaultValue={today} /></Field>
        </div></div>
        <LineItems initial={items} services={services} guests={guests} discount={discount} gst={gst} gstRate={gstRate} gstAllowed={gstAllowed} error={fe.items} />
        <div className="panel"><div className="panel-b"><Field label="Notes on the invoice" htmlFor="notes"><textarea id="notes" name="notes" rows={2} className="input" /></Field></div></div>
      </div>
      <div className="formfoot" style={{ position: 'sticky', bottom: 0 }}><SubmitButton pending={pending} pendingText="Creating…">Create invoice</SubmitButton><Link className="btn" href={`/bookings/${bookingId}`}>Cancel</Link></div>
    </form>
  );
}
