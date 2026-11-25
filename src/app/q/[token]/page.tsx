import { LegalLinks } from '@/components/legal-page';
import { legalReady } from '@/lib/legal';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { QuoteDocument } from '@/components/quote-doc';
import { DecisionPanel, PrintButton } from '@/components/decision';
import { fmtDate, fmtDateTime, todayIST } from '@/lib/util';
import { publicDecideAction } from './actions';

export const metadata = { title: 'Your quotation', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PublicQuote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const db = await getDb();
  const [q] = await db.select().from(schema.quotations).where(eq(schema.quotations.publicToken, token)).limit(1);
  if (!q) notFound();
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, q.tenantId)).limit(1);
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, q.customerId)).limit(1);
  const open = q.status === 'Draft' || q.status === 'Sent';
  const [booking] = q.status === 'Accepted' ? await db.select().from(schema.bookings).where(eq(schema.bookings.quotationId, q.id)).limit(1) : [];
  const [note] = booking ? await db.select().from(schema.notifications).where(eq(schema.notifications.bookingId, booking.id)).orderBy(desc(schema.notifications.createdAt)).limit(1) : [];
  const expired = open && q.validUntil < todayIST();
  return (
    <main className="public">
      <div className="panel"><div className="panel-b" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          {open && !expired && <><h1 style={{ fontSize: 18 }}>Please review your quotation</h1><p className="muted small">From {tenant.name}. Valid until {fmtDate(q.validUntil)}.</p></>}
          {expired && <><h1 style={{ fontSize: 18 }}>This quotation has expired</h1><p className="muted small">It was valid until {fmtDate(q.validUntil)}. Please contact {tenant.name}{tenant.phone ? ` on ${tenant.phone}` : ''} for an updated quotation.</p></>}
          {q.status === 'Accepted' && <><h1 style={{ fontSize: 18, color: 'var(--good)' }}>Booking confirmed</h1><p className="muted small">You accepted this quotation on {fmtDateTime(q.decidedAt)}. {note?.status === 'sent' ? 'A confirmation has been sent to your WhatsApp.' : `${tenant.name} will contact you with the details.`}</p></>}
          {q.status === 'Declined' && <><h1 style={{ fontSize: 18 }}>Quotation declined</h1><p className="muted small">Declined on {fmtDateTime(q.decidedAt)}. Contact {tenant.name} if you change your mind.</p></>}
        </div>
        <PrintButton />
      </div>
        {open && !expired && <div className="panel-b" style={{ borderTop: '1px solid var(--line)' }}><DecisionPanel action={publicDecideAction} fields={{ token }} /></div>}
      </div>
      <QuoteDocument q={q} tenant={tenant} customer={customer} />
      {legalReady && <div className="no-print"><LegalLinks /></div>}
    </main>
  );
}
