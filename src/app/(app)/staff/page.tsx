import Link from 'next/link';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead, Badge, Empty } from '@/components/page';
import { ActionButton } from '@/components/action-form';
import { fmtDate, inr, todayIST } from '@/lib/util';
import { togglePresentAction } from '../actions';
import { AddEmployeeButton, PayButton } from './dialogs';

export const metadata = { title: 'Staff & crews' };
type Row = typeof schema.staff.$inferSelect & { due: number; paid: number; days: number; todayCrewId?: string; todayPresent?: boolean };

function payStatus(due: number, paid: number) {
  if (due <= 0 && paid <= 0) return <span className="muted small">No work yet</span>;
  if (paid >= due) return <Badge s="Paid" />;
  return paid > 0 ? <Badge s="Partly" label="Part paid" /> : <Badge s="Unpaid" />;
}

export default async function Staff() {
  const { db, tenant } = await requireUser();
  const today = todayIST();
  const S = schema.staff, BC = schema.bookingCrew, B = schema.bookings, P = schema.staffPayments;
  const people = await db.select().from(S).where(eq(S.tenantId, tenant.id)).orderBy(asc(S.name));
  const work = await db.select({ staffId: BC.staffId, due: sql<number>`coalesce(sum(${BC.wage}) filter (where ${BC.present}),0)::int`, days: sql<number>`count(*) filter (where ${BC.present})::int` })
    .from(BC).innerJoin(B, eq(B.id, BC.bookingId)).where(and(eq(BC.tenantId, tenant.id), ne(B.status, 'Cancelled'))).groupBy(BC.staffId);
  const paid = await db.select({ staffId: P.staffId, paid: sql<number>`coalesce(sum(${P.amount}),0)::int` }).from(P).where(eq(P.tenantId, tenant.id)).groupBy(P.staffId);
  const todays = await db.select({ id: BC.id, staffId: BC.staffId, present: BC.present, title: B.title }).from(BC).innerJoin(B, eq(B.id, BC.bookingId))
    .where(and(eq(BC.tenantId, tenant.id), eq(B.eventDate, today), ne(B.status, 'Cancelled')));
  const payments = await db.select({ p: P, name: S.name }).from(P).innerJoin(S, eq(S.id, P.staffId)).where(eq(P.tenantId, tenant.id)).orderBy(desc(P.paidOn), desc(P.createdAt)).limit(15);

  const rows: Row[] = people.map(p => {
    const t = todays.find(x => x.staffId === p.id);
    return { ...p, due: work.find(w => w.staffId === p.id)?.due ?? 0, days: work.find(w => w.staffId === p.id)?.days ?? 0, paid: paid.find(x => x.staffId === p.id)?.paid ?? 0, todayCrewId: t?.id, todayPresent: t?.present };
  });
  const leaders = rows.filter(r => r.kind === 'permanent');
  const teams = leaders.map(l => ({ leader: l, helpers: rows.filter(h => h.leaderId === l.id) }));
  const sum = (xs: Row[], k: 'due' | 'paid') => xs.reduce((a, x) => a + x[k], 0);
  const totDue = sum(rows, 'due'), totPaid = sum(rows, 'paid');
  const onDutyToday = todays.length, presentToday = todays.filter(t => t.present).length;

  const attendance = (r: Row) => r.todayCrewId
    ? <ActionButton action={togglePresentAction} fields={{ rid: r.todayCrewId, present: String(!r.todayPresent) }} className={'btn sm' + (r.todayPresent ? ' good' : '')} label={r.todayPresent ? '✓ Present' : 'Mark present'} />
    : <span className="muted small">Not on duty today</span>;

  return (
    <>
      <PageHead title="Staff & crews" sub="Permanent employees lead teams of helper boys. Wages are due for each event they attend." actions={<AddEmployeeButton leaders={leaders.map(l => ({ id: l.id, name: l.name }))} />} />
      <div className="body">
        <div className="grid4">
          <div className="kpi"><div className="k">Team leaders</div><div className="v">{leaders.length}</div><div className="s">{rows.length - leaders.length} helper boy{rows.length - leaders.length === 1 ? '' : 's'}</div></div>
          <div className="kpi"><div className="k">On duty today</div><div className="v">{presentToday}<small> / {onDutyToday}</small></div><div className="s">Present / assigned</div></div>
          <div className="kpi"><div className="k">Wages earned</div><div className="v">{inr(totDue)}</div><div className="s">For days marked present</div></div>
          <div className="kpi"><div className="k">Balance to pay</div><div className="v">{inr(Math.max(totDue - totPaid, 0))}</div><div className="s">{inr(totPaid)} paid so far</div></div>
        </div>
        <div className="panel">
          {teams.length === 0 ? <Empty title="No staff yet">Add a permanent employee first, then add the helper boys they bring.</Empty> : (<>
            <div className="teamhead"><span>Team leader</span><span className="hide-sm">Phone</span><span className="hide-sm">Team</span><span>Today</span><span className="num hide-sm">Due</span><span className="num hide-sm">Paid</span><span className="num">Balance</span><span /></div>
            {teams.map(({ leader, helpers }) => {
              const team = [leader, ...helpers];
              const tDue = sum(team, 'due'), tPaid = sum(team, 'paid');
              const tToday = team.filter(m => m.todayCrewId), tPresent = tToday.filter(m => m.todayPresent).length;
              return (
                <details className="team" key={leader.id}>
                  <summary>
                    <span className="person"><span className="avatar" aria-hidden>{leader.name.slice(0, 2).toUpperCase()}</span><span><b>{leader.name}</b><div className="small muted">₹{leader.dailyWage.toLocaleString('en-IN')}/day</div></span></span>
                    <span className="hide-sm">{leader.phone}</span>
                    <span className="hide-sm">{helpers.length} helper{helpers.length === 1 ? '' : 's'}</span>
                    <span className="small">{tToday.length ? `${tPresent}/${tToday.length} present` : <span className="muted">Not on duty</span>}</span>
                    <span className="num hide-sm">{inr(tDue)}</span><span className="num hide-sm">{inr(tPaid)}</span><span className="num"><b>{inr(Math.max(tDue - tPaid, 0))}</b></span>
                    <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                  </summary>
                  <div className="members"><div className="tablewrap"><table>
                    <thead><tr><th>Name</th><th>Phone</th><th>Attendance today</th><th className="num">Days</th><th className="num">Due</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th><th /></tr></thead>
                    <tbody>{team.map(m => (
                      <tr key={m.id}>
                        <td>{m.name}{m.id === leader.id ? <span className="tag">Team leader</span> : <span className="tag">Helper</span>}<div className="small muted">₹{m.dailyWage.toLocaleString('en-IN')}/day</div></td>
                        <td className="nowrap">{m.phone}</td><td>{attendance(m)}</td><td className="num">{m.days}</td>
                        <td className="num">{inr(m.due)}</td><td className="num">{inr(m.paid)}</td><td className="num">{inr(Math.max(m.due - m.paid, 0))}</td>
                        <td>{payStatus(m.due, m.paid)}</td><td className="num"><PayButton staffId={m.id} name={m.name} balance={Math.max(m.due - m.paid, 0)} today={today} /></td>
                      </tr>))}
                    </tbody></table></div>
                    {helpers.length === 0 && <p className="small muted" style={{ marginTop: 8 }}>No helper boys yet. Use “Add employee” → Helper boy and choose {leader.name} under “Brought by”.</p>}
                  </div>
                </details>);
            })}
          </>)}
        </div>
        <div className="panel"><div className="panel-h"><h2>Recent wage payments</h2></div>
          {payments.length === 0 ? <Empty title="No payments recorded yet" /> : <table><thead><tr><th>Date</th><th>Paid to</th><th>Note</th><th className="num">Amount</th></tr></thead><tbody>
            {payments.map(({ p, name }) => <tr key={p.id}><td className="nowrap">{fmtDate(p.paidOn)}</td><td>{name}</td><td>{p.note || <span className="muted">—</span>}</td><td className="num">{inr(p.amount)}</td></tr>)}
          </tbody></table>}
        </div>
        <p className="small muted">Assign crews to events from each booking’s page. <Link href="/bookings">Go to bookings</Link></p>
      </div>
    </>
  );
}
