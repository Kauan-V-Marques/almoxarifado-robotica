import type {
  Category,
  ComponentInput,
  ComponentItem,
  Dashboard,
  Loan,
  LoanInput,
  NewMemberInput,
  User,
} from '@almox/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, put } from './client';

export type LoanStatus = 'open' | 'overdue' | 'returned';

export const keys = {
  components: (search: string, category: Category | '') => ['components', search, category] as const,
  loans: (status: LoanStatus) => ['loans', status] as const,
  dashboard: ['dashboard'] as const,
  members: ['members'] as const,
};

export function useComponents(search = '', category: Category | '' = '') {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  return useQuery({
    queryKey: keys.components(search, category),
    queryFn: () => api<ComponentItem[]>(`/api/components?${params}`),
  });
}

export const useLoans = (status: LoanStatus) =>
  useQuery({ queryKey: keys.loans(status), queryFn: () => api<Loan[]>(`/api/loans?status=${status}`) });

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api<Dashboard>('/api/dashboard') });

export const useMembers = () => useQuery({ queryKey: keys.members, queryFn: () => api<User[]>('/api/members') });

/** Depois de qualquer alteração, estoque, empréstimos e painel são recarregados */
function useInvalidateInventory() {
  const client = useQueryClient();
  return () =>
    Promise.all(['components', 'loans', 'dashboard'].map((key) => client.invalidateQueries({ queryKey: [key] })));
}

export function useSaveComponent() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: ComponentInput }) =>
      id ? put<ComponentItem>(`/api/components/${id}`, data) : post<ComponentItem>('/api/components', data),
    onSuccess: invalidate,
  });
}

export function useBorrow() {
  const invalidate = useInvalidateInventory();
  return useMutation({ mutationFn: (data: LoanInput) => post<Loan>('/api/loans', data), onSuccess: invalidate });
}

export function useReturnLoan() {
  const invalidate = useInvalidateInventory();
  return useMutation({ mutationFn: (id: number) => post<Loan>(`/api/loans/${id}/return`), onSuccess: invalidate });
}

export function useCreateMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: NewMemberInput) => post<User>('/api/members', data),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.members }),
  });
}
