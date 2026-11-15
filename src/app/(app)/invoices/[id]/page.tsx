import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Badge } from '@/components/page';
import { Gate } from '@/components/locked';
import { DocPaper } from '@/components/quote-doc';
import { PrintButton } from '@/components/decision';
import { ActionButton } from '@/components/action-form';
import { PaymentForm } from '@/components/payment-form';
import { has, perk } from '@/lib/plans';
import { fmtDate, inr, todayIST, waNumber } from '@/lib/util';
import { markPaidAction } from '../actions';
import { AutoPrint } from '@/components/auto-print';

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; print?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'invoices'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { db, tenant } = ctx;
  const [inv] = await db.select().from(schema.invoices).where(and(eq(schema.invoices.id, id), eq(schema.invoices.tenantId, tenant.id))).limit(1);
  if (!inv) notFound();
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, inv.customerId)).limit(1);
  const [b] = inv.bookingId ? await db.select().from(schema.bookings).where(eq(schema.bookings.id, inv.bookingId)).limit(1) : [];
  const pays = await db.select().from(schema.invoicePayments).where(eq(schema.invoicePayments.invoiceId, inv.id)).orderBy(asc(schema.invoicePayments.paidOn));
  const paid = pays.reduce((s, p) => s + p.amount, 0), bal = Math.max(inv.total - paid, 0);
  const status = paid >= inv.total ? 'Paid' : paid > 0 ? 'Partly paid' : 'Unpaid';
  const tracking = perk(tenant, 'paymentTracking') && has(tenant, 'payments');
  const waOk = perk(tenant, 'whatsappShare');
  return (
    <>
      <PageHead title={`Invoice ${inv.docNo}`} badge={<Badge s={status} />} sub={<>{customer.name}{b && <> · <Link href={`/bookings/${b.id}`}>{b.title}</Link></>}</>}
        actions={<>{waOk && customer.phone && <a className="btn good" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${waNumber(customer.phone)}?text=${encodeURIComponent(`Vanakkam ${customer.name}, invoice ${inv.docNo} from ${tenant.name}: total ${inr(inv.total)}, paid ${inr(paid)}, balance ${inr(bal)}. Thank you!`)}`}>Share on WhatsApp</a>}<PrintButton /></>} />
      <div className="body">
        <AutoPrint on={sp.print === '1'} />
        {sp.created && <div className="formok no-print">Invoice created.</div>}
        <div className="split">
          <DocPaper kind="invoice" tenant={tenant} customer={customer} no={inv.docNo} date={inv.issuedOn} items={inv.items} discount={inv.discount} gst={inv.gst} gstRate={inv.gstRate} notes={inv.notes} paid={paid}
            ev={b ? { title: b.title, type: b.eventType, date: b.eventDate, startTime: b.startTime, endTime: b.endTime, venue: b.venue, guests: b.guests } : null} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel"><div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="grid2"><div><div className="small muted">Paid</div><b style={{ fontSize: 18 }}>{inr(paid)}</b></div><div><div className="small muted">Balance</div><b style={{ fontSize: 18 }}>{inr(bal)}</b></div></div>
              <div className="bar" title={`${Math.round((paid / Math.max(inv.total, 1)) * 100)}% paid`}><i style={{ width: `${Math.min(100, (paid / Math.max(inv.total, 1)) * 100)}%` }} /></div>
              <h3>Payments received</h3>
              {pays.length ? <table><tbody>{pays.map(p => <tr key={p.id}><td>{fmtDate(p.paidOn)}<div className="small muted">{p.kind} · {p.mode}{p.reference ? ` · ${p.reference}` : ''}</div></td><td className="num">{inr(p.amount)}</td></tr>)}</tbody></table> : <p className="small muted">No payments recorded yet.</p>}
              {!tracking && bal > 0 && <>
                <p className="small muted">On the Basic plan you can mark an invoice as fully paid. Recording advance and balance payments separately comes with Pro.</p>
                <ActionButton action={markPaidAction} fields={{ rid: inv.id }} label="Mark as fully paid" className="btn primary" confirm={`Mark ${inr(bal)} as received today?`} />
              </>}
            </div></div>
            {tracking && bal > 0 && <PaymentForm invoices={[{ id: inv.id, label: `${b?.title ?? inv.docNo} · ${b ? fmtDate(b.eventDate) : ''}`, client: customer.name, docNo: inv.docNo, total: inv.total, paid }]} today={todayIST()} />}
          </div>
        </div>
      </div>
    </>
  );
}
