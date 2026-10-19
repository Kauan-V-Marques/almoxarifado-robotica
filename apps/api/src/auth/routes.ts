import { loginSchema, type User } from '@almox/shared';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';

import type { Database } from '../db/client.js';
import { refreshTokens, users } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { newRefreshToken, sha256, verifyPassword } from './password.js';
import type { TokenPayload } from './plugin.js';

const REFRESH_COOKIE = 'almox_refresh';
const REFRESH_TTL_DAYS = 7;

export function authRoutes(db: Database, options: { secureCookies: boolean; loginRateLimit: number }) {
  return async (app: FastifyInstance) => {
    const toUser = (u: typeof users.$inferSelect): User => ({ id: u.id, name: u.name, email: u.email, role: u.role });

    async function startSession(reply: FastifyReply, user: typeof users.$inferSelect) {
      const { token, hash } = newRefreshToken();
      await db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
      });
      reply.setCookie(REFRESH_COOKIE, token, {
        httpOnly: true, // JavaScript da página não consegue ler
        secure: options.secureCookies,
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: REFRESH_TTL_DAYS * 86_400,
      });
      const payload: TokenPayload = { sub: String(user.id), name: user.name, role: user.role };
      return { accessToken: await reply.jwtSign(payload), user: toUser(user) };
    }

    // Limite de tentativas por IP contra força bruta
    app.post(
      '/login',
      { config: { rateLimit: { max: options.loginRateLimit, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const { email, password } = loginSchema.parse(request.body);
        const [user] = await db.select().from(users).where(eq(users.email, email));

        // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
          throw new HttpError(401, 'E-mail ou senha incorretos.');
        }
        return startSession(reply, user);
      },
    );

    // Troca o refresh token por um novo par (rotação): cada refresh só pode ser usado uma vez
    app.post('/refresh', async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (!token) throw new HttpError(401, 'Sessão expirada. Faça login novamente.');

      const [stored] = await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.tokenHash, sha256(token)),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!stored) {
        reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
        throw new HttpError(401, 'Sessão expirada. Faça login novamente.');
      }

      const [user] = await db.select().from(users).where(eq(users.id, stored.userId));
      if (!user) throw new HttpError(401, 'Usuário não existe mais.');
      return startSession(reply, user);
    });

    app.post('/logout', async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (token) {
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.tokenHash, sha256(token)));
      }
      reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return reply.status(204).send();
    });

    app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
      const [user] = await db.select().from(users).where(eq(users.id, Number(request.user.sub)));
      if (!user) throw new HttpError(401, 'Usuário não existe mais.');
      return toUser(user);
    });
  };
}
