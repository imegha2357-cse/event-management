'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, isPlatformAdmin, type ActionState } from '@/lib/session';
import { PLANS, planKey } from '@/lib/plans';

async function adminCtx() {
  const ctx = await requireUser({ allowSuspended: true });
  if (!isPlatformAdmin(ctx.user)) throw new Error('Not allowed');
  return ctx;
}

export async function setPlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminCtx();
  const id = String(fd.get('tenantId') ?? '');
  const plan = planKey(String(fd.get('plan') ?? ''));
  const rows = await db.update(schema.tenants).set({ plan, planChangedAt: new Date() }).where(eq(schema.tenants.id, id)).returning({ name: schema.tenants.name });
  if (!rows.length) return { error: 'Company not found.' };
  await db.update(schema.upgradeRequests).set({ status: 'Done', decidedAt: new Date() }).where(and(eq(schema.upgradeRequests.tenantId, id), eq(schema.upgradeRequests.status, 'Pending'), eq(schema.upgradeRequests.plan, plan)));
  revalidatePath('/admin');
  return { ok: true, message: `${rows[0].name} is now on ${PLANS[plan].name}.` };
}

export async function setStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await adminCtx();
  const id = String(fd.get('tenantId') ?? '');
  const status = fd.get('status') === 'Suspended' ? 'Suspended' : 'Active';
  if (id === tenant.id && status === 'Suspended') return { error: 'You cannot suspend your own company.' };
  const rows = await db.update(schema.tenants).set({ status }).where(eq(schema.tenants.id, id)).returning({ name: schema.tenants.name });
  if (!rows.length) return { error: 'Company not found.' };
  revalidatePath('/admin');
  return { ok: true, message: `${rows[0].name} is ${status === 'Active' ? 'active again' : 'suspended'}.` };
}

export async function decideUpgradeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminCtx();
  const id = String(fd.get('requestId') ?? '');
  const approve = fd.get('decision') === 'approve';
  const [r] = await db.update(schema.upgradeRequests).set({ status: approve ? 'Approved' : 'Declined', decidedAt: new Date() })
    .where(and(eq(schema.upgradeRequests.id, id), eq(schema.upgradeRequests.status, 'Pending'))).returning();
  if (!r) return { error: 'This request was already handled.' };
  if (approve) await db.update(schema.tenants).set({ plan: planKey(r.plan), planChangedAt: new Date() }).where(eq(schema.tenants.id, r.tenantId));
  revalidatePath('/admin');
  return { ok: true, message: approve ? `Approved: switched to ${PLANS[planKey(r.plan)].name}.` : 'Request declined.' };
}
