import Link from 'next/link';
import { ResetForm } from '../forms';
export const metadata = { title: 'Choose a new password' };
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="auth-card">
      <h1>Choose a new password</h1>
      {token ? <ResetForm token={token} /> : <div className="formerror">This reset link is incomplete. <Link href="/forgot-password">Ask for a new link</Link>.</div>}
      <Link href="/login" className="small">← Back to sign in</Link>
    </div>
  );
}
