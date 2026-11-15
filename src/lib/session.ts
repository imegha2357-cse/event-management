import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { allowed, groupsFor, has, isEnt, moduleOf, pageModule, planKey } from './plans';
import { tenantServices } from './catalog';
import { toolsFor } from './tools';
import { newId } from './util';

/**
 * Loads the signed-in user and their company, or sends them to the login page.
 * Every page and action calls this. Cached per request.
 */
export const requireUser = cache(async (opts: { allowNoCompany?: boolean; allowSuspended?: boolean } = {}) => {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.user.id)).limit(1);
  if (!user || !user.active) redirect('/login?removed=1');
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, user.tenantId)).limit(1);
  if (!tenant) redirect('/login');
  if (!tenant.name && !opts.allowNoCompany) redirect('/onboarding');
  if (tenant.status !== 'Active' && !opts.allowSuspended && !isPlatformAdmin(user)) redirect('/suspended');
  const services = tenantServices(tenant.services);
  const tools = toolsFor(services, tenant.custom?.tools ?? [], isEnt(tenant));
  const plan = planKey(tenant.plan);
  const custom = tenant.custom ?? {};
  const groups = groupsFor(tools.map(t => ({ key: t.key, label: t.label })))
    .map(g => ({ ...g, label: (isEnt(tenant) && custom.labels?.[g.key]) || g.label }));
  return { db, user, tenant, plan, services, tools, groups, custom };
});
export type Ctx = Awaited<ReturnType<typeof requireUser>>;

export function isPlatformAdmin(u: { email: string; platformAdmin: boolean }) {
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return u.platformAdmin || list.includes(u.email.toLowerCase());
}

/**
 * Why a page cannot be shown: the plan does not include it, or the user's role may not open it.
 * Returns null when the page is available.
 */
export function gate(ctx: Ctx, module: string): null | { kind: 'plan'; module: string } | { kind: 'role' } {
  const m = pageModule(module);
  if (!has(ctx.tenant, m)) return { kind: 'plan', module: m };
  if (!allowed(ctx.tenant, ctx.user.role, module)) return { kind: 'role' };
  return null;
}

/** For server actions: the same check, as an error message (or null when allowed). */
export function denied(ctx: Ctx, module: string): string | null {
  const g = gate(ctx, module);
  if (!g) return null;
  if (g.kind === 'plan') return `${moduleOf(g.module)?.label ?? 'This feature'} is not included in your plan.`;
  return 'Your role does not allow this.';
}

export async function logActivity(ctx: Pick<Ctx, 'db' | 'tenant' | 'user'>, what: string) {
  try {
    await ctx.db.insert(schema.activityLog).values({ id: newId(), tenantId: ctx.tenant.id, who: `${ctx.user.name}${ctx.user.role !== 'Owner' ? ` (${ctx.user.role})` : ''}`, what });
  } catch (e) { console.error('[activity] could not log:', e); }
}

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string; data?: Record<string, unknown> } | undefined;

export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) { const k = String(i.path[0] ?? 'form'); if (!out[k]) out[k] = i.message; }
  return out;
}
