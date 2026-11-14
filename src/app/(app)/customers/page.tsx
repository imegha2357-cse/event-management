import Link from 'next/link';
import { and, eq, ilike, or, desc, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead, Empty } from '@/components/page';
import { inr } from '@/lib/util';

export const metadata = { title: 'Customers' };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { db, tenant } = await requireUser();
  const C = schema.customers, B = schema.bookings;
  const term = q.trim();
  const rows = await db.select({
    c: C,
    bookings: sql<number>`(select count(*)::int from ${B} where ${B.customerId} = ${C.id} and ${B.status} <> 'Cancelled')`,
    value: sql<number>`(select coalesce(sum(${B.total}),0)::int from ${B} where ${B.customerId} = ${C.id} and ${B.status} <> 'Cancelled')`,
  }).from(C).where(and(eq(C.tenantId, tenant.id), term ? or(ilike(C.name, `%${term}%`), ilike(C.phone, `%${term}%`), ilike(C.city, `%${term}%`)) : undefined))
    .orderBy(desc(C.createdAt)).limit(200);
  return (
    <>
      <PageHead title="Customers" sub={`${rows.length} shown`} actions={<>
        <form style={{ display: 'flex', gap: 6 }}><input name="q" defaultValue={q} className="input" placeholder="Search name, phone, city" aria-label="Search customers" style={{ width: 220 }} /><button className="btn">Search</button></form>
        <Link className="btn primary" href="/customers/new">+ New customer</Link></>} />
      <div className="body">
        <div className="panel">
          {rows.length === 0 ? <Empty title={term ? 'No customers match your search' : 'No customers yet'}>{!term && <Link href="/customers/new">Add your first customer</Link>}</Empty> : (
            <div className="tablewrap"><table><thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>City</th><th className="num">Bookings</th><th className="num">Booked value</th></tr></thead><tbody>
              {rows.map(({ c, bookings, value }) => (
                <tr key={c.id}><td><Link className="strong" href={`/customers/${c.id}`}>{c.name}</Link></td><td className="nowrap">{c.phone}</td><td>{c.email || <span className="muted">—</span>}</td>
                  <td>{c.city || <span className="muted">—</span>}</td><td className="num">{bookings}</td><td className="num">{inr(value)}</td></tr>))}
            </tbody></table></div>)}
        </div>
      </div>
    </>
  );
}
