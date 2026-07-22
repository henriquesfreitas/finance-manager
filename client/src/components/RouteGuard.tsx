/**
 * RouteGuard — wraps protected content and handles redirect logic.
 *
 * - Unauthenticated + not on login page → redirect to /login?returnTo=<current>
 * - Authenticated + on login page        → redirect to returnTo (or /)
 * - Loading                              → full-page spinner (Req 4.4)
 *
 * Navigation uses window.location.replace() (no React Router in this project).
 * The `location` and `navigate` dependencies are injectable for testability.
 *
 * @example
 * <AuthProvider queryClient={queryClient}>
 *   <RouteGuard>
 *     <App />
 *   </RouteGuard>
 * </AuthProvider>
 */

import React from 'react';
import { useAuth } from '../contexts/auth-context';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOGIN_PATH = '/login';

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

/**
 * Full-viewport loading indicator shown while auth state is being determined
 * or while a redirect is in progress (Req 4.4).
 */
function FullPageSpinner(): React.JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div
        role="status"
        aria-label="Loading"
        className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location abstraction (injectable for tests)
// ---------------------------------------------------------------------------

/**
 * Thin abstraction over the browser location and navigation APIs so that
 * RouteGuard can be tested without manipulating the non-configurable
 * `window.location` object in jsdom.
 */
export interface LocationService {
  getPathname(): string;
  getSearch(): string;
  replace(url: string): void;
}

/** Default implementation that delegates to the real window.location. */
export const windowLocationService: LocationService = {
  getPathname: () => window.location.pathname,
  getSearch: () => window.location.search,
  replace: (url: string) => window.location.replace(url),
};

// ---------------------------------------------------------------------------
// RouteGuard
// ---------------------------------------------------------------------------

interface RouteGuardProps {
  children: React.ReactNode;
  /**
   * Injectable location service — defaults to the real window.location.
   * Override in tests to avoid mutating the non-configurable jsdom global.
   */
  locationService?: LocationService;
}

export function RouteGuard({
  children,
  locationService = windowLocationService,
}: RouteGuardProps): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  // Auth state is still being determined on initial load — show spinner so
  // we never flash the wrong page (Req 4.4).
  if (isLoading) {
    return <FullPageSpinner />;
  }

  const currentPath = locationService.getPathname();
  const isOnLoginPage = currentPath === LOGIN_PATH;

  // Not authenticated and not already on login → redirect preserving path
  // so it can be restored after login (Req 4.1).
  if (!isAuthenticated && !isOnLoginPage) {
    const returnTo = encodeURIComponent(
      currentPath + locationService.getSearch(),
    );
    locationService.replace(`${LOGIN_PATH}?returnTo=${returnTo}`);
    // Briefly shown while the redirect is being processed by the browser.
    return <FullPageSpinner />;
  }

  // Authenticated and on the login page → redirect to returnTo or home (Req 4.2).
  if (isAuthenticated && isOnLoginPage) {
    const params = new URLSearchParams(locationService.getSearch());
    const returnTo = params.get('returnTo');
    locationService.replace(returnTo ?? '/');
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
