/**
 * Auth context providing authentication state and actions to the component tree.
 * Restores session on mount via fetchCurrentAdmin(), handles 5s timeout for auth check,
 * and clears TanStack Query cache on logout.
 *
 * @example
 * <AuthProvider queryClient={queryClient}>
 *   <App />
 * </AuthProvider>
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { QueryClient } from '@tanstack/react-query';
import * as authApiClient from '../services/auth-api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminIdentity {
  id: string;
  username: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: AdminIdentity | null;
}

interface AuthActions {
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export interface AuthContextValue extends AuthState, AuthActions {}

interface AuthProviderProps {
  children: React.ReactNode;
  queryClient: QueryClient;
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

/**
 * Races a promise against a timer. Rejects with an Error('Timeout') when
 * the timer fires first.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms),
  );
  return Promise.race([promise, timeout]);
}

const AUTH_CHECK_TIMEOUT_MS = 5_000;
const LOGOUT_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({
  children,
  queryClient,
}: AuthProviderProps): React.JSX.Element {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    admin: null,
  });

  // On mount: attempt to restore session from the httpOnly cookie.
  // If the check takes > 5 s, or the server returns 401 / any error, we
  // simply treat the user as unauthenticated (Req 4.4, 4.5).
  useEffect(() => {
    let cancelled = false;

    async function restoreSession(): Promise<void> {
      try {
        const { admin } = await withTimeout(
          authApiClient.fetchCurrentAdmin(),
          AUTH_CHECK_TIMEOUT_MS,
        );

        if (cancelled) return;

        setState({
          isAuthenticated: true,
          isLoading: false,
          admin: { id: admin.id, username: admin.username },
        });
      } catch {
        // 401, timeout, or network error — not authenticated (Req 4.5)
        if (cancelled) return;
        setState({ isAuthenticated: false, isLoading: false, admin: null });
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // login — delegates to the API client; errors propagate to the caller so
  // the Login page can display field-level feedback (Req 1.2, 1.6, 1.7).
  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const { admin } = await authApiClient.login(username, password);
      setState({
        isAuthenticated: true,
        isLoading: false,
        admin: { id: admin.id, username: admin.username },
      });
    },
    [],
  );

  // logout — wraps the API call in a 10-second timeout.
  // Regardless of success or failure we clear local state and the TanStack
  // Query cache (Req 5.2, 5.3, 5.4, 5.5). Navigation to /login is the
  // RouteGuard's responsibility, not ours.
  const logout = useCallback(async (): Promise<void> => {
    try {
      await withTimeout(authApiClient.logout(), LOGOUT_TIMEOUT_MS);
    } catch {
      // Network failure or timeout — still clean up locally (Req 5.4, 5.5)
    } finally {
      setState({ isAuthenticated: false, isLoading: false, admin: null });
      queryClient.clear();
    }
  }, [queryClient]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the auth context value. Must be called inside an AuthProvider.
 *
 * @example
 * const { isAuthenticated, login, logout } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
