import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { authPlugin } from './auth/plugin.js';
import { authRoutes } from './auth/routes.js';
import type { Database } from './db/client.js';
import type { Env } from './env.js';
import { registerErrorHandler } from './errors.js';
import { inventoryRoutes } from './routes/inventory.js';
import { memberRoutes } from './routes/members.js';

export async function buildApp(db: Database, env: Env) {
  const app = Fastify({
    logger: env.NODE_ENV === 'development' ? { level: 'info' } : false,
    trustProxy: env.TRUST_PROXY,
  });

  registerErrorHandler(app);
  await app.register(cors, { origin: env.CORS_ORIGIN.split(','), credentials: true });
  await app.register(cookie);
  // global: false = só as rotas que pedirem (o login) têm limite de tentativas
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin, { secret: env.JWT_SECRET });

  app.get('/api/health', async () => ({ status: 'ok' }));
  await app.register(
    authRoutes(db, { secureCookies: env.NODE_ENV === 'production', loginRateLimit: env.LOGIN_RATE_LIMIT }),
    { prefix: '/api/auth' },
  );
  await app.register(memberRoutes(db), { prefix: '/api/members' });
  await app.register(inventoryRoutes(db), { prefix: '/api' });

  return app;
}
