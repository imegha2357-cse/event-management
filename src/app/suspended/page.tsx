import { requireUser } from '@/lib/session';
import { logoutAction } from '../(auth)/actions';
export const metadata = { title: 'Account paused' };
export default async function Suspended() {
  const { tenant } = await requireUser({ allowSuspended: true });
  return (
    <main className="public"><div className="panel"><div className="empty">
      <b>{tenant.name}’s EventDesk account is paused</b>
      <p style={{ margin: '6px 0 14px' }}>Your data is safe and comes back as soon as the account is activated again. Please contact the EventDesk team.</p>
      <form action={logoutAction}><button className="btn">Sign out</button></form>
    </div></div></main>
  );
}
