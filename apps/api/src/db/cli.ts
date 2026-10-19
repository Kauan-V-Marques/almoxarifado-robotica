// npm run db:migrate  -> aplica as migrations
// npm run db:seed     -> aplica as migrations e carrega dados de exemplo
import { createDatabase } from './client.js';
import { runMigrations } from './migrate.js';
import { seed } from './seed.js';

const { db, pool } = createDatabase(process.env.DATABASE_URL ?? 'postgres://almox:almox@localhost:5432/almox');
try {
  await runMigrations(db);
  console.log('Migrations aplicadas.');
  if (process.argv.includes('--seed')) {
    console.log(await seed(db));
  }
} finally {
  await pool.end();
}
