import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { Database } from './client.js';

/** Aplica as migrations SQL da pasta drizzle/ (geradas pelo drizzle-kit a partir do schema.ts). */
export async function runMigrations(db: Database) {
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });
}
