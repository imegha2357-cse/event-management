import { and, desc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead } from '@/components/page';
import { NoAccess } from '@/components/locked';
import { ActionButton } from '@/components/action-form';
import { PlanMatrix } from '@/components/plan-matrix';
import { LIMITS, MODULES, PLANS, RANK, has, type PlanKey } from '@/lib/plans';
import { inr } from '@/lib/util';
import { requestUpgradeAction } from '../../plan-actions';
import { sql } from 'drizzle-orm';

export const metadata = { title: 'Plan' };

export default async function PlanPage() {
  const ctx = await requireUser();
  if (ctx.user.role !== 'Owner') return <NoAccess />;
  const { db, tenant, plan } = ctx;
  const [pending] = await db.select().from(schema.upgradeRequests).where(and(eq(schema.upgradeRequests.tenantId, tenant.id), eq(schema.upgradeRequests.status, 'Pending'))).orderBy(desc(schema.upgradeRequests.createdAt)).limit(1);
  const [{ n: activeEvents }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bookings).where(and(eq(schema.bookings.tenantId, tenant.id), sql`${schema.bookings.status} not in ('Completed','Cancelled')`));
  const [{ n: logins }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(and(eq(schema.users.tenantId, tenant.id), eq(schema.users.active, true)));
  const lim = LIMITS[plan];
  const locked = MODULES.filter(m => !has(tenant, m.key));
  return (
    <>
      <PageHead title="Your plan" sub={`${PLANS[plan].name} · ${inr(PLANS[plan].price)} per month · ${PLANS[plan].blurb}`} />
      <div className="body">
        <div className="grid3">
          <div className="kpi"><div className="k">Active events</div><div className="v">{activeEvents}<small> / {lim.events === Infinity ? 'unlimited' : lim.events}</small></div>
            {lim.events !== Infinity && <div className="meter" style={{ marginTop: 8 }}><span style={{ width: `${Math.min(100, (activeEvents / lim.events) * 100)}%`, background: activeEvents >= lim.events ? 'var(--bad)' : 'var(--primary)' }} /></div>}</div>
          <div className="kpi"><div className="k">Team logins</div><div className="v">{logins}<small> / {lim.users === Infinity ? 'unlimited' : lim.users}</small></div></div>
          <div className="kpi"><div className="k">Locked features</div><div className="v">{locked.length}</div><div className="s">{locked.length ? locked.map(m => m.label).join(', ') : 'Everything is switched on'}</div></div>
        </div>
        {plan !== 'enterprise' && (
          <div className="panel"><div className="panel-h"><h2>Upgrade</h2></div><div className="panel-b" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {pending ? <div className="notice">Your request for <b>{PLANS[pending.plan as PlanKey]?.name}</b> is with the EventDesk team. Your plan will change as soon as they approve it.</div>
              : (['pro', 'enterprise'] as PlanKey[]).filter(p => RANK[p] > RANK[plan]).map(p => (
                <ActionButton key={p} action={requestUpgradeAction} fields={{ plan: p }} label={`Request ${PLANS[p].name} (${inr(PLANS[p].price)}/month)`} pendingText="Sending…" className="btn primary" />))}
          </div></div>)}
        <PlanMatrix current={plan} />
      </div>
    </>
  );
}
