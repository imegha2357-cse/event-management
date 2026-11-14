import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SignupForm } from '../forms';
export const metadata = { title: 'Create account' };
export default async function SignupPage() {
  if ((await auth())?.user?.id) redirect('/dashboard');
  return (
    <div className="auth-card">
      <div><h1>Create your company account</h1><p className="muted" style={{ marginTop: 4 }}>Already registered? <Link href="/login">Sign in</Link></p></div>
      <SignupForm />
    </div>
  );
}
