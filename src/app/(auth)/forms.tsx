'use client';
import Link from 'next/link';
import { Field, FormMessage, PasswordInput, SubmitButton, useFormAction } from '@/components/ui';
import { loginAction, signupAction, forgotPasswordAction, resetPasswordAction } from './actions';

export function LoginForm({ next }: { next: string }) {
  const { state, action, onSubmit, pending } = useFormAction(loginAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} className="auth-card" style={{ gap: 14 }} noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Email address" htmlFor="email" error={fe.email}>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required aria-invalid={!!fe.email || undefined} />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" invalid={!!fe.password} />
      </Field>
      <div style={{ textAlign: 'right', marginTop: -6 }}><Link href="/forgot-password" className="small">Forgot password?</Link></div>
      <SubmitButton pending={pending} className="btn primary lg block" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const { state, action, onSubmit, pending } = useFormAction(signupAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} className="auth-card" style={{ gap: 14 }} noValidate>
      <FormMessage state={state} />
      <Field label="Your full name" htmlFor="name" error={fe.name} required><input id="name" name="name" className="input" autoComplete="name" required aria-invalid={!!fe.name || undefined} /></Field>
      <Field label="Company name" htmlFor="company" error={fe.company} required><input id="company" name="company" className="input" autoComplete="organization" required aria-invalid={!!fe.company || undefined} /></Field>
      <Field label="Work email" htmlFor="email" error={fe.email} required><input id="email" name="email" type="email" className="input" autoComplete="email" required aria-invalid={!!fe.email || undefined} /></Field>
      <Field label="Password" htmlFor="password" error={fe.password} required hint="At least 8 characters, with a letter and a number.">
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} invalid={!!fe.password} />
      </Field>
      <SubmitButton pending={pending} className="btn primary lg block" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const { state, action, onSubmit, pending } = useFormAction(forgotPasswordAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} className="auth-card" style={{ gap: 14 }} noValidate>
      <FormMessage state={state} />
      <Field label="Email address" htmlFor="email" error={fe.email}><input id="email" name="email" type="email" className="input" autoComplete="email" required aria-invalid={!!fe.email || undefined} /></Field>
      <SubmitButton pending={pending} className="btn primary lg block" pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { state, action, onSubmit, pending } = useFormAction(resetPasswordAction);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} className="auth-card" style={{ gap: 14 }} noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label="New password" htmlFor="password" error={fe.password} hint="At least 8 characters, with a letter and a number."><PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} invalid={!!fe.password} /></Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fe.confirm}><PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={!!fe.confirm} /></Field>
      <SubmitButton pending={pending} className="btn primary lg block" pendingText="Saving…">Set new password</SubmitButton>
    </form>
  );
}
