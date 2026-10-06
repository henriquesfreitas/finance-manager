import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/auth-context';
import { RouteGuard } from './components/RouteGuard';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { BillsControlPage } from './pages/BillsControlPage';
import { ThemeProvider, useTheme } from './contexts/theme-context';

// QueryClient is created outside the component so it isn't re-created on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — matches server-side Yahoo Finance cache TTL
      retry: 1,
    },
  },
});

/**
 * URL-based routing without a router library.
 * RouteGuard handles auth redirects; AppContent picks which page to render
 * based on the current pathname.
 */
function AppContent(): React.JSX.Element {
  const isLoginPage = window.location.pathname === '/login';
  const isBillsControlPage = window.location.pathname === '/bills-control';

  if (isLoginPage) {
    return <LoginPage />;
  }

  if (isBillsControlPage) {
    return <BillsControlPage />;
  }

  return <HomePage />;
}

function ThemedToaster(): React.JSX.Element {
  const { theme } = useTheme();
  return <Toaster position="bottom-right" richColors closeButton theme={theme} />;
}

export default function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {/* AuthProvider needs queryClient to clear the cache on logout (Req 5.3) */}
        <AuthProvider queryClient={queryClient}>
          {/* RouteGuard is inside AuthProvider so it can read auth state (Req 4.1, 4.2) */}
          <RouteGuard>
            <AppContent />
          </RouteGuard>
          {/* Toaster positioned at bottom-right, auto-dismissed after 4 s */}
          <ThemedToaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
