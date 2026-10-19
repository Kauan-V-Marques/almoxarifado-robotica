import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from './render';

const row = (name: string) => screen.getByText(name).closest('tr')!;

describe('componentes', () => {
  it('membro não vê o botão de cadastrar; capitão vê', async () => {
    renderApp('/componentes', { as: 'ana' });
    await screen.findByText('ESP32 DevKit V1');
    expect(screen.queryByRole('button', { name: /Novo componente/ })).not.toBeInTheDocument();
  });

  it('capitão cadastra um componente novo', async () => {
    const { user } = renderApp('/componentes', { as: 'captain' });

    await user.click(await screen.findByRole('button', { name: /Novo componente/ }));
    const dialog = screen.getByRole('dialog', { name: 'Novo componente' });
    await user.type(within(dialog).getByLabelText('Nome'), 'Servo MG90S');
    await user.type(within(dialog).getByLabelText('Código (SKU)'), 'mot-mg90s');
    await user.selectOptions(within(dialog).getByLabelText('Categoria'), 'motor');
    await user.clear(within(dialog).getByLabelText('Quantidade'));
    await user.type(within(dialog).getByLabelText('Quantidade'), '8');
    await user.type(within(dialog).getByLabelText('Onde fica guardado'), 'Gaveta B3');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('MOT-MG90S')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('busca por nome ou código', async () => {
    const { user } = renderApp('/componentes', { as: 'ana' });
    await screen.findByText('ESP32 DevKit V1');

    await user.type(screen.getByLabelText('Buscar por nome ou código'), 'sen-');

    expect(await screen.findByText('Sensor ultrassônico HC-SR04')).toBeInTheDocument();
    expect(screen.queryByText('ESP32 DevKit V1')).not.toBeInTheDocument();
  });

  it('pegar emprestado atualiza o disponível', async () => {
    const { user } = renderApp('/componentes', { as: 'ana' });
    await screen.findByText('Motor N20 1000 rpm');
    expect(within(row('Motor N20 1000 rpm')).getByText('12/12')).toBeInTheDocument();

    await user.click(within(row('Motor N20 1000 rpm')).getByRole('button', { name: 'Pegar emprestado' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Quantidade'));
    await user.type(within(dialog).getByLabelText('Quantidade'), '4');
    await user.type(within(dialog).getByLabelText('Para que vai usar?'), 'Robô de sumô novo');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar empréstimo' }));

    expect(await within(row('Motor N20 1000 rpm')).findByText('8/12')).toBeInTheDocument();
  });

  it('mostra o erro da API ao pedir mais do que há disponível', async () => {
    const { user } = renderApp('/componentes', { as: 'ana' });
    await screen.findByText('ESP32 DevKit V1');

    await user.click(within(row('ESP32 DevKit V1')).getByRole('button', { name: 'Pegar emprestado' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Quantidade'));
    await user.type(within(dialog).getByLabelText('Quantidade'), '3');
    await user.type(within(dialog).getByLabelText('Para que vai usar?'), 'Teste');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar empréstimo' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Só há 2 unidade(s)');
  });
});
