import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { Gate } from '@/components/locked';
import { quoteLabel } from '@/lib/docs';
import { perk } from '@/lib/plans';
import { PageHead, Badge } from '@/components/page';
import { QuoteDocument } from '@/components/quote-doc';
import { DecisionPanel, PrintButton } from '@/components/decision';
import { ActionButton } from '@/components/action-form';
import { CopyButton } from '@/components/ui';
import { fmtDate, fmtDateTime, inr, bookingNo, waNumber } from '@/lib/util';
import { siteOrigin } from '@/lib/origin';
import { decideAction, markSentAction } from '../../actions';
import { AutoPrint } from '@/components/auto-print';

const ACTION_LABEL: Record<string, string> = {
  created: 'Quotation created', edited: 'Quotation edited', sent: 'Marked as sent', accepted: 'Accepted', declined: 'Declined',
  booking_created: 'Booking created', invoice_created: 'Invoice created', whatsapp_sent: 'WhatsApp confirmation sent', whatsapp_failed: 'WhatsApp confirmation failed',
};

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; print?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'quotations'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { db, tenant } = ctx;
  const [q] = await db.select().from(schema.quotations).where(and(eq(schema.quotations.id, id), eq(schema.quotations.tenantId, tenant.id))).limit(1);
  if (!q) notFound();
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, q.customerId)).limit(1);
  const events = await db.select().from(schema.quotationEvents).where(eq(schema.quotationEvents.quotationId, q.id)).orderBy(asc(schema.quotationEvents.createdAt));
  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.quotationId, q.id)).limit(1);
  const [note] = booking ? await db.select().from(schema.notifications).where(eq(schema.notifications.bookingId, booking.id)).orderBy(desc(schema.notifications.createdAt)).limit(1) : [];
  const link = `${await siteOrigin()}/q/${q.publicToken}`;
  const open = q.status === 'Draft' || q.status === 'Sent';
  const [inv] = booking ? await db.select().from(schema.invoices).where(eq(schema.invoices.bookingId, booking.id)).limit(1) : [];
  const waOk = perk(tenant, 'whatsappShare');
  const waText = `Vanakkam ${customer.name}, here is your quotation ${quoteLabel(tenant, q.number)} from ${tenant.name} for ${q.eventTitle} on ${fmtDate(q.eventDate)} — total ${inr(q.total)}.\n\nPlease review and accept or decline here: ${link}`;

  return (
    <>
      <PageHead title={quoteLabel(tenant, q.number)} badge={<Badge s={q.status} />} sub={<>{customer.name} · {q.eventTitle} · {fmtDate(q.eventDate)}</>}
        actions={<>{open && <Link className="btn" href={`/quotations/${q.id}/edit`}>Edit</Link>}<PrintButton /></>} />
      <div className="body">
        <AutoPrint on={sp.print === '1'} />
        {sp.created && <div className="formok no-print">Quotation saved as a draft. Share the review link with your customer below.</div>}
        <div className="split">
          <QuoteDocument q={q} tenant={tenant} customer={customer} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {open && (
              <div className="panel"><div className="panel-h"><h2>Send to customer</h2></div>
                <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p className="small muted">Your customer opens this link to view the quotation and accept or decline it. No login needed.</p>
                  <input className="input small" readOnly value={link} aria-label="Customer review link" />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {waOk ? <a className="btn good" href={`https://wa.me/${waNumber(customer.phone)}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
                      : <Link className="btn" href="/settings/plan" title="WhatsApp sharing comes with Pro">🔒 WhatsApp (Pro)</Link>}
                    <CopyButton text={link} />
                    <a className="btn" href={link} target="_blank" rel="noopener noreferrer">Preview</a>
                  </div>
                  {q.status === 'Draft' && <ActionButton action={markSentAction} fields={{ rid: q.id, via: 'Shared with customer' }} label="Mark as sent" pendingText="Saving…" className="btn primary" inline={false} />}
                </div>
              </div>
            )}
            {open && (
              <div className="panel"><div className="panel-h"><h2>Customer confirmed by phone?</h2></div>
                <div className="panel-b"><p className="small muted" style={{ marginBottom: 10 }}>Record their decision here. Accepting creates the booking and sends the WhatsApp confirmation.</p>
                  <DecisionPanel action={decideAction} fields={{ rid: q.id }} acceptLabel="Mark accepted" declineLabel="Mark declined" /></div>
              </div>
            )}
            {booking && (
              <div className="panel"><div className="panel-h"><h2>Booking</h2><Badge s={booking.status} /></div>
                <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link className="strong" href={`/bookings/${booking.id}`}>{bookingNo(booking.number)} — {booking.title}</Link>
                  {inv ? <Link href={`/invoices/${inv.id}`}>Invoice {inv.docNo}</Link> : <Link className="btn primary" href={`/invoices/new?booking=${booking.id}`}>Create invoice</Link>}
                  {note && <div className="small">WhatsApp: <Badge s={note.status} />{note.lastError && note.status !== 'sent' && <div className="ferr" style={{ marginTop: 4 }}>{note.lastError}</div>}</div>}
                </div>
              </div>
            )}
            {q.status === 'Declined' && (
              <div className="panel"><div className="panel-b"><b>Declined</b> by {q.decidedBy} on {fmtDateTime(q.decidedAt)}{q.declineReason && <p className="small" style={{ marginTop: 6 }}>Reason: {q.declineReason}</p>}</div></div>
            )}
            <div className="panel"><div className="panel-h"><h2>History</h2></div>
              <div className="panel-b"><ol className="timeline">{events.map(e => (
                <li key={e.id} className={e.action}><b>{ACTION_LABEL[e.action] ?? e.action}</b> <span className="muted">by {e.actor}</span>
                  <div className="when">{fmtDateTime(e.createdAt)}</div>{e.note && <div className="small">{e.note}</div>}</li>))}</ol></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
