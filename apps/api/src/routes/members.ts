import { newMemberSchema, type User } from '@almox/shared';
import { asc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { hashPassword } from '../auth/password.js';
import type { Database } from '../db/client.js';
import { users } from '../db/schema.js';

/** Só o capitão cadastra e lista membros da equipe. */
export function memberRoutes(db: Database) {
  return async (app: FastifyInstance) => {
    app.addHook('onRequest', app.authenticate);
    app.addHook('onRequest', app.requireCaptain);

    app.get('/', async (): Promise<User[]> =>
      db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .orderBy(asc(users.name)),
    );

    app.post('/', async (request, reply) => {
      const data = newMemberSchema.parse(request.body);
      const [created] = await db
        .insert(users)
        .values({ name: data.name, email: data.email, role: data.role, passwordHash: await hashPassword(data.password) })
        .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
      return reply.status(201).send(created);
    });
  };
}
