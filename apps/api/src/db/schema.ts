import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['captain', 'member']);
export const categoryEnum = pgEnum('category', [
  'sensor',
  'motor',
  'controlador',
  'bateria',
  'eletronica',
  'mecanica',
  'ferramenta',
]);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    email: varchar('email', { length: 120 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

// Guardamos só o hash do refresh token: se o banco vazar, os tokens não servem para nada
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('refresh_tokens_hash_unique').on(t.tokenHash)],
);

export const components = pgTable(
  'components',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    sku: varchar('sku', { length: 20 }).notNull(),
    category: categoryEnum('category').notNull(),
    quantity: integer('quantity').notNull(),
    minQuantity: integer('min_quantity').notNull().default(0),
    location: varchar('location', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('components_sku_unique').on(t.sku),
    check('components_quantity_non_negative', sql`${t.quantity} >= 0`),
    check('components_min_quantity_non_negative', sql`${t.minQuantity} >= 0`),
  ],
);

export const loans = pgTable(
  'loans',
  {
    id: serial('id').primaryKey(),
    componentId: integer('component_id')
      .notNull()
      .references(() => components.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    quantity: integer('quantity').notNull(),
    purpose: varchar('purpose', { length: 120 }).notNull(),
    borrowedAt: timestamp('borrowed_at', { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
  },
  (t) => [
    index('loans_open_idx').on(t.componentId).where(sql`${t.returnedAt} is null`),
    index('loans_user_idx').on(t.userId),
    check('loans_quantity_positive', sql`${t.quantity} > 0`),
  ],
);
