import { randomBytes } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import pg from 'pg';

import { buildApp } from '../src/app.js';
import { createDatabase, type Database } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO_PASSWORD, seed } from '../src/db/seed.js';
import { loadEnv } from '../src/env.js';

/**
 * Cada arquivo de teste ganha um banco PostgreSQL próprio, criado pelas migrations
 * e apagado no final. Servidor: TEST_DATABASE_URL (um banco qualquer para conectar).
 */
const SERVER_URL = process.env.TEST_DATABASE_URL ?? 'postgres://almox:almox@localhost:5432/almox';

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/** Banco vazio e exclusivo; drop() apaga no final. */
export async function createEmptyDatabase() {
  const name = `almox_test_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: SERVER_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = new URL(SERVER_URL);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      const cleanup = new pg.Client({ connectionString: SERVER_URL });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await cleanup.end();
    },
  };
}

export async function createTestContext(
  options: { loginRateLimit?: number; trustProxy?: boolean } = {},
): Promise<TestContext> {
  const database = await createEmptyDatabase();
  const { db, pool } = createDatabase(database.url);
  await runMigrations(db);
  await seed(db);

  const env = loadEnv({
    JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
    NODE_ENV: 'test',
    // Os testes fazem muitos logins seguidos; o limite real é testado à parte
    LOGIN_RATE_LIMIT: String(options.loginRateLimit ?? 1000),
    TRUST_PROXY: String(options.trustProxy ?? false),
  });
  const app = await buildApp(db, env);

  return {
    app,
    db,
    reset: async () => {
      await seed(db);
    },
    close: async () => {
      await app.close();
      await pool.end();
      await database.drop();
    },
  };
}

export async function login(app: FastifyInstance, email: string, password = DEMO_PASSWORD) {
  const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  if (response.statusCode !== 200) throw new Error(`login falhou: ${response.body}`);
  const cookie = response.cookies.find((c) => c.name === 'almox_refresh');
  return {
    token: response.json().accessToken as string,
    refreshCookie: cookie?.value ?? '',
    auth: { authorization: `Bearer ${response.json().accessToken}` },
  };
}

export const CAPTAIN = 'capitao@almox.dev';
export const ANA = 'ana@almox.dev';
export const BRUNO = 'bruno@almox.dev';
