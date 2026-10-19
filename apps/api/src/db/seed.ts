import { hashPassword } from '../auth/password.js';
import type { Database } from './client.js';
import { components, loans, refreshTokens, users } from './schema.js';

export const DEMO_PASSWORD = 'robotica123';

const DAY = 86_400_000;

/** Equipe e almoxarifado fictícios para testar a aplicação. */
export async function seed(db: Database) {
  await db.delete(loans);
  await db.delete(refreshTokens);
  await db.delete(components);
  await db.delete(users);

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [captain, ana, bruno] = await db
    .insert(users)
    .values([
      { name: 'Capitã Demo', email: 'capitao@almox.dev', role: 'captain', passwordHash },
      { name: 'Ana Souza', email: 'ana@almox.dev', role: 'member', passwordHash },
      { name: 'Bruno Lima', email: 'bruno@almox.dev', role: 'member', passwordHash },
    ])
    .returning();

  const items = await db
    .insert(components)
    .values([
      { name: 'Sensor de refletância QTR-8A', sku: 'SEN-QTR8A', category: 'sensor', quantity: 6, minQuantity: 2, location: 'Gaveta A1' },
      { name: 'Sensor ultrassônico HC-SR04', sku: 'SEN-HCSR04', category: 'sensor', quantity: 10, minQuantity: 4, location: 'Gaveta A1' },
      { name: 'Motor N20 1000 rpm', sku: 'MOT-N20-1K', category: 'motor', quantity: 12, minQuantity: 4, location: 'Gaveta B2' },
      { name: 'Ponte H TB6612FNG', sku: 'DRV-TB6612', category: 'eletronica', quantity: 5, minQuantity: 2, location: 'Gaveta C1' },
      { name: 'ESP32 DevKit V1', sku: 'MCU-ESP32', category: 'controlador', quantity: 4, minQuantity: 2, location: 'Armário 1' },
      { name: 'Arduino Nano', sku: 'MCU-NANO', category: 'controlador', quantity: 6, minQuantity: 2, location: 'Armário 1' },
      { name: 'Bateria LiPo 2S 850 mAh', sku: 'BAT-2S-850', category: 'bateria', quantity: 4, minQuantity: 3, location: 'Caixa antichamas' },
      { name: 'Roda de silicone 34 mm', sku: 'MEC-RODA34', category: 'mecanica', quantity: 16, minQuantity: 4, location: 'Gaveta D3' },
      { name: 'Ferro de solda 60 W', sku: 'FER-SOLDA60', category: 'ferramenta', quantity: 3, minQuantity: 1, location: 'Bancada' },
    ])
    .returning();

  const bySku = Object.fromEntries(items.map((c) => [c.sku, c]));
  const now = Date.now();
  await db.insert(loans).values([
    { componentId: bySku['MCU-ESP32']!.id, userId: ana!.id, quantity: 2, purpose: 'Seguidor de linha novo', borrowedAt: new Date(now - 3 * DAY), dueAt: new Date(now + 4 * DAY) },
    { componentId: bySku['BAT-2S-850']!.id, userId: bruno!.id, quantity: 2, purpose: 'Testes do sumô 500 g', borrowedAt: new Date(now - 10 * DAY), dueAt: new Date(now - 2 * DAY) },
    { componentId: bySku['SEN-QTR8A']!.id, userId: captain!.id, quantity: 1, purpose: 'Calibração da barra de sensores', borrowedAt: new Date(now - 1 * DAY), dueAt: new Date(now + 6 * DAY) },
    { componentId: bySku['MOT-N20-1K']!.id, userId: bruno!.id, quantity: 2, purpose: 'Troca de motores', borrowedAt: new Date(now - 20 * DAY), dueAt: new Date(now - 13 * DAY), returnedAt: new Date(now - 14 * DAY) },
  ]);

  return { users: 3, components: items.length, loans: 4, password: DEMO_PASSWORD };
}
