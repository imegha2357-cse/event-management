'use client';
import { startTransition, useActionState, useState } from 'react';
import type { ActionState } from '@/lib/session';
import { useFormStatus } from 'react-dom';

/** Submit button that disables itself and shows a spinner while its form is being processed. */
export function SubmitButton({ children, className = 'btn primary', pendingText, pending: pendingProp, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} aria-busy={pending} {...rest}>
      {pending && <span className="spinner" aria-hidden />}{pending && pendingText ? pendingText : children}
    </button>
  );
}

export function PasswordInput({ id, name, autoComplete, invalid, minLength }: { id: string; name: string; autoComplete: string; invalid?: boolean; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pwwrap">
      <input id={id} name={name} type={show ? 'text' : 'password'} className="input" autoComplete={autoComplete} required minLength={minLength} aria-invalid={invalid || undefined} />
      <button type="button" className="pwtoggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

export function Field({ label, htmlFor, error, required, hint, children }: { label: string; htmlFor?: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}{required && <span className="req"> *</span>}</label>
      {children}
      {error ? <span className="ferr" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function FormMessage({ state }: { state?: { error?: string; message?: string; ok?: boolean } }) {
  if (state?.error) return <div className="formerror" role="alert">{state.error}</div>;
  if (state?.ok && state.message) return <div className="formok" role="status">{state.message}</div>;
  return null;
}

export function CopyButton({ text, label = 'Copy link', className = 'btn' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState<'idle' | 'ok' | 'err'>('idle');
  return (
    <button type="button" className={className} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone('ok'); } catch { setDone('err'); }
      setTimeout(() => setDone('idle'), 2000);
    }}>{done === 'ok' ? 'Copied' : done === 'err' ? 'Copy failed' : label}</button>
  );
}

/**
 * Runs a server action from a form without React's automatic form reset,
 * so what the user typed stays in place when validation fails.
 * Use as <form action={action} onSubmit={onSubmit}>: before the page has finished loading
 * the form still posts to the server action; afterwards onSubmit handles it in place.
 */
export function useFormAction(action: (s: ActionState, fd: FormData) => Promise<ActionState>) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    // Drop the hidden fields React adds for no-JavaScript submissions; they are not form data.
    for (const k of [...fd.keys()]) if (k.startsWith('$ACTION')) fd.delete(k);
    startTransition(() => dispatch(fd));
  };
  return { state, action: dispatch, onSubmit, pending };
}
