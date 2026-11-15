import Link from 'next/link';
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Empty } from '@/components/page';
import { Gate, NoAccess } from '@/components/locked';
import { ActionButton } from '@/components/action-form';
import { MiniForm } from '@/components/mini-form';
import { DocPaper } from '@/components/quote-doc';
import { ICON_CHOICES } from '@/components/icons';
import { GROUP_LABEL } from '@/lib/plans';
import { docCfg } from '@/lib/docs';
import { fy } from '@/lib/catalog';
import { todayIST } from '@/lib/util';
import { addBranchAction, addFieldAction, addStatusAction, addToolAction, deleteBranchAction, deleteFieldAction, deleteStatusAction, deleteToolAction, saveBrandingAction, saveDocsAction, saveMenuAction } from '../actions';
export const metadata = { title: 'Customize' };

const TABS: [string, string][] = [['branding', 'Name and colour'], ['menu', 'Menu'], ['fields', 'Your own fields'], ['statuses', 'Event statuses'], ['documents', 'Quotation and invoice'], ['tools', 'Build your own tool'], ['branches', 'Branches']];
const TYPES: Record<string, string> = { text: 'Text', number: 'Number', date: 'Date', select: 'Choice list', event: 'Event' };
const MENU_PAGES: Record<string, string> = { calendar: 'Month view', events: 'All bookings, New booking', quotations: 'All quotations, New quotation', invoices: 'All invoices', payments: 'Overview, Record payment, Add expense, Expenses & profit, Compare events', customers: 'All customers', services: 'My services, your service tools', staff: 'Staff and crews, Team and roles, Vendors' };

export default async function Customize({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'customize'); if (g) return <Gate g={g} plan={ctx.plan} />;
  if (ctx.user.role !== 'Owner') return <NoAccess />;
  const { db, tenant, custom: c } = ctx;
  const tab = TABS.some(t => t[0] === sp.tab) ? sp.tab! : 'branding';
  const cfg = docCfg(tenant);
  let body: React.ReactNode = null;
  if (tab === 'branding') body = (
    <div className="panel"><div className="panel-b"><MiniForm action={saveBrandingAction} submit="Save branding" reset={false}>
      <div className="field"><label htmlFor="appName">App name shown in the sidebar (leave empty to use “EventDesk”)</label><input id="appName" name="appName" className="input" defaultValue={c.appName} placeholder="e.g. Kumari Wedding Desk" /></div>
      <div className="field"><label htmlFor="colour">Brand colour (any colour). Used for the menu, buttons, quotations and invoices.</label><input id="colour" name="colour" type="color" defaultValue={cfg.colour} style={{ width: 72, height: 40 }} /></div>
      <label className="small" style={{ display: 'flex', gap: 6 }}><input type="checkbox" name="reset" value="1" /> Use the standard colour from Company settings instead</label>
    </MiniForm></div></div>);
  if (tab === 'menu') body = (
    <div className="panel"><div className="panel-b"><MiniForm action={saveMenuAction} submit="Save menu" reset={false}>
      <table><thead><tr><th>Main menu item</th><th>Inside it</th><th>Show</th><th>Call it</th></tr></thead><tbody>
        {Object.keys(MENU_PAGES).map(k => <tr key={k}><td>{GROUP_LABEL[k]}</td><td className="small muted">{MENU_PAGES[k]}</td>
          <td><input type="checkbox" name={`show_${k}`} defaultChecked={!(c.hidden ?? []).includes(k)} aria-label={`Show ${GROUP_LABEL[k]}`} /></td>
          <td><input name={`label_${k}`} className="input" defaultValue={c.labels?.[k] ?? ''} placeholder={GROUP_LABEL[k]} aria-label={`New name for ${GROUP_LABEL[k]}`} /></td></tr>)}
      </tbody></table>
      <p className="small muted">The sidebar always has at most 10 main items; everything else sits inside them as tabs. For example, call Customers “Families” or Bookings “Functions”. Hidden items keep their data.</p>
    </MiniForm></div></div>);
  if (tab === 'fields') body = (['eventFields', 'customerFields'] as const).map(w => (
    <div className="panel" key={w}><div className="panel-h"><div><h2>{w === 'eventFields' ? 'Extra fields on events' : 'Extra fields on customers'}</h2><div className="small muted">{w === 'eventFields' ? 'Appear in the New booking form and under each event, e.g. Nakshatram, Muhurtham time, Hall booking ID.' : 'Appear in the customer form, e.g. Bride or groom side, Referred by.'}</div></div></div>
      {(c[w] ?? []).length > 0 && <table><thead><tr><th>Field</th><th>Type</th><th>Choices</th><th /></tr></thead><tbody>{(c[w] ?? []).map(f => <tr key={f.id}><td><b>{f.label}</b></td><td>{TYPES[f.type]}</td><td>{(f.options ?? []).join(', ')}</td>
        <td className="num"><ActionButton action={deleteFieldAction} fields={{ where: w, rid: f.id }} label="Delete" className="btn sm danger" /></td></tr>)}</tbody></table>}
      <div className="panel-b"><MiniForm action={addFieldAction} submit="Add field" className="btn" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <input type="hidden" name="where" value={w} />
        <div className="field"><label htmlFor={`${w}-label`}>Field name</label><input id={`${w}-label`} name="label" className="input" /></div>
        <div className="field"><label htmlFor={`${w}-type`}>Type</label><select id={`${w}-type`} name="type" className="input">{['text', 'number', 'date', 'select'].map(k => <option key={k} value={k}>{TYPES[k]}</option>)}</select></div>
        <div className="field"><label htmlFor={`${w}-opts`}>Choices (for a choice list)</label><input id={`${w}-opts`} name="options" className="input" placeholder="A, B, C" /></div>
      </MiniForm></div></div>));
  if (tab === 'statuses') body = (
    <div className="panel"><div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="small muted">The standard statuses stay. Add your own steps in between, such as “Advance paid” or “On hold”. They appear in the Bookings status list and filters.</p>
      <div className="chips">{['Enquiry', 'Confirmed', 'Completed', 'Cancelled'].map(x => <span key={x} className="chip">{x}</span>)}
        {(c.statuses ?? []).map(x => <span key={x} className="chip info" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{x}<ActionButton action={deleteStatusAction} fields={{ status: x }} label="×" className="linkbtn" /></span>)}</div>
      <MiniForm action={addStatusAction} submit="Add status" className="btn" style={{ flexDirection: 'row', alignItems: 'flex-end' }}><div className="field"><label htmlFor="st">New status</label><input id="st" name="status" className="input" placeholder="e.g. Advance paid" /></div></MiniForm>
    </div></div>);
  if (tab === 'documents') {
    const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.tenantId, tenant.id)).orderBy(desc(schema.invoices.createdAt)).limit(1);
    const [cust] = inv ? await db.select().from(schema.customers).where(eq(schema.customers.id, inv.customerId)).limit(1) : [];
    body = (<div className="split" style={{ gridTemplateColumns: '340px minmax(0,1fr)' }}>
      <div className="panel"><div className="panel-b"><MiniForm action={saveDocsAction} submit="Save" reset={false}>
        <div className="field"><label htmlFor="qt">Quotation title</label><input id="qt" name="quoteTitle" className="input" defaultValue={cfg.quoteTitle} /></div>
        <div className="field"><label htmlFor="it1">Invoice title (with GST)</label><input id="it1" name="invTitleGst" className="input" defaultValue={cfg.invTitleGst} /></div>
        <div className="field"><label htmlFor="it2">Invoice title (without GST)</label><input id="it2" name="invTitle" className="input" defaultValue={cfg.invTitle} /></div>
        <div className="grid2"><div className="field"><label htmlFor="px">Number prefix</label><input id="px" name="prefix" className="input" maxLength={8} defaultValue={cfg.prefix} /></div>
          <div className="field"><label htmlFor="gr">GST rate</label><select id="gr" name="gstRate" className="input" defaultValue={cfg.gstRate}>{[5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}</select></div></div>
        <div className="field"><label htmlFor="vd">Quotation valid for (days)</label><input id="vd" name="validDays" type="number" min={1} className="input" defaultValue={cfg.validDays} /></div>
        <label className="small" style={{ display: 'flex', gap: 6 }}><input type="checkbox" name="words" defaultChecked={cfg.words} /> Show amount in words</label>
        <label className="small" style={{ display: 'flex', gap: 6 }}><input type="checkbox" name="sign" defaultChecked={cfg.sign} /> Show signature line</label>
        <p className="small muted">Design style and terms are in Company settings. New invoice numbers look like {cfg.prefix}/{fy(todayIST())}/0001.</p>
      </MiniForm></div></div>
      <div>{inv && cust ? <DocPaper kind="invoice" tenant={tenant} customer={cust} no={inv.docNo} date={inv.issuedOn} items={inv.items} discount={inv.discount} gst={inv.gst} gstRate={inv.gstRate} paid={0} />
        : <div className="panel"><Empty title="Create an invoice to see a preview here" /></div>}</div>
    </div>);
  }
  if (tab === 'tools') {
    const counts = await db.select({ tool: schema.toolRows.tool, n: sql<number>`count(*)::int` }).from(schema.toolRows).where(and(eq(schema.toolRows.tenantId, tenant.id), sql`${schema.toolRows.tool} like 'ct_%'`)).groupBy(schema.toolRows.tool);
    body = (<>
      {(c.tools ?? []).length > 0 && <div className="panel"><div className="panel-h"><h2>Your tools</h2></div><table><thead><tr><th>Tool</th><th>Fields</th><th className="num">Entries</th><th /></tr></thead><tbody>
        {(c.tools ?? []).map(t => <tr key={t.id}><td><b>{t.name}</b></td><td><div className="chips">{t.fields.map(f => <span key={f.id} className="chip">{f.label} · {TYPES[f.type]}</span>)}</div></td><td className="num">{counts.find(x => x.tool === 'ct_' + t.id)?.n ?? 0}</td>
          <td className="num"><div style={{ display: 'inline-flex', gap: 6 }}><Link className="btn sm" href={`/services/tools/ct_${t.id}`}>Open</Link><ActionButton action={deleteToolAction} fields={{ rid: t.id }} label="Delete" className="btn sm danger" confirm={`Delete “${t.name}” and all its entries?`} /></div></td></tr>)}</tbody></table></div>}
      <div className="panel"><div className="panel-h"><div><h2>Build a new tool</h2><div className="small muted">Need something like Mehendi bookings, Return gift orders or Hall bookings? Name it, choose its fields, and it appears under Services with its own table and form.</div></div></div>
        <div className="panel-b"><MiniForm action={addToolAction} submit="Create tool">
          <div className="grid2"><div className="field"><label htmlFor="ct-name">Tool name</label><input id="ct-name" name="name" className="input" placeholder="e.g. Return gift orders" /></div>
            <div className="field"><label htmlFor="ct-icon">Icon</label><select id="ct-icon" name="icon" className="input">{ICON_CHOICES.map(k => <option key={k}>{k}</option>)}</select></div></div>
          <div className="small muted">Fields (the first one is required when adding an entry)</div>
          {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ display: 'flex', gap: 8 }}>
            <input name={`f${i}`} className="input" placeholder={['e.g. Event', 'e.g. Gift item', 'e.g. Quantity', 'e.g. Supplier', 'e.g. Delivery date', 'Optional'][i]} aria-label={`Field ${i + 1} name`} />
            <select name={`t${i}`} className="input" style={{ width: 150 }} defaultValue={['event', 'text', 'number', 'text', 'date', 'text'][i]} aria-label={`Field ${i + 1} type`}>{Object.entries(TYPES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
            <input name={`o${i}`} className="input" placeholder="Choices: A, B, C" aria-label={`Field ${i + 1} choices`} /></div>)}
        </MiniForm></div></div>
    </>);
  }
  if (tab === 'branches') {
    const counts = await db.select({ b: schema.bookings.branchId, n: sql<number>`count(*)::int` }).from(schema.bookings).where(eq(schema.bookings.tenantId, tenant.id)).groupBy(schema.bookings.branchId);
    body = (<div className="panel">
      {(c.branches ?? []).length > 0 && <table><thead><tr><th>Branch</th><th>City</th><th>Manager</th><th className="num">Events</th><th /></tr></thead><tbody>{(c.branches ?? []).map(b => <tr key={b.id}><td><b>{b.name}</b></td><td>{b.city}</td><td>{b.manager}</td>
        <td className="num">{counts.find(x => x.b === b.id)?.n ?? 0}</td><td className="num"><ActionButton action={deleteBranchAction} fields={{ rid: b.id }} label="Delete" className="btn sm danger" /></td></tr>)}</tbody></table>}
      <div className="panel-b"><MiniForm action={addBranchAction} submit="Add branch" className="btn" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field"><label htmlFor="b-name">Branch name</label><input id="b-name" name="name" className="input" /></div>
        <div className="field"><label htmlFor="b-city">City</label><input id="b-city" name="city" className="input" /></div>
        <div className="field"><label htmlFor="b-mgr">Manager</label><input id="b-mgr" name="manager" className="input" /></div>
      </MiniForm><p className="small muted" style={{ marginTop: 8 }}>With branches set up, each new booking can be assigned to a branch.</p></div>
    </div>);
  }
  return (<>
    <PageHead title="Customize your workspace" sub="Change names, colours, fields, statuses, documents and even build your own tools. Every change applies instantly, and no developer is needed." badge={<span className="badge info">Enterprise</span>} />
    <div className="body">
      <div className="seg" role="tablist">{TABS.map(([k, n]) => <Link key={k} role="tab" aria-selected={k === tab} className={k === tab ? 'on' : ''} href={`/settings/customize?tab=${k}`}>{n}</Link>)}</div>
      {body}
    </div>
  </>);
}
