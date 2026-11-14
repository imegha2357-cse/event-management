'use client';
import { useActionState } from 'react';
import type { ActionState } from '@/lib/session';
import { SubmitButton } from './ui';

type Act = (s: ActionState, fd: FormData) => Promise<ActionState>;

/** A small form (usually a single button) that runs a server action and shows its result next to it. */
export function ActionButton({ action, fields, label, pendingText, className = 'btn', confirm, inline = true }:
  { action: Act; fields: Record<string, string>; label: React.ReactNode; pendingText?: string; className?: string; confirm?: string; inline?: boolean }) {
  const [state, run] = useActionState(action, undefined);
  return (
    <form action={run} style={{ display: inline ? 'inline-flex' : 'flex', flexDirection: inline ? 'row' : 'column', gap: 8, alignItems: inline ? 'center' : 'stretch' }}
      onSubmit={e => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton className={className} pendingText={pendingText}>{label}</SubmitButton>
      {state?.error && <span className="ferr" role="alert">{state.error}</span>}
      {state?.ok && state.message && <span className="small" style={{ color: 'var(--good)' }} role="status">{state.message}</span>}
    </form>
  );
}
