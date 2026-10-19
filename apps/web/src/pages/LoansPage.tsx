import { useState } from 'react';

import { type LoanStatus, useLoans, useReturnLoan } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, ErrorMessage, formatDate, Loading } from '../components/ui';

const TABS: { value: LoanStatus; label: string }[] = [
  { value: 'open', label: 'Em aberto' },
  { value: 'overdue', label: 'Atrasados' },
  { value: 'returned', label: 'Devolvidos' },
];

export function LoansPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<LoanStatus>('open');
  const { data, isLoading, error } = useLoans(status);
  const returnLoan = useReturnLoan();
  const isCaptain = user?.role === 'captain';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{isCaptain ? 'Empréstimos da equipe' : 'Meus empréstimos'}</h1>

      <div role="tablist" aria-label="Situação" className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === tab.value
                ? 'bg-orange-600 text-white'
                : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        {isLoading && <Loading />}
        {error && <ErrorMessage>Não foi possível carregar os empréstimos.</ErrorMessage>}
        {data && data.length === 0 && <p className="p-6 text-sm text-zinc-500">Nada por aqui.</p>}
        {data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-2">Componente</th>
                  {isCaptain && <th className="px-4 py-2">Membro</th>}
                  <th className="px-4 py-2">Finalidade</th>
                  <th className="px-4 py-2">Retirada</th>
                  <th className="px-4 py-2">Prazo</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.map((loan) => (
                  <tr key={loan.id}>
                    <td className="px-4 py-3 font-medium">
                      {loan.quantity}× {loan.component.name}
                    </td>
                    {isCaptain && <td className="px-4 py-3">{loan.user.name}</td>}
                    <td className="px-4 py-3">{loan.purpose}</td>
                    <td className="px-4 py-3">{formatDate(loan.borrowedAt)}</td>
                    <td className="px-4 py-3">
                      {formatDate(loan.dueAt)} {loan.overdue && <Badge tone="red">Atrasado</Badge>}
                      {loan.returnedAt && <Badge tone="green">Devolvido {formatDate(loan.returnedAt)}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!loan.returnedAt && (
                        <Button
                          variant="secondary"
                          onClick={() => returnLoan.mutate(loan.id)}
                          disabled={returnLoan.isPending}
                        >
                          Registrar devolução
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
