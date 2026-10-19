import { buildApp } from './app.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { users } from './db/schema.js';
import { seed } from './db/seed.js';
import { loadEnv } from './env.js';

async function main() {
  const env = loadEnv();
  const { db, pool } = createDatabase(env.DATABASE_URL);
  await runMigrations(db);

  // SEED_DEMO=true: com o banco vazio, carrega a equipe de exemplo (útil no docker compose)
  if (process.env.SEED_DEMO === 'true' && (await db.$count(users)) === 0) {
    await seed(db);
    console.log('Dados de exemplo carregados (senha: robotica123).');
  }

  const app = await buildApp(db, env);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  const shutdown = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
