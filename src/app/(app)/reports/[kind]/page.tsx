import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq, gte, lte, notInArray, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate, type Ctx } from '@/lib/session';
import { Gate } from '@/components/locked';
import { Empty } from '@/components/page';
import { ReportFrame, Kpis } from '@/components/report';
import { REPORTS, type ReportKey } from '@/lib/plans';
import { NOT_BOOKINGS } from '@/lib/catalog';
import { quoteLabel } from '@/lib/docs';
import { rangeFrom, daysBetween, type Range } from '@/lib/reports';
import { bookingNo, fmtDate, inr, todayIST } from '@/lib/util';

type SP = { preset?: string; from?: string; to?: string; print?: string };
export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: `${REPORTS.find(r => r.key === kind)?.label ?? 'Report'} report` };
}

export default async function Report({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<SP> }) {
  const [{ kind }, sp] = await Promise.all([params, searchParams]);
  const def = REPORTS.find(r => r.key === kind);
  if (!def) notFound();
  const ctx = await requireUser();
  const g = gate(ctx, 'reportbook') ?? gate(ctx, def.module); if (g) return <Gate g={g} plan={ctx.plan} />;
  const range = rangeFrom(sp.preset || sp.from || sp.to ? sp : { preset: kind === 'dues' ? 'all' : 'fy' });
  const body = await BODY[def.key as ReportKey](ctx, range);
  return (
    <ReportFrame tenant={ctx.tenant} title={`${def.label} report`} about={def.about} kind={def.key} range={range} asOf={kind === 'dues'} print={sp.print === '1'}>
      {body}
    </ReportFrame>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const istDate = (col: unknown) => sql`(${col} at time zone 'Asia/Kolkata')::date`;
function Group({ title, rows }: { title: string; rows: [string, number, number?][] }) {
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + r[1], 0);
  return (
    <div className="report-group"><h3>{title}</h3>
      <table className="rtable"><tbody>
        {rows.map(([k, v, n]) => <tr key={k}><td>{k}{n !== undefined && <span className="muted"> · {n}</span>}</td><td className="num">{inr(v)}</td><td className="num muted">{pct(v, total)}</td></tr>)}
      </tbody></table></div>
  );
}
const by = <T,>(xs: T[], key: (x: T) => string, val: (x: T) => number) => {
  const m = new Map<string, [number, number]>();
  for (const x of xs) { const k = key(x) || 'Other'; const c = m.get(k) ?? [0, 0]; m.set(k, [c[0] + val(x), c[1] + 1]); }
  return [...m].sort((a, b) => b[1][0] - a[1][0]).map(([k, [v, n]]) => [k, v, n] as [string, number, number]);
};

const BODY: Record<ReportKey, (ctx: Ctx, r: Range) => Promise<React.ReactNode>> = {
  /* ---------- Bookings ---------- */
  async bookings({ db, tenant }, r) {
    const B = schema.bookings, C = schema.customers;
    const rows = await db.select({ b: B, customer: C.name, phone: C.phone }).from(B).leftJoin(C, eq(C.id, B.customerId))
      .where(and(eq(B.tenantId, tenant.id), notInArray(B.status, NOT_BOOKINGS), gte(B.eventDate, r.from), lte(B.eventDate, r.to))).orderBy(asc(B.eventDate), asc(B.number));
    if (!rows.length) return <Empty title="No bookings in this period" />;
    const live = rows.filter(x => x.b.status !== 'Cancelled');
    const count = (s: string) => rows.filter(x => x.b.status === s).length;
    return (<>
      <Kpis items={[['Bookings', rows.length], ['Confirmed', count('Confirmed')], ['Completed', count('Completed')], ['Cancelled', count('Cancelled')], ['Value (not cancelled)', inr(live.reduce((s, x) => s + x.b.total, 0))]]} />
      <table className="rtable"><thead><tr><th>Booking</th><th>Event date</th><th>Event</th><th>Customer</th><th>Venue</th><th>Status</th><th className="num">Value</th></tr></thead><tbody>
        {rows.map(({ b, customer, phone }) => <tr key={b.id} className={b.status === 'Cancelled' ? 'struck' : ''}>
          <td className="nowrap"><Link href={`/bookings/${b.id}`}>{bookingNo(b.number)}</Link></td><td className="nowrap">{fmtDate(b.eventDate)}</td>
          <td>{b.title}<div className="small muted">{b.eventType}{b.guests ? ` · ${b.guests} guests` : ''}</div></td>
          <td>{customer}<div className="small muted">{phone}</div></td><td>{b.venue}</td><td>{b.status}</td><td className="num">{inr(b.total)}</td></tr>)}
      </tbody><tfoot><tr><td colSpan={6}>Total ({live.length} not cancelled)</td><td className="num">{inr(live.reduce((s, x) => s + x.b.total, 0))}</td></tr></tfoot></table>
    </>);
  },

  /* ---------- Quotations ---------- */
  async quotations({ db, tenant }, r) {
    const Q = schema.quotations, C = schema.customers;
    const rows = await db.select({ q: Q, customer: C.name }).from(Q).leftJoin(C, eq(C.id, Q.customerId))
      .where(and(eq(Q.tenantId, tenant.id), gte(istDate(Q.createdAt), r.from), lte(istDate(Q.createdAt), r.to))).orderBy(asc(Q.createdAt));
    if (!rows.length) return <Empty title="No quotations created in this period" />;
    const of = (s: string[]) => rows.filter(x => s.includes(x.q.status));
    const acc = of(['Accepted']), dec = of(['Declined']), open = of(['Draft', 'Sent']);
    const val = (xs: typeof rows) => xs.reduce((s, x) => s + x.q.total, 0);
    return (<>
      <Kpis items={[['Quotations', rows.length], ['Accepted', `${acc.length} · ${inr(val(acc))}`], ['Declined', `${dec.length} · ${inr(val(dec))}`], ['Waiting', `${open.length} · ${inr(val(open))}`], ['Acceptance rate', pct(acc.length, acc.length + dec.length)]]} />
      <table className="rtable"><thead><tr><th>Quotation</th><th>Created</th><th>Customer</th><th>Event</th><th>Event date</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>
        {rows.map(({ q, customer }) => <tr key={q.id}><td className="nowrap"><Link href={`/quotations/${q.id}`}>{quoteLabel(tenant, q.number)}</Link></td>
          <td className="nowrap">{fmtDate(q.createdAt)}</td><td>{customer}</td><td>{q.eventTitle}<div className="small muted">{q.eventType}</div></td><td className="nowrap">{fmtDate(q.eventDate)}</td>
          <td>{q.status}{q.status === 'Declined' && q.declineReason ? <div className="small muted">{q.declineReason}</div> : null}</td><td className="num">{inr(q.total)}</td></tr>)}
      </tbody><tfoot><tr><td colSpan={6}>Total quoted</td><td className="num">{inr(val(rows))}</td></tr></tfoot></table>
    </>);
  },

  /* ---------- Sales & GST ---------- */
  async sales({ db, tenant }, r) {
    const I = schema.invoices, C = schema.customers;
    const rows = await db.select({ i: I, customer: C.name }).from(I).leftJoin(C, eq(C.id, I.customerId))
      .where(and(eq(I.tenantId, tenant.id), gte(I.issuedOn, r.from), lte(I.issuedOn, r.to))).orderBy(asc(I.issuedOn), asc(I.number));
    if (!rows.length) return <Empty title="No invoices in this period" />;
    const t = rows.map(({ i, customer }) => { const cgst = Math.round(i.tax / 2); return { i, customer, taxable: i.total - i.tax, cgst, sgst: i.tax - cgst }; });
    const sum = (k: 'taxable' | 'cgst' | 'sgst') => t.reduce((s, x) => s + x[k], 0);
    const total = rows.reduce((s, x) => s + x.i.total, 0);
    const rates = by(t.filter(x => x.i.gst), x => `GST ${x.i.gstRate}%`, x => x.taxable);
    return (<>
      <Kpis items={[['Invoices', rows.length], ['Taxable value', inr(sum('taxable'))], ['CGST', inr(sum('cgst'))], ['SGST', inr(sum('sgst'))], ['Invoice total', inr(total)]]} />
      <table className="rtable"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th className="num">Taxable</th><th className="num">GST %</th><th className="num">CGST</th><th className="num">SGST</th><th className="num">Total</th></tr></thead><tbody>
        {t.map(x => <tr key={x.i.id}><td className="nowrap"><Link href={`/invoices/${x.i.id}`}>{x.i.docNo}</Link></td><td className="nowrap">{fmtDate(x.i.issuedOn)}</td><td>{x.customer}</td>
          <td className="num">{inr(x.taxable)}</td><td className="num">{x.i.gst ? `${x.i.gstRate}%` : '-'}</td><td className="num">{inr(x.cgst)}</td><td className="num">{inr(x.sgst)}</td><td className="num">{inr(x.i.total)}</td></tr>)}
      </tbody><tfoot><tr><td colSpan={3}>Total</td><td className="num">{inr(sum('taxable'))}</td><td /><td className="num">{inr(sum('cgst'))}</td><td className="num">{inr(sum('sgst'))}</td><td className="num">{inr(total)}</td></tr></tfoot></table>
      <div className="report-groups"><Group title="Taxable value by GST rate" rows={rates} />
        <Group title="Without GST" rows={t.some(x => !x.i.gst) ? [['Invoices without GST', t.filter(x => !x.i.gst).reduce((s, x) => s + x.taxable, 0), t.filter(x => !x.i.gst).length]] : []} /></div>
      <p className="small muted">CGST and SGST are each half of the GST on the invoice (supply within the state).</p>
    </>);
  },

  /* ---------- Pending payments ---------- */
  async dues({ db, tenant }, r) {
    const I = schema.invoices, C = schema.customers, B = schema.bookings;
    const all = await db.select({ i: I, customer: C.name, phone: C.phone, event: B.title, paid: sql<number>`coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = "invoices"."id"),0)::int` })
      .from(I).leftJoin(C, eq(C.id, I.customerId)).leftJoin(B, eq(B.id, I.bookingId))
      .where(and(eq(I.tenantId, tenant.id), gte(I.issuedOn, r.from), lte(I.issuedOn, r.to)));
    const today = todayIST();
    const rows = all.map(x => ({ ...x, bal: x.i.total - x.paid, days: Math.max(0, daysBetween(x.i.issuedOn, today)) })).filter(x => x.bal > 0).sort((a, b) => b.days - a.days);
    if (!rows.length) return <Empty title="Nothing pending">Every invoice in this period is fully paid.</Empty>;
    const bucket = (d: number) => (d <= 30 ? '0 to 30 days' : d <= 60 ? '31 to 60 days' : d <= 90 ? '61 to 90 days' : 'Over 90 days');
    const bal = rows.reduce((s, x) => s + x.bal, 0);
    return (<>
      <Kpis items={[['Invoices with balance', rows.length], ['Billed', inr(rows.reduce((s, x) => s + x.i.total, 0))], ['Received', inr(rows.reduce((s, x) => s + x.paid, 0))], ['Still to collect', inr(bal)]]} />
      <table className="rtable"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Event</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th><th className="num">Days</th></tr></thead><tbody>
        {rows.map(x => <tr key={x.i.id}><td className="nowrap"><Link href={`/invoices/${x.i.id}`}>{x.i.docNo}</Link></td><td className="nowrap">{fmtDate(x.i.issuedOn)}</td>
          <td>{x.customer}<div className="small muted">{x.phone}</div></td><td>{x.event ?? '-'}</td><td className="num">{inr(x.i.total)}</td><td className="num">{inr(x.paid)}</td>
          <td className="num"><b>{inr(x.bal)}</b></td><td className={`num${x.days > 60 ? ' bad' : ''}`}>{x.days}</td></tr>)}
      </tbody><tfoot><tr><td colSpan={6}>Total still to collect</td><td className="num">{inr(bal)}</td><td /></tr></tfoot></table>
      <div className="report-groups"><Group title="By age (days since invoice)" rows={['0 to 30 days', '31 to 60 days', '61 to 90 days', 'Over 90 days'].map(k => [k, rows.filter(x => bucket(x.days) === k).reduce((s, x) => s + x.bal, 0), rows.filter(x => bucket(x.days) === k).length] as [string, number, number]).filter(x => x[2])} /></div>
    </>);
  },

  /* ---------- Payments received ---------- */
  async collections({ db, tenant }, r) {
    const P = schema.invoicePayments, I = schema.invoices, C = schema.customers;
    const rows = await db.select({ p: P, docNo: I.docNo, invId: I.id, customer: C.name }).from(P).innerJoin(I, eq(I.id, P.invoiceId)).leftJoin(C, eq(C.id, I.customerId))
      .where(and(eq(P.tenantId, tenant.id), gte(P.paidOn, r.from), lte(P.paidOn, r.to))).orderBy(asc(P.paidOn), asc(P.createdAt));
    if (!rows.length) return <Empty title="No payments received in this period" />;
    const total = rows.reduce((s, x) => s + x.p.amount, 0);
    return (<>
      <Kpis items={[['Payments', rows.length], ['Total received', inr(total)], ['Customers who paid', new Set(rows.map(x => x.customer)).size]]} />
      <table className="rtable"><thead><tr><th>Date</th><th>Type</th><th>Invoice</th><th>Customer</th><th>Mode</th><th>Reference</th><th className="num">Amount</th></tr></thead><tbody>
        {rows.map(x => <tr key={x.p.id}><td className="nowrap">{fmtDate(x.p.paidOn)}</td><td>{x.p.kind}</td><td className="nowrap"><Link href={`/invoices/${x.invId}`}>{x.docNo}</Link></td>
          <td>{x.customer}</td><td>{x.p.mode}</td><td>{x.p.reference || '-'}</td><td className="num">{inr(x.p.amount)}</td></tr>)}
      </tbody><tfoot><tr><td colSpan={6}>Total received</td><td className="num">{inr(total)}</td></tr></tfoot></table>
      <div className="report-groups"><Group title="By payment mode" rows={by(rows, x => x.p.mode, x => x.p.amount)} /><Group title="By type" rows={by(rows, x => x.p.kind, x => x.p.amount)} /></div>
    </>);
  },

  /* ---------- Expenses ---------- */
  async expenses({ db, tenant }, r) {
    const E = schema.expenses, B = schema.bookings;
    const rows = await db.select({ e: E, event: B.title }).from(E).leftJoin(B, eq(B.id, E.bookingId))
      .where(and(eq(E.tenantId, tenant.id), gte(E.spentOn, r.from), lte(E.spentOn, r.to))).orderBy(asc(E.spentOn), asc(E.createdAt));
    if (!rows.length) return <Empty title="No expenses in this period" />;
    const total = rows.reduce((s, x) => s + x.e.amount, 0);
    return (<>
      <Kpis items={[['Expense entries', rows.length], ['Total spent', inr(total)], ['Linked to events', inr(rows.filter(x => x.e.bookingId).reduce((s, x) => s + x.e.amount, 0))], ['General (no event)', inr(rows.filter(x => !x.e.bookingId).reduce((s, x) => s + x.e.amount, 0))]]} />
      <table className="rtable"><thead><tr><th>Date</th><th>Category</th><th>What for</th><th>Paid to</th><th>Event</th><th>Mode</th><th className="num">Amount</th></tr></thead><tbody>
        {rows.map(x => <tr key={x.e.id}><td className="nowrap">{fmtDate(x.e.spentOn)}</td><td>{x.e.category}</td><td>{x.e.item}{x.e.source === 'staff' ? <div className="small muted">Staff wages</div> : null}</td>
          <td>{x.e.paidTo || '-'}</td><td>{x.event ?? '-'}</td><td>{x.e.mode}</td><td className="num">{inr(x.e.amount)}</td></tr>)}
      </tbody><tfoot><tr><td colSpan={6}>Total spent</td><td className="num">{inr(total)}</td></tr></tfoot></table>
      <div className="report-groups"><Group title="By category" rows={by(rows, x => x.e.category, x => x.e.amount)} /><Group title="By event" rows={by(rows, x => x.event ?? 'General (no event)', x => x.e.amount)} /></div>
    </>);
  },

  /* ---------- Profit per event ---------- */
  async profit({ db, tenant }, r) {
    const B = schema.bookings, C = schema.customers;
    const bookings = await db.select({ b: B, customer: C.name }).from(B).leftJoin(C, eq(C.id, B.customerId))
      .where(and(eq(B.tenantId, tenant.id), notInArray(B.status, NOT_BOOKINGS), gte(B.eventDate, r.from), lte(B.eventDate, r.to))).orderBy(asc(B.eventDate));
    const invs = await db.select({ b: schema.invoices.bookingId, net: sql<number>`(${schema.invoices.total} - ${schema.invoices.tax})::int` }).from(schema.invoices).where(eq(schema.invoices.tenantId, tenant.id));
    const exps = await db.select({ b: schema.expenses.bookingId, a: schema.expenses.amount }).from(schema.expenses).where(eq(schema.expenses.tenantId, tenant.id));
    const general = await db.select({ s: sql<number>`coalesce(sum(${schema.expenses.amount}),0)::int` }).from(schema.expenses)
      .where(and(eq(schema.expenses.tenantId, tenant.id), sql`${schema.expenses.bookingId} is null`, gte(schema.expenses.spentOn, r.from), lte(schema.expenses.spentOn, r.to)));
    const rows = bookings.map(({ b, customer }) => {
      const inc = invs.filter(i => i.b === b.id).reduce((s, i) => s + i.net, 0), exp = exps.filter(e => e.b === b.id).reduce((s, e) => s + e.a, 0);
      return { b, customer, inc, exp, profit: inc - exp };
    }).filter(x => x.inc || x.exp || x.b.status !== 'Cancelled');
    if (!rows.length) return <Empty title="No events in this period" />;
    const sum = (k: 'inc' | 'exp' | 'profit') => rows.reduce((s, x) => s + x[k], 0);
    const gen = general[0]?.s ?? 0;
    return (<>
      <Kpis items={[['Events', rows.length], ['Income (before GST)', inr(sum('inc'))], ['Event expenses', inr(sum('exp'))], ['Event profit', inr(sum('profit'))], ['Margin', pct(sum('profit'), sum('inc'))]]} />
      <table className="rtable"><thead><tr><th>Event date</th><th>Event</th><th>Customer</th><th className="num">Income</th><th className="num">Expenses</th><th className="num">Profit</th><th className="num">Margin</th></tr></thead><tbody>
        {rows.map(x => <tr key={x.b.id}><td className="nowrap">{fmtDate(x.b.eventDate)}</td><td><Link href={`/bookings/${x.b.id}`}>{x.b.title}</Link><div className="small muted">{x.b.status}</div></td><td>{x.customer}</td>
          <td className="num">{inr(x.inc)}</td><td className="num">{inr(x.exp)}</td><td className={`num${x.profit < 0 ? ' bad' : ''}`}><b>{inr(x.profit)}</b></td><td className="num">{pct(x.profit, x.inc)}</td></tr>)}
      </tbody><tfoot>
        <tr><td colSpan={3}>Total for events</td><td className="num">{inr(sum('inc'))}</td><td className="num">{inr(sum('exp'))}</td><td className="num">{inr(sum('profit'))}</td><td className="num">{pct(sum('profit'), sum('inc'))}</td></tr>
        {gen > 0 && <tr><td colSpan={4}>General expenses in this period (not linked to an event)</td><td className="num">{inr(gen)}</td><td className="num">{inr(-gen)}</td><td /></tr>}
        {gen > 0 && <tr><td colSpan={5}>Overall profit</td><td className="num">{inr(sum('profit') - gen)}</td><td /></tr>}
      </tfoot></table>
      <p className="small muted">Income is counted before GST, because the tax is not your money. Events are included by event date; general expenses by the date spent.</p>
    </>);
  },
};
