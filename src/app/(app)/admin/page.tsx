import { notFound } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, isPlatformAdmin } from '@/lib/session';
import { PageHead, Badge, Empty } from '@/components/page';
import { ActionButton } from '@/components/action-form';
import { PLANS, planKey } from '@/lib/plans';
import { fmtDate, fmtDateTime, inr } from '@/lib/util';
import { decideUpgradeAction, setStatusAction } from './actions';
import { PlanSelect } from './plan-select';
import { PlanMatrix } from '@/components/plan-matrix';

export const metadata = { title: 'Admin panel' };

export default async function Admin() {
  const ctx = await requireUser({ allowSuspended: true });
  if (!isPlatformAdmin(ctx.user)) notFound();
  const { db } = ctx;
  const T = schema.tenants, U = schema.users, B = schema.bookings;
  const companies = await db.select({
    t: T,
    owner: sql<string>`(select u.name || ' · ' || u.email from users u where u.tenant_id = "tenants"."id" and u.role = 'Owner' order by u.created_at limit 1)`,
    users: sql<number>`(select count(*)::int from users u where u.tenant_id = "tenants"."id" and u.active)`,
    events: sql<number>`(select count(*)::int from bookings b where b.tenant_id = "tenants"."id")`,
  }).from(T).orderBy(desc(T.createdAt));
  const requests = await db.select({ r: schema.upgradeRequests, name: T.name, plan: T.plan }).from(schema.upgradeRequests).innerJoin(T, eq(T.id, schema.upgradeRequests.tenantId))
    .where(eq(schema.upgradeRequests.status, 'Pending')).orderBy(desc(schema.upgradeRequests.createdAt));
  const active = companies.filter(c => c.t.status === 'Active' && c.t.name);
  const mrr = active.reduce((s, c) => s + PLANS[planKey(c.t.plan)].price, 0);
  const count = (p: string) => companies.filter(c => planKey(c.t.plan) === p).length;
  return (
    <>
      <PageHead title="Admin panel" sub="Every event company on EventDesk. Set each one’s plan, suspend or reactivate, and handle upgrade requests." />
      <div className="body">
        <div className="grid4">
          <div className="kpi"><div className="k">Active companies</div><div className="v">{active.length}</div><div className="s">of {companies.length} signed up</div></div>
          <div className="kpi"><div className="k">Monthly subscription value</div><div className="v">{inr(mrr)}</div><div className="s">from active companies</div></div>
          <div className="kpi"><div className="k">Plans</div><div className="v">{count('basic')} · {count('pro')} · {count('enterprise')}</div><div className="s">Basic · Pro · Enterprise</div></div>
          <div className="kpi"><div className="k">Events managed</div><div className="v">{companies.reduce((s, c) => s + c.events, 0)}</div><div className="s">across all companies</div></div>
        </div>
        <div className="panel">
          <div className="panel-h"><h2>Upgrade requests</h2><span className="badge info">{requests.length} waiting</span></div>
          {requests.length === 0 ? <Empty title="No requests waiting" /> : (
            <table><thead><tr><th>When</th><th>Company</th><th>From → to</th><th>Asked by</th><th /></tr></thead><tbody>
              {requests.map(({ r, name, plan }) => (
                <tr key={r.id}><td className="nowrap">{fmtDateTime(r.createdAt)}</td><td><b>{name}</b></td><td>{PLANS[planKey(plan)].name} → <b>{PLANS[planKey(r.plan)].name}</b></td><td className="small">{r.requestedBy}</td>
                  <td className="num"><div style={{ display: 'inline-flex', gap: 6 }}>
                    <ActionButton action={decideUpgradeAction} fields={{ requestId: r.id, decision: 'approve' }} label="Approve" className="btn sm good" />
                    <ActionButton action={decideUpgradeAction} fields={{ requestId: r.id, decision: 'decline' }} label="Decline" className="btn sm danger" />
                  </div></td></tr>))}
            </tbody></table>)}
        </div>
        <div className="panel">
          <div className="panel-h"><h2>Companies</h2></div>
          <div className="tablewrap"><table><thead><tr><th>Company</th><th>Owner</th><th>City</th><th>Plan</th><th className="num">Logins</th><th className="num">Events</th><th>Joined</th><th>Status</th><th /></tr></thead><tbody>
            {companies.map(({ t, owner, users, events }) => (
              <tr key={t.id}>
                <td><b>{t.name || <span className="muted">(setup not finished)</span>}</b>{t.id === ctx.tenant.id && <span className="tag">You</span>}</td>
                <td className="small">{owner}</td><td>{t.city}</td>
                <td><PlanSelect tenantId={t.id} plan={planKey(t.plan)} name={t.name} /></td>
                <td className="num">{users}</td><td className="num">{events}</td><td className="nowrap">{fmtDate(t.createdAt)}</td>
                <td><Badge s={t.status === 'Active' ? 'good' : 'bad'} label={t.status} /></td>
                <td className="num">{t.id !== ctx.tenant.id && <ActionButton action={setStatusAction} fields={{ tenantId: t.id, status: t.status === 'Active' ? 'Suspended' : 'Active' }}
                  label={t.status === 'Active' ? 'Suspend' : 'Activate'} className={'btn sm' + (t.status === 'Active' ? ' danger' : '')} confirm={t.status === 'Active' ? `Suspend ${t.name}? Their team will not be able to use EventDesk until you activate them again. Their data is kept.` : undefined} />}</td>
              </tr>))}
          </tbody></table></div>
        </div>
        <PlanMatrix />
      </div>
    </>
  );
}
