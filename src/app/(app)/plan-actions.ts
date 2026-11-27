'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, logActivity, type ActionState } from '@/lib/session';
import { PLANS, RANK, planKey } from '@/lib/plans';
import { newId } from '@/lib/util';

export async function requestUpgradeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  if (ctx.user.role !== 'Owner') return { error: 'Only the owner can ask for a plan change.' };
  const plan = planKey(String(fd.get('plan') ?? ''));
  if (RANK[plan] <= RANK[ctx.plan]) return { error: `You already have ${PLANS[ctx.plan].name}.` };
  const [open] = await ctx.db.select().from(schema.upgradeRequests).where(and(eq(schema.upgradeRequests.tenantId, ctx.tenant.id), eq(schema.upgradeRequests.status, 'Pending'))).limit(1);
  if (open) return { ok: true, message: `Your request for ${PLANS[planKey(open.plan)].name} is already with the EventOS team.` };
  await ctx.db.insert(schema.upgradeRequests).values({ id: newId(), tenantId: ctx.tenant.id, plan, note: String(fd.get('note') ?? '').slice(0, 300), requestedBy: `${ctx.user.name} <${ctx.user.email}>` });
  await logActivity(ctx, `Asked to upgrade to ${PLANS[plan].name}`);
  revalidatePath('/settings/plan');
  return { ok: true, message: `Request sent. The EventOS team will switch you to ${PLANS[plan].name}.` };
}
