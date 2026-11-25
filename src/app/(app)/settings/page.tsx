import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { NoAccess } from '@/components/locked';
import { perk } from '@/lib/plans';
import { DOC_STYLES, SWATCHES } from '@/lib/catalog';
import { PageHead, Badge, Empty } from '@/components/page';
import { ActionButton } from '@/components/action-form';
import { fmtDateTime } from '@/lib/util';
import { whatsappConfigured } from '@/lib/whatsapp';
import { googleEnabled } from '@/auth';
import { emailConfigured } from '@/lib/email';
import { retryNotificationAction } from '../actions';
import { CompanyForm } from './company-form';

export const metadata = { title: 'Settings' };

export default async function Settings() {
  const ctx = await requireUser();
  if (ctx.user.role !== 'Owner') return <NoAccess />;
  const { db, tenant } = ctx;
  const N = schema.notifications;
  const log = await db.select({ n: N, title: schema.bookings.title }).from(N).leftJoin(schema.bookings, eq(schema.bookings.id, N.bookingId))
    .where(eq(N.tenantId, tenant.id)).orderBy(desc(N.createdAt)).limit(50);
  const conn = (ok: boolean) => ok ? <Badge s="good" label="Connected" /> : <Badge s="warn" label="Not set up" />;
  return (
    <>
      <PageHead title="Company settings" sub="These details print on every quotation and invoice." />
      <div className="body">
        <div className="split">
          <div className="panel"><div className="panel-h"><h2>Company details</h2></div><CompanyForm t={{ name: tenant.name, phone: tenant.phone, city: tenant.city, address: tenant.address, gstin: tenant.gstin, colour: tenant.colour, logo: tenant.logo, docStyle: tenant.docStyle, terms: tenant.terms }} swatches={SWATCHES} styles={DOC_STYLES} designs={perk(tenant, 'docDesigns')} anyColour={perk(tenant, 'anyColour')} /></div>
          <div className="panel"><div className="panel-h"><h2>Connections</h2></div>
            <div className="panel-b"><dl className="dl" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt>WhatsApp Business</dt><dd>{conn(whatsappConfigured())}</dd>
              <dt>Google sign-in</dt><dd>{conn(googleEnabled)}</dd>
              <dt>Password reset email</dt><dd>{conn(emailConfigured())}</dd>
            </dl><p className="small muted" style={{ marginTop: 12 }}>These are set by the server administrator (environment variables on the hosting platform).</p></div>
          </div>
        </div>
        <div className="panel" id="whatsapp"><div className="panel-h"><h2>WhatsApp message log</h2><span className="small muted">Failed messages are retried automatically once a day, up to 5 attempts.</span></div>
          {log.length === 0 ? <Empty title="No messages yet">A confirmation is sent when a customer accepts a quotation.</Empty> : (
            <div className="tablewrap"><table><thead><tr><th>When</th><th>Booking</th><th>To</th><th>Status</th><th className="num">Attempts</th><th>Error</th><th /></tr></thead><tbody>
              {log.map(({ n, title }) => (
                <tr key={n.id}><td className="nowrap">{fmtDateTime(n.createdAt)}</td><td>{n.bookingId ? <Link href={`/bookings/${n.bookingId}`}>{title}</Link> : '-'}</td><td className="nowrap">+{n.toPhone}</td>
                  <td><Badge s={n.status} /></td><td className="num">{n.attempts}</td><td className="small" style={{ maxWidth: 320 }}>{n.status === 'sent' ? '' : n.lastError}</td>
                  <td className="num">{n.status !== 'sent' && <ActionButton action={retryNotificationAction} fields={{ rid: n.id }} label="Retry" pendingText="Sending…" className="btn sm" />}</td></tr>))}
            </tbody></table></div>)}
        </div>
      </div>
    </>
  );
}
