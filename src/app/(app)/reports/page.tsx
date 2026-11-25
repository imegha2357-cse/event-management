import Link from 'next/link';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { Icon } from '@/components/icons';
import { REPORTS, allowed, has, moduleOf, PLANS } from '@/lib/plans';
export const metadata = { title: 'Reports' };

export default async function Reports() {
  const ctx = await requireUser();
  const g = gate(ctx, 'reportbook'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { tenant, user } = ctx;
  const list = REPORTS.filter(r => allowed(tenant, user.role, r.module));
  return (<>
    <PageHead title="Reports" sub="Pick a report, choose the period, then print it or save it as a PDF." />
    <div className="body">
      <div className="reportgrid">
        {list.map(r => {
          const lock = has(tenant, r.module) ? null : PLANS[moduleOf(r.module)!.plan].name;
          return (
            <Link key={r.key} href={`/reports/${r.key}`} className="panel reportcard">
              <div className="panel-b">
                <div className="reportcard-h"><Icon name="reports" size={18} /><b>{r.label}</b>{lock && <span className="chip warn">{lock} plan</span>}</div>
                <p className="small muted">{r.about}</p>
                <span className="small">Open report →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  </>);
}
