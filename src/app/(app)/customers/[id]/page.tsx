import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead, Badge, Empty } from '@/components/page';
import { fmtDate, inr, quoteNo, bookingNo } from '@/lib/util';
import { CustomerForm } from '../form';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, tenant } = await requireUser();
  const [c] = await db.select().from(schema.customers).where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, tenant.id))).limit(1);
  if (!c) notFound();
  const quotes = await db.select().from(schema.quotations).where(and(eq(schema.quotations.customerId, id), eq(schema.quotations.tenantId, tenant.id))).orderBy(desc(schema.quotations.createdAt));
  const bookings = await db.select().from(schema.bookings).where(and(eq(schema.bookings.customerId, id), eq(schema.bookings.tenantId, tenant.id))).orderBy(desc(schema.bookings.eventDate));
  return (
    <>
      <PageHead title={c.name} sub={`${c.phone}${c.city ? ' · ' + c.city : ''}`} actions={<Link className="btn primary" href={`/quotations/new?customer=${c.id}`}>+ New quotation</Link>} />
      <div className="body">
        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel"><div className="panel-h"><h2>Quotations</h2></div>
              {quotes.length === 0 ? <Empty title="No quotations for this customer" /> : <table><thead><tr><th>Number</th><th>Event</th><th>Date</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>
                {quotes.map(q => <tr key={q.id}><td><Link href={`/quotations/${q.id}`} className="strong">{quoteNo(q.number)}</Link></td><td>{q.eventTitle}</td><td className="nowrap">{fmtDate(q.eventDate)}</td><td><Badge s={q.status} /></td><td className="num">{inr(q.total)}</td></tr>)}
              </tbody></table>}
            </div>
            <div className="panel"><div className="panel-h"><h2>Bookings</h2></div>
              {bookings.length === 0 ? <Empty title="No bookings yet" /> : <table><thead><tr><th>Number</th><th>Event</th><th>Date</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>
                {bookings.map(b => <tr key={b.id}><td><Link href={`/bookings/${b.id}`} className="strong">{bookingNo(b.number)}</Link></td><td>{b.title}</td><td className="nowrap">{fmtDate(b.eventDate)}</td><td><Badge s={b.status} /></td><td className="num">{inr(b.total)}</td></tr>)}
              </tbody></table>}
            </div>
          </div>
          <div><h3 style={{ marginBottom: 8 }}>Edit details</h3><CustomerForm customer={{ id: c.id, name: c.name, phone: c.phone, email: c.email, city: c.city }} /></div>
        </div>
      </div>
    </>
  );
}
