import Link from 'next/link';
import { ForgotForm } from '../forms';
export const metadata = { title: 'Forgot password' };
export default function ForgotPage() {
  return (
    <div className="auth-card">
      <div><h1>Reset your password</h1><p className="muted" style={{ marginTop: 4 }}>Enter the email you sign in with and we will send you a reset link.</p></div>
      <ForgotForm />
      <Link href="/login" className="small">← Back to sign in</Link>
    </div>
  );
}
