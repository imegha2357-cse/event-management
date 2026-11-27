import Link from 'next/link';
import { LEGAL } from '@/lib/legal';
import { Wordmark } from './brand';
import { fmtDate } from '@/lib/util';

/** Shared layout for the Privacy Policy and Terms pages. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal">
      <header className="legal-top">
        <Link href="/login" className="legal-brand" aria-label="EventOS"><Wordmark height={20} /></Link>
        <nav><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms and Conditions</Link><Link href="/login">Sign in</Link></nav>
      </header>
      <article className="legal-body">
        <h1>{title}</h1>
        <p className="muted">Effective from {fmtDate(LEGAL.effective)}</p>
        {children}
        <h2>Contact</h2>
        <p>{LEGAL.operator}<br />{LEGAL.address}<br />Email: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></p>
      </article>
    </div>
  );
}

/** Links shown under the sign-in pages and on customer-facing pages. */
export function LegalLinks() {
  return <nav className="legal-links small"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms and Conditions</Link></nav>;
}
