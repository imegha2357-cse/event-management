'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { decideQuotation } from '@/lib/quotes';
import { todayIST } from '@/lib/util';
import type { ActionState } from '@/lib/session';

/** Customer's decision from the public review link. The link token is the only credential. */
export async function publicDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get('token') ?? '');
  const decision = fd.get('decision') === 'Accepted' ? 'Accepted' : 'Declined';
  const db = await getDb();
  const [q] = await db.select().from(schema.quotations).where(eq(schema.quotations.publicToken, token)).limit(1);
  if (!q) return { error: 'This quotation link is not valid.' };
  if (decision === 'Accepted' && q.validUntil < todayIST() && (q.status === 'Draft' || q.status === 'Sent')) return { error: 'This quotation has expired. Please contact the company for an updated quotation.' };
  const [c] = await db.select({ name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.id, q.customerId)).limit(1);
  const r = await decideQuotation({ quotationId: q.id, publicToken: token, decision, actor: `${c?.name ?? 'Customer'} (customer)`, reason: String(fd.get('reason') ?? '').trim() });
  revalidatePath(`/q/${token}`);
  if (!r.ok) return { error: r.error };
  return r.status === 'Accepted'
    ? { ok: true, message: 'Thank you! Your booking is confirmed. ' + (r.notification?.status === 'sent' ? 'A confirmation has been sent to your WhatsApp.' : 'The company will contact you with the details.') }
    : { ok: true, message: 'Thank you for letting us know. The quotation has been declined.' };
}
