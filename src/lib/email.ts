import 'server-only';

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

/** Sends an email through Resend (https://resend.com). Throws if sending fails. */
export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Email is not configured (RESEND_API_KEY missing).');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'EventDesk <onboarding@resend.dev>', to: [to], subject, html, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Email provider returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
