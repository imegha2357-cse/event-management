import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

/*
 * One database handle for the whole app.
 * - Production (Vercel): DATABASE_URL is a Neon Postgres URL -> Neon serverless HTTP driver.
 * - Any other Postgres server (e.g. local development): node-postgres connection pool.
 * - Quick local trial: DATABASE_URL=pglite:<folder> runs an embedded Postgres (PGlite) with the same schema.
 */
type Handle = { db: any; ready: Promise<void> };
const g = globalThis as unknown as { __eventdeskDb?: Handle };

function make(): Handle {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  if (url.startsWith('pglite:')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require('@electric-sql/pglite');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/pglite');
    const dir = url.slice('pglite:'.length);
    const client = new PGlite(dir || undefined);
    const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
    return { db: drizzle(client, { schema }), ready: client.exec(sql).then(() => undefined) };
  }
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  if (!host.endsWith('neon.tech') && process.env.DATABASE_DRIVER !== 'neon') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/node-postgres');
    return { db: drizzle(new Pool({ connectionString: url, max: 10 }), { schema }), ready: Promise.resolve() };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { neon } = require('@neondatabase/serverless');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/neon-http');
  return { db: drizzle(neon(url), { schema }), ready: Promise.resolve() };
}

export async function getDb() {
  if (!g.__eventdeskDb) g.__eventdeskDb = make();
  await g.__eventdeskDb.ready;
  return g.__eventdeskDb.db as import('drizzle-orm/neon-http').NeonHttpDatabase<typeof schema>;
}

export { schema };
