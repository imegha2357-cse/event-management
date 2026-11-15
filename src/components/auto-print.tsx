'use client';
import { useEffect } from 'react';
/** Opens the print dialog once the page has loaded (links ending in ?print=1). */
export function AutoPrint({ on }: { on: boolean }) {
  useEffect(() => { if (on) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); } }, [on]);
  return null;
}
