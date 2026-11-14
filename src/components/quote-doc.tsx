import type { schema } from '@/db';
import { fmtDate, fmtTime, inr, quoteNo } from '@/lib/util';

type Q = typeof schema.quotations.$inferSelect;
type T = typeof schema.tenants.$inferSelect;
type C = typeof schema.customers.$inferSelect;

/** The quotation as the customer sees it (used in the app and on the public review page). */
export function QuoteDocument({ q, tenant, customer }: { q: Q; tenant: T; customer: C }) {
  return (
    <article className="paper" aria-label={`Quotation ${quoteNo(q.number)}`}>
      <div className="paper-h">
        <div><h2 style={{ fontSize: 18 }}>{tenant.name}</h2><div className="small muted" style={{ whiteSpace: 'pre-line' }}>{[tenant.address, tenant.city, tenant.phone].filter(Boolean).join('\n')}{tenant.gstin ? `\nGSTIN ${tenant.gstin}` : ''}</div></div>
        <div className="doc"><b>QUOTATION</b><div className="small">{quoteNo(q.number)}</div><div className="small muted">Valid until {fmtDate(q.validUntil)}</div></div>
      </div>
      <div className="meta">
        <div><div className="lbl">Prepared for</div><div><b>{customer.name}</b></div><div className="small muted">{customer.phone}{customer.city ? ` · ${customer.city}` : ''}</div></div>
        <div><div className="lbl">Event</div><div><b>{q.eventTitle}</b> <span className="muted">({q.eventType})</span></div>
          <div className="small">{fmtDate(q.eventDate)}{q.startTime ? ` · ${fmtTime(q.startTime)}${q.endTime ? '–' + fmtTime(q.endTime) : ''}` : ''}</div>
          <div className="small muted">{q.venue}{q.guests ? ` · ${q.guests} guests` : ''}</div></div>
      </div>
      <table><thead><tr><th>#</th><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
        <tbody>{q.items.map((i, n) => <tr key={n}><td className="muted">{n + 1}</td><td>{i.desc}</td><td className="num">{i.qty}</td><td className="num">{inr(i.rate)}</td><td className="num">{inr(i.qty * i.rate)}</td></tr>)}</tbody>
      </table>
      <div className="totals" style={{ marginTop: 14 }}>
        <span>Subtotal</span><span className="num">{inr(q.subtotal)}</span>
        {q.discount > 0 && <><span>Discount</span><span className="num">−{inr(q.discount)}</span></>}
        <span className="grand">Total</span><span className="grand num">{inr(q.total)}</span>
      </div>
      {q.notes && <div style={{ marginTop: 18 }}><div className="lbl">Notes</div><p style={{ whiteSpace: 'pre-line' }}>{q.notes}</p></div>}
    </article>
  );
}
