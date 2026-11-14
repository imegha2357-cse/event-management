import 'server-only';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

/** Loads the signed-in user and their company, or sends them to the login page. Every page and action calls this. */
export async function requireUser(opts: { allowNoCompany?: boolean } = {}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.user.id)).limit(1);
  if (!user) redirect('/login');
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, user.tenantId)).limit(1);
  if (!tenant) redirect('/login');
  if (!tenant.name && !opts.allowNoCompany) redirect('/onboarding');
  return { db, user, tenant };
}

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string } | undefined;

export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) { const k = String(i.path[0] ?? 'form'); if (!out[k]) out[k] = i.message; }
  return out;
}
