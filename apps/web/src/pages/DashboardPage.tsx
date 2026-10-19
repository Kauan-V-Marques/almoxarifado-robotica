import { AlertTriangle, Boxes, ClipboardList, PackageCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { useReturnLoan, useDashboard } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, ErrorMessage, formatDate, Loading } from '../components/ui';

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="rounded-lg bg-orange-100 p-2 text-orange-700 dark:bg-orange-950 dark:text-orange-300">{icon}</div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useDashboard();
  const returnLoan = useReturnLoan();

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorMessage>Não foi possível carregar o painel.</ErrorMessage>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Olá, {user?.name.split(' ')[0]}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Boxes size={20} />} label="Tipos de componente" value={data.components} />
        <Stat icon={<PackageCheck size={20} />} label="Unidades disponíveis" value={data.itemsInStock} />
        <Stat icon={<ClipboardList size={20} />} label="Empréstimos em aberto" value={data.openLoans} />
        <Stat icon={<AlertTriangle size={20} />} label="Abaixo do mínimo" value={data.lowStock.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Meus empréstimos">
          {data.myLoans.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">Você não está com nada emprestado.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.myLoans.map((loan) => (
                <li key={loan.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {loan.quantity}× {loan.component.name}
                    </p>
                    <p className="text-zinc-500">
                      Devolver até {formatDate(loan.dueAt)} {loan.overdue && <Badge tone="red">Atrasado</Badge>}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => returnLoan.mutate(loan.id)} disabled={returnLoan.isPending}>
                    Devolver
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Repor estoque">
          {data.lowStock.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">Tudo acima do estoque mínimo.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.lowStock.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{c.name}</span>
                  <Badge tone="orange">
                    {c.available} disponível · mín. {c.minQuantity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {user?.role === 'captain' && (
          <Card title="Empréstimos atrasados">
            {data.overdueLoans.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">Nenhum atraso.</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.overdueLoans.map((loan) => (
                  <li key={loan.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">
                      {loan.user.name}: {loan.quantity}× {loan.component.name}
                    </p>
                    <p className="text-red-600 dark:text-red-400">Venceu em {formatDate(loan.dueAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
