import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient, routes } from '../App';
import { AuthProvider } from '../auth/AuthContext';

const IDS = { captain: '1', ana: '2' } as const;

/**
 * Renderiza o app inteiro numa rota. `as` simula alguém já logado:
 * a sessão volta pelo refresh, exatamente como ao recarregar a página.
 */
export function renderApp(path: string, options: { as?: keyof typeof IDS } = {}) {
  if (options.as) sessionStorage.setItem('almox-demo-session', IDS[options.as]);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...view, router, user: userEvent.setup() };
}
