import {
  CATEGORIES,
  type Category,
  type ComponentInput,
  type ComponentItem,
  componentSchema,
  type LoanInput,
  loanSchema,
} from '@almox/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ApiRequestError } from '../api/client';
import { useBorrow, useComponents, useSaveComponent } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, ErrorMessage, Field, Loading, Modal } from '../components/ui';

const categoryEntries = Object.entries(CATEGORIES) as [Category, string][];
const selectClass =
  'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

function ComponentForm({ item, onDone }: { item?: ComponentItem; onDone: () => void }) {
  const save = useSaveComponent();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ComponentInput, unknown, z.output<typeof componentSchema>>({
    resolver: zodResolver(componentSchema),
    defaultValues: item ?? { category: 'sensor', quantity: 1, minQuantity: 0 },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await save.mutateAsync({ id: item?.id, data });
      onDone();
    } catch {
      // a mensagem da API aparece pelo save.error
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <Field label="Nome" error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Código (SKU)" error={errors.sku?.message} {...register('sku')} />
        <div className="flex flex-col gap-1">
          <label htmlFor="categoria" className="text-sm font-medium">
            Categoria
          </label>
          <select id="categoria" className={selectClass} {...register('category')}>
            {categoryEntries.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Field label="Quantidade" type="number" error={errors.quantity?.message} {...register('quantity')} />
        <Field label="Estoque mínimo" type="number" error={errors.minQuantity?.message} {...register('minQuantity')} />
      </div>
      <Field label="Onde fica guardado" error={errors.location?.message} {...register('location')} />
      {save.error && <ErrorMessage>{(save.error as ApiRequestError).message}</ErrorMessage>}
      <Button type="submit" disabled={isSubmitting}>
        Salvar
      </Button>
    </form>
  );
}

function BorrowForm({ item, onDone }: { item: ComponentItem; onDone: () => void }) {
  const borrow = useBorrow();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoanInput, unknown, z.output<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: { componentId: item.id, quantity: 1, days: 7, purpose: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await borrow.mutateAsync(data);
      onDone();
    } catch {
      // a mensagem da API aparece pelo borrow.error
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {item.available} unidade(s) disponível(is) · guardado em {item.location}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Quantidade"
          type="number"
          min={1}
          max={item.available}
          error={errors.quantity?.message}
          {...register('quantity')}
        />
        <Field label="Prazo (dias)" type="number" min={1} max={60} error={errors.days?.message} {...register('days')} />
      </div>
      <Field label="Para que vai usar?" error={errors.purpose?.message} {...register('purpose')} />
      {borrow.error && <ErrorMessage>{(borrow.error as ApiRequestError).message}</ErrorMessage>}
      <Button type="submit" disabled={isSubmitting}>
        Confirmar empréstimo
      </Button>
    </form>
  );
}

type Dialog = { kind: 'new' } | { kind: 'edit'; item: ComponentItem } | { kind: 'borrow'; item: ComponentItem } | null;

export function ComponentsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const { data, isLoading, error } = useComponents(search.trim(), category);
  const isCaptain = user?.role === 'captain';
  const close = () => setDialog(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Componentes</h1>
        {isCaptain && (
          <Button onClick={() => setDialog({ kind: 'new' })}>
            <Plus size={16} /> Novo componente
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-2.5 left-3 text-zinc-400" size={16} />
          <input
            aria-label="Buscar por nome ou código"
            placeholder="Buscar por nome ou código"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${selectClass} w-full pl-9`}
          />
        </div>
        <select
          aria-label="Filtrar por categoria"
          value={category}
          onChange={(event) => setCategory(event.target.value as Category | '')}
          className={selectClass}
        >
          <option value="">Todas as categorias</option>
          {categoryEntries.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {isLoading && <Loading />}
        {error && <ErrorMessage>Não foi possível carregar os componentes.</ErrorMessage>}
        {data && data.length === 0 && <p className="p-6 text-sm text-zinc-500">Nenhum componente encontrado.</p>}
        {data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-2">Componente</th>
                  <th className="px-4 py-2">Categoria</th>
                  <th className="px-4 py-2">Local</th>
                  <th className="px-4 py-2 text-right">Disponível</th>
                  <th className="px-4 py-2 text-right">Emprestado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-zinc-500">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3">{CATEGORIES[item.category]}</td>
                    <td className="px-4 py-3">{item.location}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.available}/{item.quantity}{' '}
                      {item.lowStock && <Badge tone="orange">Repor</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.onLoan}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          disabled={item.available === 0}
                          onClick={() => setDialog({ kind: 'borrow', item })}
                        >
                          Pegar emprestado
                        </Button>
                        {isCaptain && (
                          <Button
                            variant="ghost"
                            aria-label={`Editar ${item.name}`}
                            onClick={() => setDialog({ kind: 'edit', item })}
                          >
                            <Pencil size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog?.kind === 'new' && (
        <Modal title="Novo componente" onClose={close}>
          <ComponentForm onDone={close} />
        </Modal>
      )}
      {dialog?.kind === 'edit' && (
        <Modal title={`Editar ${dialog.item.name}`} onClose={close}>
          <ComponentForm item={dialog.item} onDone={close} />
        </Modal>
      )}
      {dialog?.kind === 'borrow' && (
        <Modal title={`Pegar ${dialog.item.name}`} onClose={close}>
          <BorrowForm item={dialog.item} onDone={close} />
        </Modal>
      )}
    </div>
  );
}
