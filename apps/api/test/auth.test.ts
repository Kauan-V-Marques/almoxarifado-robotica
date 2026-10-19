import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { ANA, CAPTAIN, createTestContext, login, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => ctx.close());
beforeEach(async () => ctx.reset());

describe('senhas', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hashPassword('robotica123');
    expect(await verifyPassword('robotica123', hash)).toBe(true);
    expect(await verifyPassword('robotica124', hash)).toBe(false);
  });

  it('usa um salt diferente a cada hash', async () => {
    expect(await hashPassword('mesma-senha')).not.toBe(await hashPassword('mesma-senha'));
  });
});

describe('login', () => {
  it('devolve o access token e grava o refresh em cookie httpOnly', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ' Capitao@Almox.dev ', password: 'robotica123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({ email: CAPTAIN, role: 'captain' });
    expect(response.json().accessToken.split('.')).toHaveLength(3);
    const cookie = response.cookies.find((c) => c.name === 'almox_refresh');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/auth' });
  });

  it('não revela se o e-mail existe: mesma resposta para e-mail ou senha errados', async () => {
    const wrongPassword = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: CAPTAIN, password: 'errada' },
    });
    const unknownEmail = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ninguem@almox.dev', password: 'errada' },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknownEmail.json());
  });

  it('valida o corpo da requisição', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nao-e-email', password: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(Object.keys(response.json().details)).toEqual(expect.arrayContaining(['email', 'password']));
  });
});

describe('sessão', () => {
  it('rota protegida exige token', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/components' })).statusCode).toBe(401);
    const bad = await ctx.app.inject({
      method: 'GET',
      url: '/api/components',
      headers: { authorization: 'Bearer token.falso.qualquer' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('/me devolve o usuário do token', async () => {
    const { auth } = await login(ctx.app, ANA);
    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth });
    expect(me.json()).toMatchObject({ email: ANA, role: 'member' });
  });

  it('refresh gera um novo par e o refresh antigo deixa de valer (rotação)', async () => {
    const { refreshCookie } = await login(ctx.app, ANA);

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { almox_refresh: refreshCookie },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().accessToken).toBeTruthy();
    const rotated = first.cookies.find((c) => c.name === 'almox_refresh')?.value;
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(refreshCookie);

    const reused = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { almox_refresh: refreshCookie },
    });
    expect(reused.statusCode).toBe(401);
  });

  it('logout invalida o refresh token', async () => {
    const { refreshCookie } = await login(ctx.app, ANA);

    const logout = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { almox_refresh: refreshCookie },
    });
    const refresh = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { almox_refresh: refreshCookie },
    });

    expect(logout.statusCode).toBe(204);
    expect(refresh.statusCode).toBe(401);
  });
});
