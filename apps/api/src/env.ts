import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://almox:almox@localhost:5432/almox'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de pelo menos 32 caracteres'),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Tentativas de login por minuto por IP (proteção contra força bruta)
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  // Atrás de um proxy (nginx, Ingress): o IP do cliente vem do X-Forwarded-For
  TRUST_PROXY: z.stringbool().default(false),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configuração inválida: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
