import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { HomePage } from './pages/HomePage';

// QueryClient is created outside the component so it isn't re-created on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — matches server-side Yahoo Finance cache TTL
      retry: 1,
    },
  },
});

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <HomePage />
      {/* Toaster positioned at bottom-right, auto-dismissed after 4 s */}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
