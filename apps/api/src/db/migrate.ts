import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { Database } from './client.js';
import { users } from './schema.js';
import { seed } from './seed.js';

/** Chave do advisory lock que serializa a preparação do banco entre réplicas */
const PREPARE_LOCK_KEY = 727_001;

/** Aplica as migrations SQL da pasta drizzle/ (geradas pelo drizzle-kit a partir do schema.ts). */
export async function runMigrations(db: Database) {
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });
}

/**
 * Migrations e, se pedido, dados de exemplo com o banco vazio. Várias réplicas da API
 * sobem ao mesmo tempo (Kubernetes): o advisory lock faz uma esperar a outra terminar,
 * em vez de as duas criarem as mesmas tabelas ou carregarem o seed duas vezes.
 */
export async function prepareDatabase(db: Database, options: { seedDemo: boolean }) {
  const lock = await db.$client.connect();
  try {
    await lock.query('SELECT pg_advisory_lock($1)', [PREPARE_LOCK_KEY]);
    await runMigrations(db);
    if (options.seedDemo && (await db.$count(users)) === 0) {
      await seed(db);
      return { seeded: true };
    }
    return { seeded: false };
  } finally {
    await lock.query('SELECT pg_advisory_unlock($1)', [PREPARE_LOCK_KEY]).catch(() => undefined);
    lock.release();
  }
}
