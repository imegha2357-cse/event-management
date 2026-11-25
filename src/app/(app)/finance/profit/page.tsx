import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Empty } from '@/components/page';
import { Gate } from '@/components/locked';
import { ActionButton } from '@/components/action-form';
import { fmtDate, inr } from '@/lib/util';
import { deleteExpenseAction } from '../actions';
export const metadata = { title: 'Expenses & profit' };

export default async function Profit() {
  const ctx = await requireUser();
  const g = gate(ctx, 'reports'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { db, tenant } = ctx;
  const bookings = await db.select().from(schema.bookings).where(eq(schema.bookings.tenantId, tenant.id));
  const invs = await db.select().from(schema.invoices).where(eq(schema.invoices.tenantId, tenant.id));
  const exps = await db.select({ x: schema.expenses, title: schema.bookings.title }).from(schema.expenses).leftJoin(schema.bookings, eq(schema.bookings.id, schema.expenses.bookingId))
    .where(eq(schema.expenses.tenantId, tenant.id)).orderBy(desc(schema.expenses.spentOn), desc(schema.expenses.createdAt));
  // Income is counted before GST, because the tax is not your money.
  const rows = bookings.map(b => {
    const inc = invs.filter(i => i.bookingId === b.id).reduce((s, i) => s + i.total - i.tax, 0);
    const exp = exps.filter(e => e.x.bookingId === b.id).reduce((s, e) => s + e.x.amount, 0);
    return { b, inc, exp, profit: inc - exp };
  }).filter(r => r.inc || r.exp).sort((a, b) => b.b.eventDate.localeCompare(a.b.eventDate));
  const sum = (k: 'inc' | 'exp' | 'profit') => rows.reduce((s, r) => s + r[k], 0);
  const max = Math.max(1, ...rows.map(r => r.inc));
  return (<>
    <PageHead title="Expenses and profit" sub="Income is counted before GST, because the tax is not your money. Add each cost against its event to see real profit." actions={<Link className="btn primary" href="/finance/expense">+ Add expense</Link>} />
    <div className="body">
      <div className="grid3">
        <div className="kpi"><div className="k">Income (before GST)</div><div className="v">{inr(sum('inc'))}</div></div>
        <div className="kpi"><div className="k">Expenses</div><div className="v">{inr(sum('exp'))}</div></div>
        <div className="kpi"><div className="k">Profit</div><div className="v">{inr(sum('profit'))}</div></div>
      </div>
      <div className="panel">{rows.length === 0 ? <Empty title="No invoices or expenses yet" /> : (
        <div className="tablewrap"><table><thead><tr><th>Event</th><th className="num">Income</th><th /><th className="num">Expenses</th><th className="num">Profit</th><th className="num">Margin</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.b.id}><td><Link className="strong" href={`/bookings/${r.b.id}`}>{r.b.title}</Link><div className="small muted">{fmtDate(r.b.eventDate)}</div></td><td className="num">{inr(r.inc)}</td>
            <td style={{ width: '22%' }}><div className="bar"><i style={{ width: `${(r.inc / max) * 100}%` }} /></div></td><td className="num">{inr(r.exp)}</td><td className="num"><b>{inr(r.profit)}</b></td>
            <td className="num">{r.inc ? `${Math.round((r.profit / r.inc) * 100)}%` : '-'}</td></tr>)}
        </tbody></table></div>)}</div>
      <div className="panel"><div className="panel-h"><h2>Expense entries</h2></div>{exps.length === 0 ? <Empty title="No expenses recorded" /> : (
        <div className="tablewrap"><table><thead><tr><th>Date</th><th>Event</th><th>Category</th><th>What for</th><th>Bill</th><th className="num">Amount</th><th /></tr></thead><tbody>
          {exps.map(({ x, title }) => <tr key={x.id}><td className="nowrap">{fmtDate(x.spentOn)}</td><td>{title}</td><td>{x.category}</td><td>{x.item}<div className="small muted">{x.paidTo}{x.source === 'staff' ? ' · from staff wages' : ''}</div></td>
            <td>{x.bill ? <a href={x.bill} target="_blank" rel="noopener noreferrer"><img src={x.bill} alt={`Bill for ${x.item}`} className="billthumb" style={{ maxWidth: 60, maxHeight: 60 }} /></a> : <span className="muted">-</span>}</td>
            <td className="num">{inr(x.amount)}</td><td className="num"><ActionButton action={deleteExpenseAction} fields={{ rid: x.id }} label="Delete" className="btn sm danger" confirm={`Delete the expense “${x.item}”?`} /></td></tr>)}
        </tbody></table></div>)}</div>
    </div>
  </>);
}
