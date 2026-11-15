'use client';
import { useEffect, useRef } from 'react';
import type { ActionState } from '@/lib/session';
import { SubmitButton, useFormAction } from './ui';

/** A small form around server-rendered inputs: submits to a server action, shows the result, clears on success. */
export function MiniForm({ action, children, submit, className = 'btn primary', reset = true, style }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; children: React.ReactNode; submit: string; className?: string; reset?: boolean; style?: React.CSSProperties;
}) {
  const { state, action: act, onSubmit, pending } = useFormAction(action);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && reset) ref.current?.reset(); }, [state, reset]);
  const err = state?.error ?? (state?.fieldErrors ? Object.values(state.fieldErrors)[0] : undefined);
  return (
    <form ref={ref} action={act} onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {children}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <SubmitButton pending={pending} className={className} pendingText="Saving…">{submit}</SubmitButton>
        {err && <span className="ferr" role="alert">{err}</span>}
        {state?.ok && state.message && <span className="small" style={{ color: 'var(--good)' }} role="status">{state.message}</span>}
      </div>
    </form>
  );
}
