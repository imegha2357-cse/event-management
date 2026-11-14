// Applies db/schema.sql to the database in DATABASE_URL. Safe to run more than once (CREATE ... IF NOT EXISTS).
import fs from 'node:fs';
const url = process.env.DATABASE_URL;
if (!url || url.startsWith('pglite:')) { console.error('Set DATABASE_URL to your Postgres / Neon connection string.'); process.exit(1); }
const statements = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
  .split(/;\s*\n/).map(s => s.replace(/--.*$/gm, '').trim()).filter(Boolean);
if (new URL(url).hostname.endsWith('neon.tech')) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  for (const s of statements) await sql.query(s);
} else {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  for (const s of statements) await client.query(s);
  await client.end();
}
console.log(`Applied ${statements.length} statements.`);
