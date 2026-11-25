import Link from 'next/link';
import { schema } from '@/db';
type Tenant = typeof schema.tenants.$inferSelect;
import { presets, type Range } from '@/lib/reports';
import { fmtDate, fmtDateTime } from '@/lib/util';
import { PrintButton } from './print-button';
import { AutoPrint } from './auto-print';

/** One printable report: period picker and Print button on screen, a clean A4 page on paper. */
export function ReportFrame({ tenant, title, about, kind, range, asOf, print, children }: {
  tenant: Tenant; title: string; about: string; kind: string; range: Range; asOf?: boolean; print?: boolean; children: React.ReactNode;
}) {
  const ps = presets();
  const period = range.preset === 'all' ? 'All time' : `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
  return (
    <div className="report-page">
      <AutoPrint on={!!print} />
      <div className="pagehead">
        <div><div className="title"><h1>{title}</h1></div><div className="sub">{about}</div></div>
        <div className="actions"><Link className="btn" href="/reports">All reports</Link><PrintButton /></div>
      </div>
      <div className="body">
        <div className="panel no-print reportbar">
          <div className="panel-b">
            <div className="seg" role="group" aria-label="Period">
              {ps.map(p => <Link key={p.key} href={`/reports/${kind}?preset=${p.key}`} className={range.preset === p.key ? 'on' : ''} aria-current={range.preset === p.key ? 'true' : undefined}>{p.label}</Link>)}
            </div>
            <form className="reportdates" method="get" action={`/reports/${kind}`}>
              <label>From <input className="input" type="date" name="from" defaultValue={range.preset === 'all' ? '' : range.from} aria-label="From date" /></label>
              <label>To <input className="input" type="date" name="to" defaultValue={range.preset === 'all' ? '' : range.to} aria-label="To date" /></label>
              <button className="btn" type="submit">Show</button>
            </form>
          </div>
        </div>
        <div className="paper report-paper">
          <div className="report-head">
            <div className="report-co">
              {tenant.logo ? <img src={tenant.logo} alt="" className="report-logo" /> : null}
              <div>
                <b className="report-name">{tenant.name}</b>
                <div className="small muted">{[tenant.address, tenant.city].filter(Boolean).join(', ')}</div>
                <div className="small muted">{[tenant.phone && `Phone ${tenant.phone}`, tenant.gstin && `GSTIN ${tenant.gstin}`].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div className="report-title">
              <h2>{title}</h2>
              <div className="small">{asOf ? `Invoices dated ${period.toLowerCase() === 'all time' ? 'any time' : period}` : `Period: ${period}`}</div>
              <div className="small muted">Printed {fmtDateTime(new Date())}</div>
            </div>
          </div>
          {children}
          <div className="report-foot small muted">{tenant.name} · {title} · {period}</div>
        </div>
      </div>
    </div>
  );
}

export function Kpis({ items }: { items: [string, React.ReactNode][] }) {
  return <div className="report-kpis">{items.map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div>;
}
