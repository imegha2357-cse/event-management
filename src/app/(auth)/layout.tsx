import { LegalLinks } from '@/components/legal-page';
import { Wordmark } from '@/components/brand';
import { legalReady } from '@/lib/legal';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="auth-brand"><Wordmark height={26} /><span>For event management companies</span></div>
        <div>
          <h2>Quotations, bookings and crews in one place.</h2>
          <ul>
            <li>Send a quotation your customer can accept online</li>
            <li>Accepted quotations become bookings automatically</li>
            <li>Customers get a WhatsApp confirmation</li>
            <li>Track crews, attendance and wages per event</li>
          </ul>
        </div>
        <span className="small" style={{ color: 'var(--side-muted)' }}>Each company sees only its own data.</span>
      </aside>
      <main className="auth-main">{children}{legalReady && <LegalLinks />}</main>
    </div>
  );
}
