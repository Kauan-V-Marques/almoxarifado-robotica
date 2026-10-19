import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

export type Database = ReturnType<typeof createDatabase>['db'];

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  // Conexão ociosa que cai (banco reiniciando, failover) emite 'error' no pool. Sem este
  // handler o Node encerra o processo; com ele o pool descarta a conexão e abre outra.
  pool.on('error', (error) => console.error('Conexão ociosa com o PostgreSQL perdida:', error.message));
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool };
}
