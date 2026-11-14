'use client';
import { useEffect, useRef } from 'react';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { assignCrewAction, crewNeededAction, fixPhoneAndRetryAction } from '../../actions';

export function AssignCrewForm({ bookingId, options }: { bookingId: string; options: { id: string; label: string; group: string }[] }) {
  const { state, action, onSubmit, pending } = useFormAction(assignCrewAction);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const groups = [...new Set(options.map(o => o.group))];
  return (
    <form ref={ref} action={action} onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }} noValidate>
      <input type="hidden" name="bookingId" value={bookingId} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}><Field label="Assign staff" htmlFor="staffId" error={state?.fieldErrors?.staffId}>
          <select id="staffId" name="staffId" className="input" defaultValue="">
            <option value="">{options.length ? 'Choose a person…' : 'Everyone is already assigned'}</option>
            {groups.map(g => <optgroup key={g} label={g}>{options.filter(o => o.group === g).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>)}
          </select></Field></div>
        <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', height: 34 }}><input type="checkbox" name="withTeam" defaultChecked /> include their helper boys</label>
        <SubmitButton pending={pending} pendingText="Assigning…" disabled={!options.length}>Assign</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function CrewNeededForm({ bookingId, value }: { bookingId: string; value: number }) {
  const { state, action, onSubmit, pending } = useFormAction(crewNeededAction);
  return (
    <form action={action} onSubmit={onSubmit} style={{ display: 'flex', gap: 6, alignItems: 'center' }} noValidate>
      <input type="hidden" name="rid" value={bookingId} />
      <label htmlFor="crewNeeded" className="small">Crew needed</label>
      <input id="crewNeeded" name="crewNeeded" type="number" min={0} max={500} defaultValue={value} className="input" style={{ width: 70, height: 28 }} />
      <SubmitButton pending={pending} className="btn sm">Save</SubmitButton>
      {state?.fieldErrors?.crewNeeded && <span className="ferr">{state.fieldErrors.crewNeeded}</span>}
      {state?.ok && <span className="small" style={{ color: 'var(--good)' }}>Saved</span>}
    </form>
  );
}

export function FixPhoneForm({ id, phone }: { id: string; phone: string }) {
  const { state, action, onSubmit, pending } = useFormAction(fixPhoneAndRetryAction);
  return (
    <form action={action} onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }} noValidate>
      <input type="hidden" name="rid" value={id} />
      <div style={{ display: 'flex', gap: 6 }}>
        <input name="phone" className="input" defaultValue={phone.replace(/^91(?=\d{10}$)/, '')} aria-label="Correct WhatsApp number" />
        <SubmitButton pending={pending} className="btn" pendingText="Sending…">Update & resend</SubmitButton>
      </div>
      {state?.fieldErrors?.phone && <span className="ferr">{state.fieldErrors.phone}</span>}
      <FormMessage state={state} />
    </form>
  );
}
