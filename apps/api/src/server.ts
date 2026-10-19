import { buildApp } from './app.js';
import { createDatabase } from './db/client.js';
import { prepareDatabase } from './db/migrate.js';
import { loadEnv } from './env.js';

async function main() {
  const env = loadEnv();
  const { db, pool } = createDatabase(env.DATABASE_URL);

  // SEED_DEMO=true: com o banco vazio, carrega a equipe de exemplo (docker compose, Kubernetes de teste)
  const { seeded } = await prepareDatabase(db, { seedDemo: process.env.SEED_DEMO === 'true' });
  if (seeded) console.log('Dados de exemplo carregados (senha: robotica123).');

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
