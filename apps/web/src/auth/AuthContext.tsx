import type { LoginInput, User } from '@almox/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { clearSession, post, refreshSession, setSessionListener, startSession } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    setSessionListener(setUser);
    // Recupera a sessão pelo cookie de refresh (ex.: depois de recarregar a página)
    refreshSession().finally(() => setLoading(false));
  }, []);

  const value: AuthState = {
    user,
    loading,
    login: async (credentials) => {
      startSession(await post<{ accessToken: string; user: User }>('/api/auth/login', credentials));
    },
    logout: async () => {
      await post('/api/auth/logout').catch(() => undefined);
      clearSession();
      queryClient.clear();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}
