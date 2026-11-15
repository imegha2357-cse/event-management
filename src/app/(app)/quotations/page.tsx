import Link from 'next/link';
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { Gate } from '@/components/locked';
import { quoteLabel } from '@/lib/docs';
import { PageHead, Badge, Empty } from '@/components/page';
import { fmtDate, inr } from '@/lib/util';

export const metadata = { title: 'Quotations' };
const FILTERS = ['All', 'Draft', 'Sent', 'Accepted', 'Declined'];

export default async function Quotations({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status ?? '') ? sp.status! : 'All';
  const ctx = await requireUser();
  const g = gate(ctx, 'quotations'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { db, tenant } = ctx;
  const Q = schema.quotations, C = schema.customers;
  const counts = await db.select({ s: Q.status, n: sql<number>`count(*)::int` }).from(Q).where(eq(Q.tenantId, tenant.id)).groupBy(Q.status);
  const count = (s: string) => s === 'All' ? counts.reduce((a, c) => a + c.n, 0) : (counts.find(c => c.s === s)?.n ?? 0);
  const rows = await db.select({ q: Q, customer: C.name }).from(Q).innerJoin(C, eq(C.id, Q.customerId))
    .where(and(eq(Q.tenantId, tenant.id), status === 'All' ? undefined : eq(Q.status, status))).orderBy(desc(Q.createdAt)).limit(300);
  return (
    <>
      <PageHead title="Quotations" actions={<Link className="btn primary" href="/quotations/new">+ New quotation</Link>} />
      <div className="body">
        <div className="seg" role="tablist" aria-label="Filter by status">
          {FILTERS.map(f => <Link key={f} role="tab" aria-selected={f === status} className={f === status ? 'on' : ''} href={f === 'All' ? '/quotations' : `/quotations?status=${f}`}>{f} ({count(f)})</Link>)}
        </div>
        <div className="panel">
          {rows.length === 0 ? <Empty title={status === 'All' ? 'No quotations yet' : `No ${status.toLowerCase()} quotations`}>{status === 'All' && <Link href="/quotations/new">Create your first quotation</Link>}</Empty> : (
            <div className="tablewrap"><table><thead><tr><th>Number</th><th>Customer</th><th>Event</th><th>Event date</th><th>Valid until</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>
              {rows.map(({ q, customer }) => (
                <tr key={q.id}><td><Link className="strong" href={`/quotations/${q.id}`}>{quoteLabel(tenant, q.number)}</Link></td><td>{customer}</td>
                  <td>{q.eventTitle}<div className="small muted">{q.eventType}</div></td><td className="nowrap">{fmtDate(q.eventDate)}</td><td className="nowrap">{fmtDate(q.validUntil)}</td>
                  <td><Badge s={q.status} /></td><td className="num">{inr(q.total)}</td></tr>))}
            </tbody></table></div>)}
        </div>
      </div>
    </>
  );
}
