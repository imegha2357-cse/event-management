'use client';
import { FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { addChecklistAction } from '../../actions';

export function ChecklistForm({ events }: { events: [string, string][] }) {
  const { state, action, onSubmit, pending } = useFormAction(addChecklistAction);
  return (
    <form action={action} onSubmit={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select name="event" className="input" style={{ width: 280 }} aria-label="Event for the standard checklist" defaultValue="">
        <option value="">Choose an event…</option>{events.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <SubmitButton pending={pending} className="btn" pendingText="Adding…">Add standard checklist</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
