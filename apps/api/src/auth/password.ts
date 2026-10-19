import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

/** Formato salvo no banco: scrypt$<salt em base64>$<hash em base64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltB64, hashB64] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  // Comparação em tempo constante: não revela quantos bytes acertou
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Token opaco e aleatório para o refresh; no banco vai só o SHA-256 dele. */
export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
