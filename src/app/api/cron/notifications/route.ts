import { NextResponse } from 'next/server';
import { retryFailed } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/** Daily scheduled job (Cloudflare cron trigger): retries WhatsApp messages that failed earlier. Protected by CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const results = await retryFailed(50);
  return NextResponse.json({ retried: results.length, sent: results.filter(r => r?.status === 'sent').length, failed: results.filter(r => r?.status === 'failed').length });
}
