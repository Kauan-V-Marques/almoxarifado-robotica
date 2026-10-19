import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { ApiRequestError } from './api/client';
import { AuthProvider } from './auth/AuthContext';
import { Layout, RequireAuth, RequireCaptain } from './components/Layout';
import { ComponentsPage } from './pages/ComponentsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoansPage } from './pages/LoansPage';
import { LoginPage } from './pages/LoginPage';
import { MembersPage } from './pages/MembersPage';

export const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'componentes', element: <ComponentsPage /> },
          { path: 'emprestimos', element: <LoansPage /> },
          { element: <RequireCaptain />, children: [{ path: 'membros', element: <MembersPage /> }] },
        ],
      },
    ],
  },
];

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Erros 4xx (permissão, validação) não adianta repetir
        retry: (count, error) => !(error instanceof ApiRequestError && error.status < 500) && count < 2,
      },
    },
  });
}

const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });
const queryClient = createQueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
