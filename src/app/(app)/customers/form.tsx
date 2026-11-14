'use client';
import Link from 'next/link';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { createCustomerAction, updateCustomerAction } from '../actions';

type C = { id: string; name: string; phone: string; email: string; city: string };
export function CustomerForm({ customer, returnTo }: { customer?: C; returnTo?: string }) {
  const { state, action, onSubmit, pending } = useFormAction(customer ? updateCustomerAction : createCustomerAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} className="panel" noValidate>
      {customer && <input type="hidden" name="rid" value={customer.id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormMessage state={state} />
        <div className="grid2">
          <Field label="Customer name" htmlFor="name" error={fe.name} required><input id="name" name="name" className="input" defaultValue={customer?.name} required aria-invalid={!!fe.name || undefined} /></Field>
          <Field label="Mobile number (WhatsApp)" htmlFor="phone" error={fe.phone} required hint="Booking confirmations are sent to this number.">
            <input id="phone" name="phone" className="input" inputMode="tel" placeholder="98765 43210" defaultValue={customer?.phone} required aria-invalid={!!fe.phone || undefined} /></Field>
          <Field label="Email" htmlFor="email" error={fe.email}><input id="email" name="email" type="email" className="input" defaultValue={customer?.email} aria-invalid={!!fe.email || undefined} /></Field>
          <Field label="City" htmlFor="city" error={fe.city}><input id="city" name="city" className="input" defaultValue={customer?.city} /></Field>
        </div>
      </div>
      <div className="formfoot">
        <SubmitButton pending={pending} pendingText="Saving…">{customer ? 'Save changes' : 'Save customer'}</SubmitButton>
        {!customer && <Link href={returnTo === 'quote' ? '/quotations/new' : '/customers'} className="btn">Cancel</Link>}
      </div>
    </form>
  );
}
