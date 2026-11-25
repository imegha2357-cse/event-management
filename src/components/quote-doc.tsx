import type { schema } from '@/db';
import { fmtDate, fmtTime, inr } from '@/lib/util';
import { amountWords, docTotals } from '@/lib/catalog';
import { docCfg, defaultTerms, quoteLabel } from '@/lib/docs';

type Tenant = typeof schema.tenants.$inferSelect;
type Customer = typeof schema.customers.$inferSelect;
type Ev = { title: string; type?: string; date: string; startTime?: string; endTime?: string; venue?: string; guests?: number };

/** A printable quotation or invoice in the company's chosen design. */
export function DocPaper({ kind, tenant, customer, ev, no, date, validUntil, items, discount, gst, gstRate, notes, paid }: {
  kind: 'quote' | 'invoice'; tenant: Tenant; customer: Customer; ev?: Ev | null; no: string; date: string; validUntil?: string;
  items: { desc: string; qty: number; rate: number }[]; discount: number; gst: boolean; gstRate: number; notes?: string; paid?: number;
}) {
  const cfg = docCfg(tenant);
  const x = docTotals(items, discount, gst, gstRate);
  const title = kind === 'quote' ? cfg.quoteTitle : gst ? cfg.invTitleGst : cfg.invTitle;
  const terms = cfg.terms || defaultTerms(kind);
  return (
    <article className={`paper style-${cfg.style}`} style={{ ['--primary' as string]: cfg.colour }} aria-label={`${title} ${no}`}>
      <div className="paper-h">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {tenant.logo && <img src={tenant.logo} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, background: '#fff' }} />}
          <div><h2 style={{ fontSize: 18 }}>{tenant.name}</h2><div className="small muted" style={{ whiteSpace: 'pre-line' }}>{[tenant.address, tenant.city, tenant.phone && `Phone: ${tenant.phone}`].filter(Boolean).join('\n')}{tenant.gstin ? `\nGSTIN ${tenant.gstin}` : ''}</div></div>
        </div>
        <div className="doc"><b>{title}</b><div className="small">No: {no}</div><div className="small">Date: {fmtDate(date)}</div>{validUntil && <div className="small muted">Valid until {fmtDate(validUntil)}</div>}</div>
      </div>
      <div className="meta">
        <div><div className="lbl">{kind === 'quote' ? 'Prepared for' : 'Bill to'}</div><div><b>{customer.name}</b></div><div className="small muted">{customer.phone}{customer.city ? ` · ${customer.city}` : ''}</div></div>
        {ev && <div><div className="lbl">Event</div><div><b>{ev.title}</b>{ev.type && <span className="muted"> ({ev.type})</span>}</div>
          <div className="small">{fmtDate(ev.date)}{ev.startTime ? ` · ${fmtTime(ev.startTime)}${ev.endTime ? ' to ' + fmtTime(ev.endTime) : ''}` : ''}</div>
          <div className="small muted">{ev.venue}{ev.guests ? ` · ${ev.guests} guests` : ''}</div></div>}
      </div>
      <table><thead><tr><th>#</th><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
        <tbody>{items.map((i, n) => <tr key={n}><td className="muted">{n + 1}</td><td>{i.desc}</td><td className="num">{Number(i.qty).toLocaleString('en-IN')}</td><td className="num">{inr(i.rate)}</td><td className="num">{inr(i.qty * i.rate)}</td></tr>)}</tbody>
      </table>
      <div className="totals" style={{ marginTop: 14 }}>
        <span>Subtotal</span><span className="num">{inr(x.subtotal)}</span>
        {x.discount > 0 && <><span>Discount</span><span className="num">−{inr(x.discount)}</span></>}
        {gst && <><span>CGST {x.halfRate}%</span><span className="num">{inr(x.cgst)}</span><span>SGST {x.halfRate}%</span><span className="num">{inr(x.sgst)}</span></>}
        <span className="grand">Total</span><span className="grand num">{inr(x.total)}</span>
        {kind === 'invoice' && paid !== undefined && <><span>Paid</span><span className="num">{inr(paid)}</span><span><b>Balance due</b></span><span className="num"><b>{inr(Math.max(x.total - paid, 0))}</b></span></>}
      </div>
      {cfg.words && <div className="words">{amountWords(x.total)}</div>}
      {notes && <div style={{ marginTop: 14 }}><div className="lbl">Notes</div><p style={{ whiteSpace: 'pre-line' }}>{notes}</p></div>}
      <div className="foot"><div>{terms}</div>{cfg.sign && <div className="sign">For {tenant.name}<span>Authorised signatory</span></div>}</div>
    </article>
  );
}

/** Quotation as the customer sees it (used in the app and on the public review page). */
export function QuoteDocument({ q, tenant, customer }: { q: typeof schema.quotations.$inferSelect; tenant: Tenant; customer: Customer }) {
  return <DocPaper kind="quote" tenant={tenant} customer={customer} no={quoteLabel(tenant, q.number)} date={q.createdAt.toISOString().slice(0, 10)} validUntil={q.validUntil}
    ev={{ title: q.eventTitle, type: q.eventType, date: q.eventDate, startTime: q.startTime, endTime: q.endTime, venue: q.venue, guests: q.guests }}
    items={q.items} discount={q.discount} gst={q.gst} gstRate={q.gstRate} notes={q.notes} />;
}
