import type { Role } from '@almox/shared';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { forbidden } from '../errors.js';

export interface TokenPayload {
  sub: string; // RFC 7519: o "subject" é texto
  name: string;
  role: Role;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireCaptain: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const ACCESS_TOKEN_TTL = '15m';

/** Access token curto (15 min) no header Authorization; o refresh fica num cookie httpOnly. */
export const authPlugin = fp(async (app: FastifyInstance, options: { secret: string }) => {
  await app.register(fastifyJwt, { secret: options.secret, sign: { expiresIn: ACCESS_TOKEN_TTL } });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
    }
  });

  app.decorate('requireCaptain', async (request: FastifyRequest) => {
    if (request.user.role !== 'captain') throw forbidden();
  });
});
