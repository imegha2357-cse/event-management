'use client';
import { useState } from 'react';
import type { ActionState } from '@/lib/session';
import { FormMessage, SubmitButton, useFormAction } from './ui';

/** Accept / Decline controls. Declining asks for an optional reason before confirming. */
export function DecisionPanel({ action, fields, acceptLabel = 'Accept quotation', declineLabel = 'Decline' }:
  { action: (s: ActionState, fd: FormData) => Promise<ActionState>; fields: Record<string, string>; acceptLabel?: string; declineLabel?: string }) {
  const { state, action: formAction, onSubmit, pending } = useFormAction(action);
  const [mode, setMode] = useState<'idle' | 'decline'>('idle');
  const hidden = Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FormMessage state={state} />
      {mode === 'idle' ? (
        <div className="decision">
          <form action={formAction} onSubmit={onSubmit}>{hidden}<input type="hidden" name="decision" value="Accepted" />
            <SubmitButton pending={pending} className="btn good lg" pendingText="Confirming…">{acceptLabel}</SubmitButton></form>
          <button type="button" className="btn lg danger" disabled={pending} onClick={() => setMode('decline')}>{declineLabel}</button>
        </div>
      ) : (
        <form action={formAction} onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{hidden}<input type="hidden" name="decision" value="Declined" />
          <label htmlFor="reason" className="small" style={{ fontWeight: 500 }}>Reason for declining (optional)</label>
          <textarea id="reason" name="reason" rows={3} className="input" maxLength={500} placeholder="e.g. Budget is higher than planned" />
          <div className="decision">
            <SubmitButton pending={pending} className="btn danger solid" pendingText="Declining…">Confirm decline</SubmitButton>
            <button type="button" className="btn" disabled={pending} onClick={() => setMode('idle')}>Back</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function PrintButton() {
  return <button type="button" className="btn" onClick={() => window.print()}>Print / Save as PDF</button>;
}
