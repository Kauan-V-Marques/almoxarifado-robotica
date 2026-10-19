import pg from 'pg';
import { afterAll, expect, it } from 'vitest';

import { createDatabase } from '../src/db/client.js';
import { prepareDatabase } from '../src/db/migrate.js';
import { users } from '../src/db/schema.js';
import { CAPTAIN, createEmptyDatabase, createTestContext, login } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const cleanup of cleanups) await cleanup();
});

it('várias réplicas subindo juntas preparam o banco uma vez só', async () => {
  const database = await createEmptyDatabase();
  // Cada "réplica" tem o próprio pool de conexões, como pods diferentes
  const replicas = Array.from({ length: 4 }, () => createDatabase(database.url));
  // Fecha as conexões antes de apagar o banco
  cleanups.push(...replicas.map(({ pool }) => () => pool.end()), database.drop);

  const results = await Promise.all(replicas.map(({ db }) => prepareDatabase(db, { seedDemo: true })));

  expect(results.filter((r) => r.seeded)).toHaveLength(1);
  expect(await replicas[0]!.db.$count(users)).toBe(3);
});

it('atrás do Ingress, o limite de login vale por cliente (X-Forwarded-For)', async () => {
  const ctx = await createTestContext({ loginRateLimit: 2, trustProxy: true });
  cleanups.push(ctx.close);
  const attempt = (ip: string) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-forwarded-for': ip },
      payload: { email: CAPTAIN, password: 'chute' },
    });

  const first = [];
  for (let i = 0; i < 3; i++) first.push((await attempt('203.0.113.7')).statusCode);

  expect(first).toEqual([401, 401, 429]);
  // Outro cliente, mesmo proxy: não herda o bloqueio
  expect((await attempt('198.51.100.20')).statusCode).toBe(401);
});

it('o banco reiniciando não derruba a API: as conexões ociosas caem e são refeitas', async () => {
  const ctx = await createTestContext();
  cleanups.push(ctx.close);
  await login(ctx.app, CAPTAIN); // deixa conexões abertas e ociosas no pool

  // Simula o PostgreSQL reiniciando: derruba todas as conexões da API
  const admin = new pg.Client({ connectionString: ctx.db.$client.options.connectionString });
  await admin.connect();
  await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()');
  await admin.end();
  await new Promise((resolve) => setTimeout(resolve, 200));

  const { token } = await login(ctx.app, CAPTAIN);
  expect(token).toBeTruthy();
});
