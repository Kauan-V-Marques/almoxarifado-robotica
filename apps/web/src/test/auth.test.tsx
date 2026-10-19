import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { api, startSession } from '../api/client';
import { server } from '../mocks/server';
import { renderApp } from './render';

describe('login', () => {
  it('mostra os erros de validação sem chamar a API', async () => {
    const { user } = renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha')).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando a senha está errada', async () => {
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('E-mail'), 'capitao@almox.dev');
    await user.type(screen.getByLabelText('Senha'), 'senha-errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('entra e vai para o painel', async () => {
    const { user, router } = renderApp('/login');

    await user.type(await screen.findByLabelText('E-mail'), 'Capitao@Almox.dev');
    await user.type(screen.getByLabelText('Senha'), 'robotica123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: /Olá, Capitã/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('rotas protegidas', () => {
  it('quem não está logado vai para o login e volta para a página pedida depois', async () => {
    const { user, router } = renderApp('/emprestimos');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    await user.type(screen.getByLabelText('E-mail'), 'ana@almox.dev');
    await user.type(screen.getByLabelText('Senha'), 'robotica123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/emprestimos'));
  });

  it('membro não acessa a página de membros nem vê o link', async () => {
    const { router } = renderApp('/membros', { as: 'ana' });

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.queryByRole('link', { name: /Membros/ })).not.toBeInTheDocument();
  });
});

describe('cliente HTTP', () => {
  it('quando o token expira, renova sozinho e repete a chamada', async () => {
    sessionStorage.setItem('almox-demo-session', '2');
    startSession({
      accessToken: 'token-expirado',
      user: { id: 2, name: 'Ana Souza', email: 'ana@almox.dev', role: 'member' },
    });
    let calls = 0;
    server.use(
      http.get('*/api/dashboard', ({ request }) => {
        calls++;
        if (request.headers.get('Authorization') === 'Bearer token-expirado') {
          return HttpResponse.json({ error: 'expirado' }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(api('/api/dashboard')).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
  });
});
