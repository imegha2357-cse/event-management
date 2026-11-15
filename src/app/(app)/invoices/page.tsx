import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Badge, Empty } from '@/components/page';
import { Gate } from '@/components/locked';
import { fmtDate, inr } from '@/lib/util';

export const metadata = { title: 'Invoices' };
const st = (t: number, p: number) => (p >= t ? 'Paid' : p > 0 ? 'Partly paid' : 'Unpaid');

export default async function Invoices() {
  const ctx = await requireUser();
  const g = gate(ctx, 'invoices'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const I = schema.invoices, P = schema.invoicePayments, C = schema.customers, B = schema.bookings;
  const rows = await ctx.db.select({ i: I, customer: C.name, event: B.title, paid: sql<number>`coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = "invoices"."id"),0)::int` })
    .from(I).innerJoin(C, eq(C.id, I.customerId)).leftJoin(B, eq(B.id, I.bookingId)).where(eq(I.tenantId, ctx.tenant.id)).orderBy(desc(I.issuedOn), desc(I.createdAt));
  const total = rows.reduce((s, r) => s + r.i.total, 0), paid = rows.reduce((s, r) => s + r.paid, 0);
  return (
    <>
      <PageHead title="Invoices" sub={`Made from bookings, numbered for each financial year, with ${ctx.tenant.gstin ? 'GST details' : 'your business details'}.`} actions={<Link className="btn primary" href="/bookings">Create from a booking</Link>} />
      <div className="body">
        <div className="grid3">
          <div className="kpi"><div className="k">Invoiced</div><div className="v">{inr(total)}</div><div className="s">{rows.length} invoices</div></div>
          <div className="kpi"><div className="k">Collected</div><div className="v">{inr(paid)}</div></div>
          <div className="kpi"><div className="k">Balance to collect</div><div className="v">{inr(total - paid)}</div></div>
        </div>
        <div className="panel">{rows.length === 0 ? <Empty title="No invoices yet">Open a booking and choose “Create invoice”.</Empty> : (
          <div className="tablewrap"><table><thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Event</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th></tr></thead><tbody>
            {rows.map(({ i, customer, event, paid }) => (
              <tr key={i.id}><td><Link className="strong" href={`/invoices/${i.id}`}>{i.docNo}</Link></td><td className="nowrap">{fmtDate(i.issuedOn)}</td><td>{customer}</td><td>{event}</td>
                <td className="num">{inr(i.total)}</td><td className="num">{inr(paid)}</td><td className="num">{inr(Math.max(i.total - paid, 0))}</td><td><Badge s={st(i.total, paid)} /></td></tr>))}
          </tbody></table></div>)}</div>
      </div>
    </>
  );
}
