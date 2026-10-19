import type { ComponentItem, Loan } from '@almox/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ANA, BRUNO, CAPTAIN, createTestContext, login, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => ctx.close());
beforeEach(async () => ctx.reset());

const newComponent = {
  name: 'Servo MG90S',
  sku: 'mot-mg90s',
  category: 'motor',
  quantity: 8,
  minQuantity: 2,
  location: 'Gaveta B3',
};

async function component(sku: string, headers: Record<string, string>): Promise<ComponentItem> {
  const list = await ctx.app.inject({ method: 'GET', url: `/api/components?search=${sku}`, headers });
  return (list.json() as ComponentItem[])[0]!;
}

function borrow(headers: Record<string, string>, componentId: number, quantity: number) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/loans',
    headers,
    payload: { componentId, quantity, purpose: 'Teste automatizado', days: 7 },
  });
}

describe('componentes', () => {
  it('só o capitão cadastra, e o SKU é normalizado e único', async () => {
    const member = await login(ctx.app, ANA);
    const captain = await login(ctx.app, CAPTAIN);

    const denied = await ctx.app.inject({ method: 'POST', url: '/api/components', headers: member.auth, payload: newComponent });
    const created = await ctx.app.inject({ method: 'POST', url: '/api/components', headers: captain.auth, payload: newComponent });
    const duplicate = await ctx.app.inject({ method: 'POST', url: '/api/components', headers: captain.auth, payload: newComponent });

    expect(denied.statusCode).toBe(403);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ sku: 'MOT-MG90S', available: 8, onLoan: 0 });
    expect(duplicate.statusCode).toBe(409);
  });

  it('recusa dados inválidos com o motivo de cada campo', async () => {
    const { auth } = await login(ctx.app, CAPTAIN);
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/components',
      headers: auth,
      payload: { ...newComponent, sku: 'x', quantity: -1, category: 'foguete' },
    });

    expect(response.statusCode).toBe(400);
    expect(Object.keys(response.json().details)).toEqual(expect.arrayContaining(['sku', 'quantity', 'category']));
  });

  it('calcula o disponível descontando o que está emprestado', async () => {
    const { auth } = await login(ctx.app, ANA);
    const esp32 = await component('MCU-ESP32', auth);

    expect(esp32).toMatchObject({ quantity: 4, onLoan: 2, available: 2, lowStock: true });
  });

  it('não deixa a quantidade ficar abaixo do que está emprestado', async () => {
    const { auth } = await login(ctx.app, CAPTAIN);
    const esp32 = await component('MCU-ESP32', auth);

    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/components/${esp32.id}`,
      headers: auth,
      payload: { ...newComponent, sku: esp32.sku, quantity: 1 },
    });

    expect(response.statusCode).toBe(422);
  });

  it('só exclui componente sem histórico de empréstimos', async () => {
    const { auth } = await login(ctx.app, CAPTAIN);
    const esp32 = await component('MCU-ESP32', auth);
    const created = await ctx.app.inject({ method: 'POST', url: '/api/components', headers: auth, payload: newComponent });

    expect((await ctx.app.inject({ method: 'DELETE', url: `/api/components/${esp32.id}`, headers: auth })).statusCode).toBe(422);
    expect(
      (await ctx.app.inject({ method: 'DELETE', url: `/api/components/${created.json().id}`, headers: auth })).statusCode,
    ).toBe(204);
  });
});

describe('empréstimos', () => {
  it('pegar emprestado reduz o disponível; pedir mais do que há é recusado', async () => {
    const { auth } = await login(ctx.app, ANA);
    const motor = await component('MOT-N20-1K', auth);

    const ok = await borrow(auth, motor.id, 5);
    const tooMuch = await borrow(auth, motor.id, 8);

    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({ quantity: 5, overdue: false, user: { name: 'Ana Souza' } });
    expect(tooMuch.statusCode).toBe(422);
    expect(tooMuch.json().error).toContain('Só há 7');
    expect((await component('MOT-N20-1K', auth)).available).toBe(7);
  });

  it('dois pedidos simultâneos pela última unidade: só um consegue', async () => {
    const ana = await login(ctx.app, ANA);
    const bruno = await login(ctx.app, BRUNO);
    const solda = await component('FER-SOLDA60', ana.auth); // 3 unidades, nenhuma emprestada

    const results = await Promise.all([borrow(ana.auth, solda.id, 2), borrow(bruno.auth, solda.id, 2)]);

    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 422]);
    expect((await component('FER-SOLDA60', ana.auth)).available).toBe(1);
  });

  it('membro vê só os próprios empréstimos; o capitão vê todos', async () => {
    const ana = await login(ctx.app, ANA);
    const captain = await login(ctx.app, CAPTAIN);

    const mine = (await ctx.app.inject({ method: 'GET', url: '/api/loans?status=open', headers: ana.auth })).json() as Loan[];
    const all = (await ctx.app.inject({ method: 'GET', url: '/api/loans?status=open', headers: captain.auth })).json() as Loan[];

    expect(mine.every((l) => l.user.name === 'Ana Souza')).toBe(true);
    expect(all.map((l) => l.user.name).sort()).toEqual(['Ana Souza', 'Bruno Lima', 'Capitã Demo']);
  });

  it('só o dono ou o capitão devolvem, e não dá para devolver duas vezes', async () => {
    const ana = await login(ctx.app, ANA);
    const bruno = await login(ctx.app, BRUNO);
    const [loan] = (await ctx.app.inject({ method: 'GET', url: '/api/loans?status=open', headers: ana.auth })).json() as Loan[];

    const byOther = await ctx.app.inject({ method: 'POST', url: `/api/loans/${loan!.id}/return`, headers: bruno.auth });
    const byOwner = await ctx.app.inject({ method: 'POST', url: `/api/loans/${loan!.id}/return`, headers: ana.auth });
    const again = await ctx.app.inject({ method: 'POST', url: `/api/loans/${loan!.id}/return`, headers: ana.auth });

    expect(byOther.statusCode).toBe(403);
    expect(byOwner.statusCode).toBe(200);
    expect(byOwner.json().returnedAt).not.toBeNull();
    expect(again.statusCode).toBe(422);
  });

  it('marca empréstimos atrasados e o painel do capitão os destaca', async () => {
    const captain = await login(ctx.app, CAPTAIN);
    const ana = await login(ctx.app, ANA);

    const overdue = (await ctx.app.inject({ method: 'GET', url: '/api/loans?status=overdue', headers: captain.auth })).json() as Loan[];
    const dashboard = (await ctx.app.inject({ method: 'GET', url: '/api/dashboard', headers: captain.auth })).json();
    const memberDashboard = (await ctx.app.inject({ method: 'GET', url: '/api/dashboard', headers: ana.auth })).json();

    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ overdue: true, component: { sku: 'BAT-2S-850' }, user: { name: 'Bruno Lima' } });
    expect(dashboard.overdueLoans).toHaveLength(1);
    expect(dashboard.lowStock.map((c: ComponentItem) => c.sku)).toEqual(expect.arrayContaining(['MCU-ESP32', 'BAT-2S-850']));
    expect(memberDashboard.overdueLoans).toEqual([]);
    expect(memberDashboard.myLoans).toHaveLength(1);
  });
});

describe('membros', () => {
  it('capitão cadastra membro, que já consegue entrar; membro não acessa a lista', async () => {
    const captain = await login(ctx.app, CAPTAIN);
    const ana = await login(ctx.app, ANA);

    const weak = await ctx.app.inject({
      method: 'POST',
      url: '/api/members',
      headers: captain.auth,
      payload: { name: 'Carla Dias', email: 'carla@almox.dev', password: 'curta' },
    });
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/members',
      headers: captain.auth,
      payload: { name: 'Carla Dias', email: 'carla@almox.dev', password: 'senhaForte1' },
    });

    expect(weak.statusCode).toBe(400);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ role: 'member' });
    expect(created.json()).not.toHaveProperty('passwordHash');
    await expect(login(ctx.app, 'carla@almox.dev', 'senhaForte1')).resolves.toHaveProperty('token');
    expect((await ctx.app.inject({ method: 'GET', url: '/api/members', headers: ana.auth })).statusCode).toBe(403);
  });
});
