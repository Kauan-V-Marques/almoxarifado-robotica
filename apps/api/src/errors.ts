import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} não encontrado.`);
export const forbidden = () => new HttpError(403, 'Você não tem permissão para isso.');
export const conflict = (message: string) => new HttpError(409, message);
export const businessRule = (message: string) => new HttpError(422, message);

/** Código do PostgreSQL para violação de UNIQUE */
const UNIQUE_VIOLATION = '23505';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.') || '_';
        (details[field] ??= []).push(issue.message);
      }
      return reply.status(400).send({ error: 'Dados inválidos.', details });
    }
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    const cause = (error as { cause?: { code?: string } }).cause;
    if ((error as { code?: string }).code === UNIQUE_VIOLATION || cause?.code === UNIQUE_VIOLATION) {
      return reply.status(409).send({ error: 'Já existe um registro com esses dados.' });
    }
    // Erros do próprio Fastify (JSON malformado, corpo grande demais...) já trazem o status
    const { statusCode, message } = error as { statusCode?: number; message?: string };
    if (statusCode && statusCode < 500) {
      return reply.status(statusCode).send({ error: message ?? 'Requisição inválida.' });
    }
    request.log.error(error);
    return reply.status(500).send({ error: 'Erro interno.' });
  });
}
