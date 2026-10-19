import { type LoginInput, loginSchema } from '@almox/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wrench } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router';

import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, ErrorMessage, Field } from '../components/ui';

const DEMO = import.meta.env.VITE_DEMO === 'true';

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Depois do login, volta para a página que a pessoa tentou abrir
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await login(data);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : 'Não foi possível conectar à API.');
    }
  });

  const fillDemo = (email: string) => {
    setValue('email', email);
    setValue('password', 'robotica123');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-2">
          <Wrench className="text-orange-600" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Almoxarifado da Equipe</h1>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Field
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {serverError && <ErrorMessage>{serverError}</ErrorMessage>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        {DEMO && (
          <div className="mt-6 rounded-lg bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-200">
            <p className="mb-2 font-semibold">Demonstração (dados fictícios)</p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => fillDemo('capitao@almox.dev')}>
                Entrar como capitão
              </Button>
              <Button type="button" variant="secondary" onClick={() => fillDemo('ana@almox.dev')}>
                Como membro
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
