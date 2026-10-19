import { afterAll, beforeAll, expect, it } from 'vitest';

import { CAPTAIN, createTestContext, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext({ loginRateLimit: 3 });
});
afterAll(async () => ctx.close());

it('bloqueia tentativas de login em excesso (força bruta)', async () => {
  const attempt = () =>
    ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: CAPTAIN, password: 'chute' } });

  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await attempt()).statusCode);

  expect(statuses).toEqual([401, 401, 401, 429]);
});
