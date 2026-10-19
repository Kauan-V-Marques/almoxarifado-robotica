// API simulada no navegador (MSW) para a demonstração no GitHub Pages e para os testes.
// Segue as mesmas regras da API real; os dados ficam na memória e voltam ao inicial ao recarregar.
import {
  componentSchema,
  type ComponentItem,
  type Loan,
  loanSchema,
  loginSchema,
  newMemberSchema,
  type Role,
  type User,
} from '@almox/shared';
import { http, HttpResponse } from 'msw';
import { ZodError } from 'zod';

const DAY = 86_400_000;
const PASSWORD = 'robotica123';
const SESSION_KEY = 'almox-demo-session';

type StoredComponent = Omit<ComponentItem, 'onLoan' | 'available' | 'lowStock'>;
interface StoredLoan {
  id: number;
  componentId: number;
  userId: number;
  quantity: number;
  purpose: string;
  borrowedAt: number;
  dueAt: number;
  returnedAt: number | null;
}

let users: (User & { password: string })[] = [];
let components: StoredComponent[] = [];
let loans: StoredLoan[] = [];
let nextId = 100;

export function resetMockData() {
  const now = Date.now();
  users = [
    { id: 1, name: 'Capitã Demo', email: 'capitao@almox.dev', role: 'captain', password: PASSWORD },
    { id: 2, name: 'Ana Souza', email: 'ana@almox.dev', role: 'member', password: PASSWORD },
    { id: 3, name: 'Bruno Lima', email: 'bruno@almox.dev', role: 'member', password: PASSWORD },
  ];
  components = [
    { id: 1, name: 'Sensor de refletância QTR-8A', sku: 'SEN-QTR8A', category: 'sensor', quantity: 6, minQuantity: 2, location: 'Gaveta A1' },
    { id: 2, name: 'Sensor ultrassônico HC-SR04', sku: 'SEN-HCSR04', category: 'sensor', quantity: 10, minQuantity: 4, location: 'Gaveta A1' },
    { id: 3, name: 'Motor N20 1000 rpm', sku: 'MOT-N20-1K', category: 'motor', quantity: 12, minQuantity: 4, location: 'Gaveta B2' },
    { id: 4, name: 'Ponte H TB6612FNG', sku: 'DRV-TB6612', category: 'eletronica', quantity: 5, minQuantity: 2, location: 'Gaveta C1' },
    { id: 5, name: 'ESP32 DevKit V1', sku: 'MCU-ESP32', category: 'controlador', quantity: 4, minQuantity: 2, location: 'Armário 1' },
    { id: 6, name: 'Arduino Nano', sku: 'MCU-NANO', category: 'controlador', quantity: 6, minQuantity: 2, location: 'Armário 1' },
    { id: 7, name: 'Bateria LiPo 2S 850 mAh', sku: 'BAT-2S-850', category: 'bateria', quantity: 4, minQuantity: 3, location: 'Caixa antichamas' },
    { id: 8, name: 'Roda de silicone 34 mm', sku: 'MEC-RODA34', category: 'mecanica', quantity: 16, minQuantity: 4, location: 'Gaveta D3' },
    { id: 9, name: 'Ferro de solda 60 W', sku: 'FER-SOLDA60', category: 'ferramenta', quantity: 3, minQuantity: 1, location: 'Bancada' },
  ];
  loans = [
    { id: 1, componentId: 5, userId: 2, quantity: 2, purpose: 'Seguidor de linha novo', borrowedAt: now - 3 * DAY, dueAt: now + 4 * DAY, returnedAt: null },
    { id: 2, componentId: 7, userId: 3, quantity: 2, purpose: 'Testes do sumô 500 g', borrowedAt: now - 10 * DAY, dueAt: now - 2 * DAY, returnedAt: null },
    { id: 3, componentId: 1, userId: 1, quantity: 1, purpose: 'Calibração da barra de sensores', borrowedAt: now - DAY, dueAt: now + 6 * DAY, returnedAt: null },
    { id: 4, componentId: 3, userId: 3, quantity: 2, purpose: 'Troca de motores', borrowedAt: now - 20 * DAY, dueAt: now - 13 * DAY, returnedAt: now - 14 * DAY },
  ];
}
resetMockData();

// ---------- regras (as mesmas da API real) ----------

const onLoan = (componentId: number) =>
  loans.filter((l) => l.componentId === componentId && l.returnedAt === null).reduce((s, l) => s + l.quantity, 0);

function toComponent(c: StoredComponent): ComponentItem {
  const out = onLoan(c.id);
  const available = c.quantity - out;
  return { ...c, onLoan: out, available, lowStock: available <= c.minQuantity };
}

function toLoan(l: StoredLoan): Loan {
  const c = components.find((x) => x.id === l.componentId)!;
  const u = users.find((x) => x.id === l.userId)!;
  return {
    id: l.id,
    component: { id: c.id, name: c.name, sku: c.sku },
    user: { id: u.id, name: u.name },
    quantity: l.quantity,
    purpose: l.purpose,
    borrowedAt: new Date(l.borrowedAt).toISOString(),
    dueAt: new Date(l.dueAt).toISOString(),
    returnedAt: l.returnedAt ? new Date(l.returnedAt).toISOString() : null,
    overdue: l.returnedAt === null && l.dueAt < Date.now(),
  };
}

const error = (status: number, message: string) => HttpResponse.json({ error: message }, { status });

function validationError(e: ZodError) {
  const details: Record<string, string[]> = {};
  for (const issue of e.issues) (details[issue.path.join('.') || '_'] ??= []).push(issue.message);
  return HttpResponse.json({ error: 'Dados inválidos.', details }, { status: 400 });
}

/** Token falso "demo.<id>.<role>" — o suficiente para simular a autenticação */
function currentUser(request: Request): { id: number; role: Role } | null {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const [, id, role] = token?.split('.') ?? [];
  return id && role ? { id: Number(id), role: role as Role } : null;
}

function session(user: User) {
  sessionStorage.setItem(SESSION_KEY, String(user.id));
  return { accessToken: `demo.${user.id}.${user.role}`, user: publicUser(user) };
}

const publicUser = ({ id, name, email, role }: User): User => ({ id, name, email, role });

async function body(request: Request): Promise<unknown> {
  return request.json().catch(() => ({}));
}

export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const parsed = loginSchema.safeParse(await body(request));
    if (!parsed.success) return validationError(parsed.error);
    const user = users.find((u) => u.email === parsed.data.email && u.password === parsed.data.password);
    return user ? HttpResponse.json(session(user)) : error(401, 'E-mail ou senha incorretos.');
  }),

  http.post('*/api/auth/refresh', () => {
    const user = users.find((u) => String(u.id) === sessionStorage.getItem(SESSION_KEY));
    return user ? HttpResponse.json(session(user)) : error(401, 'Sessão expirada. Faça login novamente.');
  }),

  http.post('*/api/auth/logout', () => {
    sessionStorage.removeItem(SESSION_KEY);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/components', ({ request }) => {
    if (!currentUser(request)) return error(401, 'Sessão expirada.');
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const category = url.searchParams.get('category');
    return HttpResponse.json(
      components
        .filter((c) => !search || c.name.toLowerCase().includes(search) || c.sku.toLowerCase().includes(search))
        .filter((c) => !category || c.category === category)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toComponent),
    );
  }),

  http.post('*/api/components', async ({ request }) => {
    const user = currentUser(request);
    if (!user) return error(401, 'Sessão expirada.');
    if (user.role !== 'captain') return error(403, 'Você não tem permissão para isso.');
    const parsed = componentSchema.safeParse(await body(request));
    if (!parsed.success) return validationError(parsed.error);
    if (components.some((c) => c.sku === parsed.data.sku)) return error(409, 'Já existe um registro com esses dados.');
    const created = { id: nextId++, ...parsed.data };
    components.push(created);
    return HttpResponse.json(toComponent(created), { status: 201 });
  }),

  http.put('*/api/components/:id', async ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return error(401, 'Sessão expirada.');
    if (user.role !== 'captain') return error(403, 'Você não tem permissão para isso.');
    const parsed = componentSchema.safeParse(await body(request));
    if (!parsed.success) return validationError(parsed.error);
    const index = components.findIndex((c) => c.id === Number(params.id));
    if (index < 0) return error(404, 'Componente não encontrado.');
    const out = onLoan(Number(params.id));
    if (parsed.data.quantity < out) {
      return error(422, `Há ${out} unidade(s) emprestada(s); a quantidade não pode ficar abaixo disso.`);
    }
    components[index] = { id: Number(params.id), ...parsed.data };
    return HttpResponse.json(toComponent(components[index]!));
  }),

  http.get('*/api/loans', ({ request }) => {
    const user = currentUser(request);
    if (!user) return error(401, 'Sessão expirada.');
    const status = new URL(request.url).searchParams.get('status');
    const now = Date.now();
    return HttpResponse.json(
      loans
        .filter((l) => user.role === 'captain' || l.userId === user.id)
        .filter((l) =>
          status === 'open'
            ? l.returnedAt === null
            : status === 'returned'
              ? l.returnedAt !== null
              : status === 'overdue'
                ? l.returnedAt === null && l.dueAt < now
                : true,
        )
        .sort((a, b) => b.borrowedAt - a.borrowedAt)
        .map(toLoan),
    );
  }),

  http.post('*/api/loans', async ({ request }) => {
    const user = currentUser(request);
    if (!user) return error(401, 'Sessão expirada.');
    const parsed = loanSchema.safeParse(await body(request));
    if (!parsed.success) return validationError(parsed.error);
    const component = components.find((c) => c.id === parsed.data.componentId);
    if (!component) return error(404, 'Componente não encontrado.');
    const available = component.quantity - onLoan(component.id);
    if (parsed.data.quantity > available) {
      return error(422, `Só há ${available} unidade(s) de ${component.name} disponível(is).`);
    }
    const loan: StoredLoan = {
      id: nextId++,
      componentId: component.id,
      userId: user.id,
      quantity: parsed.data.quantity,
      purpose: parsed.data.purpose,
      borrowedAt: Date.now(),
      dueAt: Date.now() + parsed.data.days * DAY,
      returnedAt: null,
    };
    loans.push(loan);
    return HttpResponse.json(toLoan(loan), { status: 201 });
  }),

  http.post('*/api/loans/:id/return', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return error(401, 'Sessão expirada.');
    const loan = loans.find((l) => l.id === Number(params.id));
    if (!loan) return error(404, 'Empréstimo não encontrado.');
    if (user.role !== 'captain' && loan.userId !== user.id) return error(403, 'Você não tem permissão para isso.');
    if (loan.returnedAt !== null) return error(422, 'Este empréstimo já foi devolvido.');
    loan.returnedAt = Date.now();
    return HttpResponse.json(toLoan(loan));
  }),

  http.get('*/api/dashboard', ({ request }) => {
    const user = currentUser(request);
    if (!user) return error(401, 'Sessão expirada.');
    const all = components.map(toComponent);
    const open = loans.filter((l) => l.returnedAt === null).map(toLoan);
    return HttpResponse.json({
      components: all.length,
      itemsInStock: all.reduce((sum, c) => sum + c.available, 0),
      lowStock: all.filter((c) => c.lowStock),
      openLoans: open.length,
      overdueLoans: user.role === 'captain' ? open.filter((l) => l.overdue) : [],
      myLoans: open.filter((l) => l.user.id === user.id),
    });
  }),

  http.get('*/api/members', ({ request }) => {
    const user = currentUser(request);
    if (!user) return error(401, 'Sessão expirada.');
    if (user.role !== 'captain') return error(403, 'Você não tem permissão para isso.');
    return HttpResponse.json(users.map(publicUser).sort((a, b) => a.name.localeCompare(b.name)));
  }),

  http.post('*/api/members', async ({ request }) => {
    const user = currentUser(request);
    if (!user) return error(401, 'Sessão expirada.');
    if (user.role !== 'captain') return error(403, 'Você não tem permissão para isso.');
    const parsed = newMemberSchema.safeParse(await body(request));
    if (!parsed.success) return validationError(parsed.error);
    if (users.some((u) => u.email === parsed.data.email)) return error(409, 'Já existe um registro com esses dados.');
    const created = { id: nextId++, ...parsed.data };
    users.push(created);
    return HttpResponse.json(publicUser(created), { status: 201 });
  }),
];
