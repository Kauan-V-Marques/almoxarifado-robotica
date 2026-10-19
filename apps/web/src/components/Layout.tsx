import { Boxes, ClipboardList, LayoutDashboard, LogOut, Users, Wrench } from 'lucide-react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { Loading } from './ui';

const link = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
  ].join(' ');

/** Só deixa passar quem está logado; quem não está vai para o login e volta depois. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequireCaptain() {
  const { user } = useAuth();
  return user?.role === 'captain' ? <Outlet /> : <Navigate to="/" replace />;
}

export function Layout() {
  const { user, logout } = useAuth();
  const isCaptain = user?.role === 'captain';

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            <Wrench className="text-orange-600" size={22} />
            Almoxarifado da Equipe
          </div>
          <nav className="flex flex-wrap gap-1" aria-label="Principal">
            <NavLink to="/" end className={link}>
              <LayoutDashboard size={16} /> Painel
            </NavLink>
            <NavLink to="/componentes" className={link}>
              <Boxes size={16} /> Componentes
            </NavLink>
            <NavLink to="/emprestimos" className={link}>
              <ClipboardList size={16} /> Empréstimos
            </NavLink>
            {isCaptain && (
              <NavLink to="/membros" className={link}>
                <Users size={16} /> Membros
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {user?.name} · {isCaptain ? 'Capitão' : 'Membro'}
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
