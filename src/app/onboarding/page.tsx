import { requireUser } from '@/lib/session';
import { OnboardingForm } from './form';
export const metadata = { title: 'Company details' };
export default async function OnboardingPage() {
  const { tenant, user } = await requireUser({ allowNoCompany: true });
  return (
    <main className="auth-main" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="panel" style={{ width: '100%', maxWidth: 560 }}>
        <div className="panel-h"><div><h1>Set up your company</h1><p className="muted small" style={{ marginTop: 2 }}>Welcome, {user.name}. These details appear on your quotations and WhatsApp messages.</p></div></div>
        <OnboardingForm tenant={{ name: tenant.name, phone: tenant.phone, city: tenant.city, address: tenant.address, gstin: tenant.gstin }} />
      </div>
    </main>
  );
}
