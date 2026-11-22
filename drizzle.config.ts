import { defineConfig } from 'drizzle-kit';

// Migrations must run over a DIRECT (non-pooled) connection: Neon's pooler runs PgBouncer in
// transaction mode, which breaks session-level statements migration tools rely on.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
