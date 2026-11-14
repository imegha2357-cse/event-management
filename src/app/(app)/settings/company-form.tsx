'use client';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { updateCompanyAction } from '../actions';

export function CompanyForm({ t }: { t: { name: string; phone: string; city: string; address: string; gstin: string } }) {
  const { state, action, onSubmit, pending } = useFormAction(updateCompanyAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormMessage state={state} />
        <div className="grid2">
          <Field label="Company name" htmlFor="name" error={fe.name} required><input id="name" name="name" className="input" defaultValue={t.name} /></Field>
          <Field label="Business phone" htmlFor="phone" error={fe.phone} required><input id="phone" name="phone" className="input" defaultValue={t.phone} /></Field>
          <Field label="City" htmlFor="city" error={fe.city} required><input id="city" name="city" className="input" defaultValue={t.city} /></Field>
          <Field label="GSTIN" htmlFor="gstin" error={fe.gstin}><input id="gstin" name="gstin" className="input" defaultValue={t.gstin} maxLength={15} /></Field>
        </div>
        <Field label="Address" htmlFor="address" error={fe.address}><textarea id="address" name="address" rows={2} className="input" defaultValue={t.address} /></Field>
      </div>
      <div className="formfoot"><SubmitButton pending={pending} pendingText="Saving…">Save</SubmitButton></div>
    </form>
  );
}
