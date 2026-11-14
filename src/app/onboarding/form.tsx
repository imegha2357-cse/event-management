'use client';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { onboardingAction } from '../(auth)/actions';

export function OnboardingForm({ tenant }: { tenant: { name: string; phone: string; city: string; address: string; gstin: string } }) {
  const { state, action, onSubmit, pending } = useFormAction(onboardingAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormMessage state={state} />
        <Field label="Company name" htmlFor="name" error={fe.name} required><input id="name" name="name" className="input" defaultValue={tenant.name} required /></Field>
        <div className="grid2">
          <Field label="Business phone" htmlFor="phone" error={fe.phone} required><input id="phone" name="phone" className="input" inputMode="tel" defaultValue={tenant.phone} required /></Field>
          <Field label="City" htmlFor="city" error={fe.city} required><input id="city" name="city" className="input" defaultValue={tenant.city} required /></Field>
        </div>
        <Field label="Address" htmlFor="address" error={fe.address}><textarea id="address" name="address" className="input" rows={2} defaultValue={tenant.address} /></Field>
        <Field label="GSTIN" htmlFor="gstin" error={fe.gstin} hint="Optional. 15 characters."><input id="gstin" name="gstin" className="input" defaultValue={tenant.gstin} maxLength={15} /></Field>
      </div>
      <div className="formfoot"><SubmitButton pending={pending} pendingText="Saving…">Save and continue</SubmitButton></div>
    </form>
  );
}
