import { eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { PaymentForm } from '@/components/payment-form';
import { fmtDate, todayIST } from '@/lib/util';
export const metadata = { title: 'Record payment' };

export default async function RecordPayment({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'payments'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const I = schema.invoices, P = schema.invoicePayments, B = schema.bookings, C = schema.customers;
  const rows = await ctx.db.select({ i: I, title: B.title, date: B.eventDate, client: C.name, paid: sql<number>`coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = "invoices"."id"),0)::int` })
    .from(I).leftJoin(B, eq(B.id, I.bookingId)).innerJoin(C, eq(C.id, I.customerId)).where(eq(I.tenantId, ctx.tenant.id));
  const open = rows.filter(r => r.paid < r.i.total).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  return (<>
    <PageHead title="Record payment" sub="After saving, the invoice balance, the event and the dashboard all update together." />
    <div className="body narrow">
      <PaymentForm today={todayIST()} selected={sp.invoice} invoices={open.map(r => ({ id: r.i.id, label: `${r.title ?? r.i.docNo} · ${r.date ? fmtDate(r.date) : ''}`, client: r.client, docNo: r.i.docNo, total: r.i.total, paid: r.paid }))} />
      {open.length === 0 && <p className="small muted">Payments are recorded against invoices. Create an invoice from a booking first.</p>}
    </div>
  </>);
}
