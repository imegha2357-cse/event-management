import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead, Badge, Empty } from '@/components/page';
import { ActionButton } from '@/components/action-form';
import { fmtDate, fmtDateTime, fmtTime, inr, bookingNo, quoteNo } from '@/lib/util';
import { MAX_ATTEMPTS, whatsappConfigured } from '@/lib/whatsapp';
import { bookingStatusAction, removeCrewAction, retryNotificationAction, togglePresentAction } from '../../actions';
import { AssignCrewForm, CrewNeededForm, FixPhoneForm } from './crew';

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { db, tenant } = await requireUser();
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
    label: s.kind === 'permanent' ? `${s.name} (+${allStaff.filter(h => h.leaderId === s.id).length} helpers)` : `${s.name} · brought by ${leaders.find(l => l.id === s.leaderId)?.name ?? '—'}`,
  }));
  const present = crew.filter(x => x.c.present).length;
  const wages = crew.filter(x => x.c.present).reduce((a, x) => a + x.c.wage, 0);

  return (
    <>
      <PageHead title={b.title} badge={<Badge s={b.status} />} sub={<>{bookingNo(b.number)} · {customer.name} · {fmtDate(b.eventDate)}</>}
        actions={<>
          {b.status === 'Confirmed' && <ActionButton action={bookingStatusAction} fields={{ rid: b.id, status: 'Completed' }} label="Mark completed" />}
          {b.status === 'Confirmed' && <ActionButton action={bookingStatusAction} fields={{ rid: b.id, status: 'Cancelled' }} label="Cancel booking" className="btn danger" confirm="Cancel this booking? The customer is not notified automatically." />}
          {b.status !== 'Confirmed' && <ActionButton action={bookingStatusAction} fields={{ rid: b.id, status: 'Confirmed' }} label="Reopen booking" />}
        </>} />
      <div className="body">
        {sp.new && <div className="formok">Booking created from the accepted quotation.</div>}
        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel"><div className="panel-h"><h2>Event details</h2></div>
              <div className="panel-b"><dl className="dl">
                <dt>Customer</dt><dd><Link href={`/customers/${customer.id}`}>{customer.name}</Link> · {customer.phone}</dd>
                <dt>Event</dt><dd>{b.eventType}</dd>
                <dt>Date & time</dt><dd>{fmtDate(b.eventDate)}{b.startTime && ` · ${fmtTime(b.startTime)}${b.endTime ? '–' + fmtTime(b.endTime) : ''}`}</dd>
                <dt>Venue</dt><dd>{b.venue}</dd>
                <dt>Guests</dt><dd>{b.guests || '—'}</dd>
                <dt>Amount</dt><dd><b>{inr(b.total)}</b></dd>
                {quote && <><dt>Quotation</dt><dd><Link href={`/quotations/${quote.id}`}>{quoteNo(quote.number)}</Link> · accepted {fmtDateTime(quote.decidedAt)}</dd></>}
                {b.notes && <><dt>Notes</dt><dd style={{ whiteSpace: 'pre-line' }}>{b.notes}</dd></>}
              </dl></div>
            </div>
            <div className="panel">
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
                      <td><ActionButton action={togglePresentAction} fields={{ rid: c.id, present: String(!c.present) }} className={'btn sm' + (c.present ? ' good' : '')} label={c.present ? '✓ Present' : 'Mark present'} /></td>
                      <td className="num"><ActionButton action={removeCrewAction} fields={{ rid: c.id }} className="btn sm danger" label="Remove" /></td></tr>))}
                </tbody></table>)}
              {b.status !== 'Cancelled' && <div className="panel-b" style={{ borderTop: '1px solid var(--line)' }}><AssignCrewForm bookingId={b.id} options={options} /></div>}
            </div>
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
