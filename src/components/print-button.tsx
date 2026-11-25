'use client';
import { Icon } from './icons';
/** Opens the browser's print dialog (print on paper or save as PDF). */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return <button type="button" className="btn primary" onClick={() => window.print()}><Icon name="print" /> {label}</button>;
}
