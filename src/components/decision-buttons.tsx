import Link from 'next/link';
import { ActionButton } from './action-form';
import { Icon } from './icons';
import { decideAction } from '@/app/(app)/actions';

/** Accept and Decline side by side for an open quotation; a clear tick or cross once decided. */
export function DecisionButtons({ quoteId, status, label, bookingId }: { quoteId: string; status: string; label: string; bookingId?: string | null }) {
  if (status === 'Accepted') return (
    <span className="decided ok"><Icon name="check" size={14} /> Accepted{bookingId && <> · <Link href={`/bookings/${bookingId}`}>booking</Link></>}</span>);
  if (status === 'Declined') return <span className="decided no"><Icon name="cross" size={14} /> Declined</span>;
  return (
    <div className="decide" role="group" aria-label={`Customer decision for ${label}`}>
      <ActionButton action={decideAction} fields={{ rid: quoteId, decision: 'Accepted', stay: '1' }} label={<><Icon name="check" size={14} /> Accept</>} pendingText="…" className="btn sm good"
        confirm={`Mark ${label} as accepted? It becomes a confirmed booking and the customer gets a WhatsApp confirmation.`} />
      <ActionButton action={decideAction} fields={{ rid: quoteId, decision: 'Declined', stay: '1' }} label={<><Icon name="cross" size={14} /> Decline</>} pendingText="…" className="btn sm danger"
        confirm={`Mark ${label} as declined?`} />
    </div>
  );
}
