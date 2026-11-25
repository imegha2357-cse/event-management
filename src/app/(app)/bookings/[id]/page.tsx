import { Fragment } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { Gate } from '@/components/locked';
import { AutoSelect } from '@/components/auto-select';
import { quoteLabel } from '@/lib/docs';
import { has, isEnt, perk } from '@/lib/plans';
import { BASE_STATUSES, SVC } from '@/lib/catalog';
import { moneyByBooking, moneyStatus } from '@/lib/money';
import { setBookingStatusAction, deleteBookingAction } from '../actions';
import { PageHead, Badge, Empty } from '@/components/page';
import { ActionButton } from '@/components/action-form';
import { fmtDate, fmtDateTime, fmtTime, inr, bookingNo, waNumber } from '@/lib/util';
import { MAX_ATTEMPTS, whatsappConfigured } from '@/lib/whatsapp';
import { removeCrewAction, retryNotificationAction, togglePresentAction } from '../../actions';
import { AssignCrewForm, CrewNeededForm, FixPhoneForm } from './crew';

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'events'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { db, tenant, custom } = ctx;
  const [b] = await db.select().from(schema.bookings).where(and(eq(schema.bookings.id, id), eq(schema.bookings.tenantId, tenant.id))).limit(1);
  if (!b) notFound();
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, b.customerId)).limit(1);
  const [quote] = b.quotationId ? await db.select().from(schema.quotations).where(eq(schema.quotations.id, b.quotationId)).limit(1) : [];
  const notes = await db.select().from(schema.notifications).where(eq(schema.notifications.bookingId, b.id)).orderBy(desc(schema.notifications.createdAt));
  const crew = await db.select({ c: schema.bookingCrew, s: schema.staff }).from(schema.bookingCrew).innerJoin(schema.staff, eq(schema.staff.id, schema.bookingCrew.staffId))
    .where(eq(schema.bookingCrew.bookingId, b.id)).orderBy(asc(schema.staff.kind), asc(schema.staff.name));
  const allStaff = await db.select().from(schema.staff).where(eq(schema.staff.tenantId, tenant.id)).orderBy(asc(schema.staff.name));
  const assigned = new Set(crew.map(x => x.s.id));
  const leaders = allStaff.filter(s => s.kind === 'permanent');
  const options = allStaff.filter(s => !assigned.has(s.id)).map(s => ({
    id: s.id, group: s.kind === 'permanent' ? 'Permanent employees' : 'Helper boys',
    label: s.kind === 'permanent' ? `${s.name} (+${allStaff.filter(h => h.leaderId === s.id).length} helpers)` : `${s.name} · brought by ${leaders.find(l => l.id === s.leaderId)?.name ?? '-'}`,
  }));
  const invs = await db.select().from(schema.invoices).where(eq(schema.invoices.bookingId, b.id));
  const exps = await db.select().from(schema.expenses).where(eq(schema.expenses.bookingId, b.id)).orderBy(desc(schema.expenses.spentOn));
  const m = (await moneyByBooking(ctx, [b.id])).get(b.id)!;
  const ent = isEnt(tenant);
  const statuses = [...BASE_STATUSES, ...(ent ? custom.statuses ?? [] : [])];
  const branch = ent ? (custom.branches ?? []).find(x => x.id === b.branchId) : undefined;
  const showCrew = has(tenant, 'staff');
  const showFinance = has(tenant, 'payments');
  const present = crew.filter(x => x.c.present).length;
  const wages = crew.filter(x => x.c.present).reduce((a, x) => a + x.c.wage, 0);

  return (
    <>
      <PageHead title={b.title} badge={<Badge s={b.status} />} sub={<>{bookingNo(b.number)} · {customer.name} · {fmtDate(b.eventDate)}</>}
        actions={<>
          <AutoSelect action={setBookingStatusAction} fields={{ rid: b.id }} name="status" value={b.status} options={statuses} label="Booking status" />
          {!b.quotationId && <Link className="btn" href={`/quotations/new?booking=${b.id}`}>Make quotation</Link>}
          {invs[0] ? <Link className="btn" href={`/invoices/${invs[0].id}`}>Invoice {invs[0].docNo}</Link> : <Link className="btn primary" href={`/invoices/new?booking=${b.id}`}>Create invoice</Link>}
          {!b.quotationId && !invs.length && <ActionButton action={deleteBookingAction} fields={{ rid: b.id }} label="Delete" className="btn danger" confirm="Delete this event? This cannot be undone." />}
        </>} />
      <div className="body">
        {sp.new && <div className="formok">Booking created from the accepted quotation.</div>}
        {sp.saved && <div className="formok">Saved.</div>}
        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel"><div className="panel-h"><h2>Event details</h2></div>
              <div className="panel-b"><dl className="dl">
                <dt>Customer</dt><dd><Link href={`/customers/${customer.id}`}>{customer.name}</Link> · {customer.phone}</dd>
                <dt>Event</dt><dd>{b.eventType}</dd>
                <dt>Date & time</dt><dd>{fmtDate(b.eventDate)}{b.startTime && ` · ${fmtTime(b.startTime)}${b.endTime ? ' to ' + fmtTime(b.endTime) : ''}`}</dd>
                <dt>Venue</dt><dd>{b.venue}</dd>
                <dt>Guests</dt><dd>{b.guests || 'Not set'}</dd>
                {b.setupTime && <><dt>Setup from</dt><dd>{fmtTime(b.setupTime)}</dd></>}
                {(b.services ?? []).length > 0 && <><dt>Services</dt><dd><div className="chips">{b.services.map(k => <span key={k} className="chip">{SVC[k]?.name ?? k}</span>)}</div></dd></>}
                {branch && <><dt>Branch</dt><dd>{branch.name}</dd></>}
                {ent && (custom.eventFields ?? []).filter(f => b.custom?.[f.id]).map(f => <Fragment key={f.id}><dt>{f.label}</dt><dd>{b.custom[f.id]}</dd></Fragment>)}
                <dt>Amount</dt><dd><b>{b.total ? inr(b.total) : 'Not set'}</b></dd>
                {quote && <><dt>Quotation</dt><dd><Link href={`/quotations/${quote.id}`}>{quoteLabel(tenant, quote.number)}</Link> · accepted {fmtDateTime(quote.decidedAt)}</dd></>}
                {b.notes && <><dt>Notes</dt><dd style={{ whiteSpace: 'pre-line' }}>{b.notes}</dd></>}
              </dl></div>
            </div>
            <div className="panel"><div className="panel-h"><h2>Money</h2><span className={`badge ${moneyStatus(m)}`}>{moneyStatus(m)}</span></div>
              <div className="panel-b"><div className="grid4">
                <div><div className="small muted">Quote / invoiced</div><b>{inr(m.quote)}</b></div><div><div className="small muted">Received</div><b>{inr(m.received)}</b></div>
                <div><div className="small muted">Spent</div><b>{inr(m.spent)}</b></div><div><div className="small muted">Profit so far</div><b>{inr(m.profit)}</b></div>
              </div>
              <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${m.quote ? Math.min(100, (m.received / m.quote) * 100) : 0}%` }} /></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {showFinance && m.invoiceId && m.pending > 0 && <Link className="btn primary sm" href={`/finance/payment?invoice=${m.invoiceId}`}>Record payment</Link>}
                {showFinance && <Link className="btn sm" href={`/finance/expense?booking=${b.id}`}>Add expense</Link>}
                {showFinance && m.pending > 0 && perk(tenant, 'whatsappShare') && customer.phone && <a className="btn sm good" target="_blank" rel="noopener noreferrer"
                  href={`https://wa.me/${waNumber(customer.phone)}?text=${encodeURIComponent(`Vanakkam ${customer.name}, a gentle reminder from ${tenant.name}: ${inr(m.pending)} is pending for ${b.title} on ${fmtDate(b.eventDate)}. Thank you!`)}`}>Send WhatsApp reminder</a>}
                {!showFinance && <span className="small muted">Payments, expenses and profit tracking come with the Pro plan.</span>}
              </div></div>
              {exps.length > 0 && <table><thead><tr><th>Expense</th><th>Category</th><th>Date</th><th className="num">Amount</th></tr></thead><tbody>
                {exps.map(x => <tr key={x.id}><td>{x.item}{x.bill && <span className="chip" style={{ marginLeft: 6 }}>Bill photo</span>}<div className="small muted">{x.paidTo}</div></td><td>{x.category}</td><td className="nowrap">{fmtDate(x.spentOn)}</td><td className="num">{inr(x.amount)}</td></tr>)}
              </tbody></table>}
            </div>
            {showCrew && <div className="panel">
              <div className="panel-h"><div><h2>Crew</h2><div className="small muted">{crew.length} assigned · {present} present · wages due {inr(wages)}</div></div><CrewNeededForm bookingId={b.id} value={b.crewNeeded} /></div>
              <div className="panel-b" style={{ borderBottom: '1px solid var(--line)' }}>
                <div className="meter" role="img" aria-label={`${crew.length} of ${b.crewNeeded} crew assigned, ${present} present`}>
                  <span style={{ width: `${Math.min(100, (present / Math.max(b.crewNeeded, crew.length, 1)) * 100)}%`, background: 'var(--good)' }} />
                  <span style={{ width: `${Math.min(100, ((crew.length - present) / Math.max(b.crewNeeded, crew.length, 1)) * 100)}%`, background: 'var(--primary)' }} />
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>{crew.length} of {b.crewNeeded} assigned{b.crewNeeded > crew.length ? ` · ${b.crewNeeded - crew.length} still needed` : ''}</div>
              </div>
              {crew.length === 0 ? <Empty title="No crew assigned yet">{allStaff.length === 0 && <Link href="/staff">Add your staff first</Link>}</Empty> : (
                <table><thead><tr><th>Name</th><th>Role</th><th className="num">Daily wage</th><th>Attendance</th><th /></tr></thead><tbody>
                  {crew.map(({ c, s }) => (
                    <tr key={c.id}><td>{s.name}<div className="small muted">{s.phone}</div></td><td>{s.kind === 'permanent' ? 'Permanent' : `Helper · ${leaders.find(l => l.id === s.leaderId)?.name ?? ''}`}</td>
                      <td className="num">{inr(c.wage)}</td>
                      <td><ActionButton action={togglePresentAction} fields={{ rid: c.id, present: String(!c.present) }} className={'btn sm' + (c.present ? ' good' : '')} label={c.present ? <><Icon name="check" size={14} /> Present</> : 'Mark present'} /></td>
                      <td className="num"><ActionButton action={removeCrewAction} fields={{ rid: c.id }} className="btn sm danger" label="Remove" /></td></tr>))}
                </tbody></table>)}
              {b.status !== 'Cancelled' && <div className="panel-b" style={{ borderTop: '1px solid var(--line)' }}><AssignCrewForm bookingId={b.id} options={options} /></div>}
            </div>}
          </div>
          <div className="panel" id="whatsapp"><div className="panel-h"><h2>WhatsApp confirmation</h2></div>
            <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!whatsappConfigured() && <div className="notice small">WhatsApp is not connected on this server yet, so messages are saved and marked as failed. They can be retried once it is connected.</div>}
              {notes.length === 0 && <p className="muted small">No message has been sent for this booking.</p>}
              {notes.map(n => (
                <div key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Badge s={n.status} /><span className="small muted">To +{n.toPhone}</span></div>
                  <p className="small" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 4, padding: 10 }}>{n.body}</p>
                  <div className="small muted">{n.status === 'sent' ? `Delivered to WhatsApp ${fmtDateTime(n.sentAt)}` : `Attempts: ${n.attempts} of ${MAX_ATTEMPTS} automatic · last tried ${fmtDateTime(n.updatedAt)}`}</div>
                  {n.status !== 'sent' && n.lastError && <div className="formerror small">{n.lastError}</div>}
                  {n.status !== 'sent' && <ActionButton action={retryNotificationAction} fields={{ rid: n.id }} label="Retry now" pendingText="Sending…" className="btn primary" inline={false} />}
                  {n.status !== 'sent' && <FixPhoneForm id={n.id} phone={n.toPhone} />}
                </div>))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
