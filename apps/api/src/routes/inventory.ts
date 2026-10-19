import { CATEGORIES, type Category, type ComponentItem, componentSchema, type Loan, loanSchema } from '@almox/shared';
import { and, asc, desc, eq, getTableColumns, ilike, isNotNull, isNull, lt, or, type SQL, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { Database } from '../db/client.js';
import { components, loans, users } from '../db/schema.js';
import { businessRule, forbidden, notFound } from '../errors.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });

/**
 * Quantidade emprestada (e ainda não devolvida) de cada componente.
 * A coluna externa vai escrita por extenso: interpolada, o Drizzle a gera como "id"
 * sem o nome da tabela, e dentro da subconsulta ela seria lida como loans.id.
 */
const onLoan = sql<number>`coalesce((
  select sum(l.quantity) from loans l
   where l.component_id = "components"."id" and l.returned_at is null
), 0)::int`;

type ComponentRow = typeof components.$inferSelect & { onLoan: number };

function toComponent(row: ComponentRow): ComponentItem {
  const available = row.quantity - row.onLoan;
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    quantity: row.quantity,
    minQuantity: row.minQuantity,
    location: row.location,
    onLoan: row.onLoan,
    available,
    lowStock: available <= row.minQuantity,
  };
}

export async function listComponents(db: Database, filter: { search?: string; category?: Category } = {}) {
  const conditions: SQL[] = [];
  if (filter.search) {
    const term = `%${filter.search}%`;
    conditions.push(or(ilike(components.name, term), ilike(components.sku, term))!);
  }
  if (filter.category) conditions.push(eq(components.category, filter.category));

  const rows = await db
    .select({ ...getTableColumns(components), onLoan })
    .from(components)
    .where(and(...conditions))
    .orderBy(asc(components.name));
  return rows.map(toComponent);
}

export async function listLoans(
  db: Database,
  filter: { userId?: number; status?: 'open' | 'returned' | 'overdue' } = {},
): Promise<Loan[]> {
  const now = new Date();
  const conditions: SQL[] = [];
  if (filter.userId) conditions.push(eq(loans.userId, filter.userId));
  if (filter.status === 'open') conditions.push(isNull(loans.returnedAt));
  if (filter.status === 'returned') conditions.push(isNotNull(loans.returnedAt));
  if (filter.status === 'overdue') conditions.push(isNull(loans.returnedAt), lt(loans.dueAt, now));

  const rows = await db
    .select({
      loan: loans,
      component: { id: components.id, name: components.name, sku: components.sku },
      user: { id: users.id, name: users.name },
    })
    .from(loans)
    .innerJoin(components, eq(components.id, loans.componentId))
    .innerJoin(users, eq(users.id, loans.userId))
    .where(and(...conditions))
    .orderBy(desc(loans.borrowedAt), desc(loans.id));

  return rows.map(({ loan, component, user }) => ({
    id: loan.id,
    component,
    user,
    quantity: loan.quantity,
    purpose: loan.purpose,
    borrowedAt: loan.borrowedAt.toISOString(),
    dueAt: loan.dueAt.toISOString(),
    returnedAt: loan.returnedAt?.toISOString() ?? null,
    overdue: loan.returnedAt === null && loan.dueAt < now,
  }));
}

export function inventoryRoutes(db: Database) {
  return async (app: FastifyInstance) => {
    app.addHook('onRequest', app.authenticate);

    // ---------- Componentes ----------

    app.get('/components', async (request) => {
      const query = z
        .object({
          search: z.string().trim().optional(),
          category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]).optional(),
        })
        .parse(request.query);
      return listComponents(db, query);
    });

    app.post('/components', { onRequest: [app.requireCaptain] }, async (request, reply) => {
      const data = componentSchema.parse(request.body);
      const [created] = await db.insert(components).values(data).returning();
      return reply.status(201).send(toComponent({ ...created!, onLoan: 0 }));
    });

    app.put('/components/:id', { onRequest: [app.requireCaptain] }, async (request) => {
      const { id } = idParam.parse(request.params);
      const data = componentSchema.parse(request.body);

      return db.transaction(async (tx) => {
        const [current] = await tx
          .select({ ...getTableColumns(components), onLoan })
          .from(components)
          .where(eq(components.id, id))
          .for('update');
        if (!current) throw notFound('Componente');
        if (data.quantity < current.onLoan) {
          throw businessRule(`Há ${current.onLoan} unidade(s) emprestada(s); a quantidade não pode ficar abaixo disso.`);
        }
        const [updated] = await tx.update(components).set(data).where(eq(components.id, id)).returning();
        return toComponent({ ...updated!, onLoan: current.onLoan });
      });
    });

    app.delete('/components/:id', { onRequest: [app.requireCaptain] }, async (request, reply) => {
      const { id } = idParam.parse(request.params);
      const [history] = await db.select({ id: loans.id }).from(loans).where(eq(loans.componentId, id)).limit(1);
      if (history) throw businessRule('Componente com histórico de empréstimos não pode ser excluído.');

      const deleted = await db.delete(components).where(eq(components.id, id)).returning({ id: components.id });
      if (deleted.length === 0) throw notFound('Componente');
      return reply.status(204).send();
    });

    // ---------- Empréstimos ----------

    app.get('/loans', async (request) => {
      const query = z
        .object({
          status: z.enum(['open', 'returned', 'overdue']).optional(),
          mine: z.stringbool().optional(),
        })
        .parse(request.query);
      // Membro só vê os próprios empréstimos; o capitão vê todos (ou só os dele com ?mine=true)
      const onlyMine = request.user.role !== 'captain' || query.mine === true;
      return listLoans(db, { status: query.status, userId: onlyMine ? Number(request.user.sub) : undefined });
    });

    app.post('/loans', async (request, reply) => {
      const data = loanSchema.parse(request.body);
      const userId = Number(request.user.sub);

      const loanId = await db.transaction(async (tx) => {
        // Trava o componente: dois pedidos ao mesmo tempo não conseguem pegar a mesma peça
        const [component] = await tx
          .select({ ...getTableColumns(components), onLoan })
          .from(components)
          .where(eq(components.id, data.componentId))
          .for('update');
        if (!component) throw notFound('Componente');

        const available = component.quantity - component.onLoan;
        if (data.quantity > available) {
          throw businessRule(`Só há ${available} unidade(s) de ${component.name} disponível(is).`);
        }

        const [loan] = await tx
          .insert(loans)
          .values({
            componentId: component.id,
            userId,
            quantity: data.quantity,
            purpose: data.purpose,
            dueAt: new Date(Date.now() + data.days * 86_400_000),
          })
          .returning({ id: loans.id });
        return loan!.id;
      });

      const [created] = (await listLoans(db, { userId })).filter((l) => l.id === loanId);
      return reply.status(201).send(created);
    });

    app.post('/loans/:id/return', async (request) => {
      const { id } = idParam.parse(request.params);
      const [loan] = await db.select().from(loans).where(eq(loans.id, id));
      if (!loan) throw notFound('Empréstimo');
      if (request.user.role !== 'captain' && loan.userId !== Number(request.user.sub)) throw forbidden();

      const [updated] = await db
        .update(loans)
        .set({ returnedAt: new Date() })
        .where(and(eq(loans.id, id), isNull(loans.returnedAt)))
        .returning({ id: loans.id });
      if (!updated) throw businessRule('Este empréstimo já foi devolvido.');

      const [result] = (await listLoans(db, { userId: loan.userId })).filter((l) => l.id === id);
      return result;
    });

    // ---------- Painel ----------

    app.get('/dashboard', async (request) => {
      const all = await listComponents(db);
      const open = await listLoans(db, { status: 'open' });
      const userId = Number(request.user.sub);
      return {
        components: all.length,
        itemsInStock: all.reduce((sum, c) => sum + c.available, 0),
        lowStock: all.filter((c) => c.lowStock),
        openLoans: open.length,
        overdueLoans: request.user.role === 'captain' ? open.filter((l) => l.overdue) : [],
        myLoans: open.filter((l) => l.user.id === userId),
      };
    });
  };
}
