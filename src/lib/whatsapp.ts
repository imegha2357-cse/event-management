import 'server-only';
import { and, eq, lt, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { fmtDate, fmtTime, newId, waNumber } from '@/lib/util';

/*
 * WhatsApp Business notifications through the Meta WhatsApp Cloud API.
 * Every message is first written to the `notifications` table (the outbox), then sent.
 * A failed send is stored with its error and can be retried from the app or by the daily cron job.
 */
export const MAX_ATTEMPTS = 5;

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

type BookingLike = { id: string; title: string; eventDate: string; startTime: string; endTime: string; venue: string; notes: string; total: number };

/** Template parameters, in order, for the approved "booking_confirmation" template (text in README). */
export function bookingConfirmationParams(customer: string, b: BookingLike, company: string) {
  const time = b.startTime ? `${fmtTime(b.startTime)}${b.endTime ? ' to ' + fmtTime(b.endTime) : ''}` : 'time to be confirmed';
  return [customer, b.title, fmtDate(b.eventDate), time, b.venue || 'venue to be confirmed', company,
    b.notes ? `Note: ${b.notes}` : 'We will contact you a few days before the event.'];
}
export function renderBookingConfirmation(p: string[]) {
  return `Vanakkam ${p[0]}, your booking for ${p[1]} on ${p[2]}, ${p[3]} at ${p[4]} is confirmed with ${p[5]}. ${p[6]}`;
}

/** Creates the outbox row for a booking confirmation and tries to send it straight away. */
export async function queueBookingConfirmation(opts: { tenantId: string; booking: BookingLike; customerName: string; customerPhone: string; companyName: string }) {
  const db = await getDb();
  const params = bookingConfirmationParams(opts.customerName, opts.booking, opts.companyName);
  const id = newId();
  await db.insert(schema.notifications).values({
    id, tenantId: opts.tenantId, bookingId: opts.booking.id, kind: 'booking_confirmation',
    toPhone: waNumber(opts.customerPhone), body: renderBookingConfirmation(params), payload: { params }, status: 'queued',
  });
  return deliverNotification(id);
}

async function sendToMeta(to: string, params: string[]) {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error('WhatsApp is not connected yet. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in the server settings, then retry.');
  if (!/^\d{10,15}$/.test(to)) throw new Error(`The customer phone number "${to}" is not a valid WhatsApp number.`);
  const base = process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0';
  const res = await fetch(`${base}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: {
        name: process.env.WHATSAPP_TEMPLATE_NAME || 'booking_confirmation',
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }],
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.error?.message ? `WhatsApp: ${json.error.message}` : `WhatsApp returned HTTP ${res.status}`);
  const msgId = json?.messages?.[0]?.id;
  if (!msgId) throw new Error('WhatsApp accepted the request but returned no message id.');
  return String(msgId);
}

/** Sends one outbox message and records the result. Never throws: failures are saved for retry. */
export async function deliverNotification(id: string) {
  const db = await getDb();
  const [n] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id)).limit(1);
  if (!n || n.status === 'sent') return n;
  const attempts = n.attempts + 1;
  try {
    const msgId = await sendToMeta(n.toPhone, ((n.payload as any)?.params ?? []) as string[]);
    const [u] = await db.update(schema.notifications).set({ status: 'sent', attempts, providerMessageId: msgId, lastError: null, sentAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.notifications.id, id)).returning();
    return u;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[whatsapp] notification ${id} failed (attempt ${attempts}): ${msg}`);
    const [u] = await db.update(schema.notifications).set({ status: 'failed', attempts, lastError: msg.slice(0, 500), updatedAt: new Date() })
      .where(eq(schema.notifications.id, id)).returning();
    return u;
  }
}

/** Retries failed messages that still have attempts left (used by the scheduled job). */
export async function retryFailed(limit = 25) {
  const db = await getDb();
  const rows = await db.select({ id: schema.notifications.id }).from(schema.notifications)
    .where(and(inArray(schema.notifications.status, ['failed', 'queued']), lt(schema.notifications.attempts, MAX_ATTEMPTS))).limit(limit);
  const results = [];
  for (const r of rows) results.push(await deliverNotification(r.id));
  return results;
}
