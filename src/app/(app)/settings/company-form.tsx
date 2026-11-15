'use client';
import { useState } from 'react';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { saveCompanyAction } from './actions';

type T = { name: string; phone: string; city: string; address: string; gstin: string; colour: string; logo: string; docStyle: string; terms: string };
function shrink(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => { const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85)); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); }; img.src = url; });
}

export function CompanyForm({ t, swatches, styles, designs, anyColour }: { t: T; swatches: string[]; styles: Record<string, [string, string]>; designs: boolean; anyColour: boolean }) {
  const { state, action, onSubmit, pending } = useFormAction(saveCompanyAction);
  const fe = state?.fieldErrors ?? {};
  const [logo, setLogo] = useState(t.logo);
  const [colour, setColour] = useState(t.colour);
  const [logoErr, setLogoErr] = useState('');
  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="logo" value={logo} /><input type="hidden" name="colour" value={colour} />
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormMessage state={state} />
        <div className="grid2">
          <Field label="Company name" htmlFor="name" error={fe.name} required><input id="name" name="name" className="input" defaultValue={t.name} /></Field>
          <Field label="Business phone" htmlFor="phone" error={fe.phone} required><input id="phone" name="phone" className="input" defaultValue={t.phone} /></Field>
          <Field label="City" htmlFor="city" error={fe.city} required hint="Used for the weather on your dashboard."><input id="city" name="city" className="input" defaultValue={t.city} /></Field>
          <Field label="GSTIN (leave empty if not registered)" htmlFor="gstin" error={fe.gstin}><input id="gstin" name="gstin" className="input" defaultValue={t.gstin} maxLength={15} /></Field>
        </div>
        <Field label="Address" htmlFor="address" error={fe.address}><textarea id="address" name="address" rows={2} className="input" defaultValue={t.address} /></Field>
        <div className="field"><span className="label">Logo (printed on quotations and invoices)</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {logo ? <img src={logo} alt="Company logo" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} /> : <span className="muted small">No logo yet</span>}
            <label className="btn sm">Upload logo<input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { setLogo(await shrink(f, 240)); setLogoErr(''); } catch { setLogoErr('That file could not be read as an image.'); } }} /></label>
            {logo && <button type="button" className="btn sm" onClick={() => setLogo('')}>Remove</button>}
          </div>{(logoErr || fe.logo) && <span className="ferr">{logoErr || fe.logo}</span>}</div>
        <div className="field"><span className="label">Brand colour{anyColour && ' (Enterprise: pick any colour in Customize)'}</span>
          <div className="choices" role="radiogroup">{swatches.map((c, i) => <button type="button" key={c} role="radio" aria-checked={colour === c} aria-label={`Colour ${i + 1}`} onClick={() => setColour(c)}
            style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: colour === c ? '3px solid var(--ink)' : '2px solid #fff', boxShadow: '0 0 0 1px var(--line)', cursor: 'pointer' }} />)}</div></div>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3>Quotation and invoice design {!designs && <span className="badge info">Pro</span>}</h3>
          {designs ? (<>
            <div className="grid3">{Object.entries(styles).map(([k, [n, d]]) => (
              <label key={k} className="svccard" style={{ cursor: 'pointer' }}><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" name="docStyle" value={k} defaultChecked={t.docStyle === k} /><b>{n}</b></span><span className="small muted">{d}</span></label>))}</div>
            <Field label="Your terms and conditions (printed on every quotation and invoice)" htmlFor="terms" error={fe.terms}><textarea id="terms" name="terms" rows={3} className="input" defaultValue={t.terms} placeholder="e.g. 50% advance to confirm the date. No refund within 15 days of the event." /></Field>
          </>) : <p className="small muted">Basic uses one standard design with standard terms. Pro adds 3 designs and your own terms; Enterprise also lets you change titles, numbering, GST rate and sections.</p>}
        </div>
      </div>
      <div className="formfoot"><SubmitButton pending={pending} pendingText="Saving…">Save changes</SubmitButton></div>
    </form>
  );
}
