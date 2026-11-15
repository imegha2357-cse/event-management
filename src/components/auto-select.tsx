'use client';
import type { ActionState } from '@/lib/session';
import { useFormAction } from './ui';

/** A select that saves as soon as it changes (status columns, plan pickers). */
export function AutoSelect({ action, fields, name, value, options, label }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; fields: Record<string, string>; name: string; value: string; options: string[]; label: string;
}) {
  const { state, action: act, onSubmit, pending } = useFormAction(action);
  const opts = options.includes(value) ? options : [value, ...options];
  return (
    <form action={act} onSubmit={onSubmit} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <select name={name} defaultValue={value} aria-label={label} className="input" style={{ height: 28, fontSize: 12.5, minWidth: 120 }} disabled={pending} onChange={e => e.currentTarget.form?.requestSubmit()}>
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
      {state?.error && <span className="ferr">{state.error}</span>}
    </form>
  );
}
