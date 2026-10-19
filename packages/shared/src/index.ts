// Regras de validação usadas tanto pela API quanto pelos formulários do front-end.
import { z } from 'zod';

export const ROLES = ['captain', 'member'] as const;
export type Role = (typeof ROLES)[number];

export const CATEGORIES = {
  sensor: 'Sensor',
  motor: 'Motor e redução',
  controlador: 'Microcontrolador',
  bateria: 'Bateria',
  eletronica: 'Eletrônica',
  mecanica: 'Mecânica',
  ferramenta: 'Ferramenta',
} as const;
export type Category = keyof typeof CATEGORIES;
const categoryKeys = Object.keys(CATEGORIES) as [Category, ...Category[]];

// Limpa espaços e maiúsculas antes de validar o formato
const email = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const newMemberSchema = z.object({
  name: z.string().trim().min(3, 'Nome muito curto').max(80),
  email,
  password: z
    .string()
    .min(8, 'Mínimo de 8 caracteres')
    .regex(/[A-Za-z]/, 'Use pelo menos uma letra')
    .regex(/\d/, 'Use pelo menos um número'),
  role: z.enum(ROLES).default('member'),
});
export type NewMemberInput = z.input<typeof newMemberSchema>;

export const componentSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(80),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,20}$/, 'Use de 3 a 20 letras, números ou hífen'),
  category: z.enum(categoryKeys, 'Escolha uma categoria'),
  quantity: z.coerce.number().int('Use um número inteiro').min(0, 'Não pode ser negativo').max(10_000),
  minQuantity: z.coerce.number().int('Use um número inteiro').min(0, 'Não pode ser negativo').max(10_000),
  location: z.string().trim().min(1, 'Informe onde fica guardado').max(40),
});
export type ComponentInput = z.input<typeof componentSchema>;

export const loanSchema = z.object({
  componentId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int('Use um número inteiro').positive('Pelo menos 1'),
  purpose: z.string().trim().min(3, 'Diga para que vai usar').max(120),
  days: z.coerce.number().int().min(1, 'Mínimo de 1 dia').max(60, 'Máximo de 60 dias'),
});
export type LoanInput = z.input<typeof loanSchema>;

// Formatos de resposta da API
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface ComponentItem {
  id: number;
  name: string;
  sku: string;
  category: Category;
  quantity: number;
  minQuantity: number;
  location: string;
  onLoan: number;
  available: number;
  lowStock: boolean;
}

export interface Loan {
  id: number;
  component: { id: number; name: string; sku: string };
  user: { id: number; name: string };
  quantity: number;
  purpose: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  overdue: boolean;
}

export interface Dashboard {
  components: number;
  itemsInStock: number;
  lowStock: ComponentItem[];
  openLoans: number;
  overdueLoans: Loan[];
  myLoans: Loan[];
}

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}
