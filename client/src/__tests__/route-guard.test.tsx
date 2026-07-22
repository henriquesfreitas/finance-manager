/**
 * Unit tests for RouteGuard component.
 *
 * Strategy:
 * - Mock useAuth to control isAuthenticated / isLoading state.
 * - Pass a fake LocationService to RouteGuard so we never touch the
 *   non-configurable window.location global in jsdom.
 * - Test the four distinct behaviours:
 *   1. Loading state → full-page spinner (Req 4.4)
 *   2. Not authenticated + not on login page → redirect with ?returnTo= (Req 4.1)
 *   3. Authenticated + on login page → redirect to returnTo (or /) (Req 4.2)
 *   4. Authenticated + not on login page → render children
 *
 * Module isolation strategy:
 * Uses vi.doMock + vi.resetModules() in beforeEach so this file always gets
 * a fresh module graph regardless of what sibling test files (e.g.
 * auth-context.test.tsx, which imports the real AuthProvider) have done to
 * the shared vmForks module cache.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

// Resolved modules — populated fresh in each beforeEach via dynamic import.
let RouteGuard: (typeof import('../components/RouteGuard'))['RouteGuard'];
let render: (typeof import('@testing-library/react'))['render'];
let screen: (typeof import('@testing-library/react'))['screen'];
let mockUseAuth: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  // Fresh module graph per test — insulates from auth-context.test.tsx which
  // imports the real AuthProvider and leaves it in the shared vmForks cache.
  vi.resetModules();

  mockUseAuth = vi.fn();

  vi.doMock('../contexts/auth-context', () => ({
    useAuth: mockUseAuth,
  }));

  // Dynamic imports bind to the fresh mocks registered above.
  const routeGuardModule = await import('../components/RouteGuard');
  const rtlModule = await import('@testing-library/react');

  RouteGuard = routeGuardModule.RouteGuard;
  render = rtlModule.render;
  screen = rtlModule.screen;

  // Set unauthenticated as default; individual tests override as needed.
  mockUseAuth.mockImplementation(() => ({
    isLoading: false,
    isAuthenticated: false,
    admin: null,
    login: vi.fn(),
    logout: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

import React from 'react';
import type { LocationService } from '../components/RouteGuard';

function makeLocationService(pathname: string, search = ''): LocationService & { replace: ReturnType<typeof vi.fn> } {
  return {
    getPathname: () => pathname,
    getSearch: () => search,
    replace: vi.fn(),
  };
}

function authState(overrides: { isLoading?: boolean; isAuthenticated?: boolean }) {
  return {
    isLoading: false,
    isAuthenticated: false,
    admin: null,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('RouteGuard — loading state', () => {
  it('shows a loading spinner while auth state is being determined (Req 4.4)', () => {
    mockUseAuth.mockImplementation(() => authState({ isLoading: true }));
    const loc = makeLocationService('/');

    render(React.createElement(RouteGuard, { locationService: loc },
      React.createElement('div', null, 'Protected content')
    ));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});

describe('RouteGuard — unauthenticated user', () => {
  it('redirects to /login?returnTo=<path> when not on login page (Req 4.1)', () => {
    mockUseAuth.mockImplementation(() => authState({ isAuthenticated: false }));
    const loc = makeLocationService('/portfolio');

    render(React.createElement(RouteGuard, { locationService: loc },
      React.createElement('div', null, 'Protected content')
    ));

    expect(loc.replace).toHaveBeenCalledWith('/login?returnTo=%2Fportfolio');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('preserves search params in the returnTo value (Req 4.1)', () => {
    mockUseAuth.mockImplementation(() => authState({ isAuthenticated: false }));
    const loc = makeLocationService('/portfolio', '?tab=orders');

    render(React.createElement(RouteGuard, { locationService: loc },
      React.createElement('div', null, 'Protected content')
    ));

    expect(loc.replace).toHaveBeenCalledWith(
      '/login?returnTo=%2Fportfolio%3Ftab%3Dorders',
    );
  });

  it('does NOT redirect when already on the login page', () => {
    mockUseAuth.mockImplementation(() => authState({ isAuthenticated: false }));
    const loc = makeLocationService('/login');

    render(React.createElement(RouteGuard, { locationService: loc },
      React.createElement('div', null, 'Login form')
    ));

    expect(loc.replace).not.toHaveBeenCalled();
    expect(screen.getByText('Login form')).toBeInTheDocument();
  });
});

describe('RouteGuard — authenticated user', () => {
  it('renders children when authenticated and not on login page', () => {
    mockUseAuth.mockImplementation(() => authState({ isAuthenticated: true }));
    const loc = makeLocationService('/');

    render(React.createElement(RouteGuard, { locationService: loc },
      React.createElement('div', null, 'Home page')
    ));

    expect(screen.getByText('Home page')).toBeInTheDocument();
    expect(loc.replace).not.toHaveBeenCalled();
  });

  it('redirects to returnTo path when authenticated and on login page (Req 4.2)', () => {
    mockUseAuth.mockImplementation(() => authState({ isAuthenticated: true }));
    const loc = makeLocationService('/login', '?returnTo=%2Fportfolio');

    render(React.createElement(RouteGuard, { locationService: loc },
      React.createElement('div', null, 'Login form')
    ));

    expect(loc.replace).toHaveBeenCalledWith('/portfolio');
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('redirects to / when authenticated and on login page with no returnTo (Req 4.2)', () => {
    mockUseAuth.mockImplementation(() => authState({ isAuthenticated: true }));
    const loc = makeLocationService('/login');

    render(React.createElement(RouteGuard, { locationService: loc },
      React.createElement('div', null, 'Login form')
    ));

    expect(loc.replace).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });
});

describe('RouteGuard — spinner accessibility', () => {
  it('spinner has role="status" and aria-label="Loading"', () => {
    mockUseAuth.mockImplementation(() => authState({ isLoading: true }));
    const loc = makeLocationService('/');

    const { container } = render(React.createElement(RouteGuard, { locationService: loc },
      React.createElement('div', null, 'content')
    ));

    const spinner = container.querySelector('[role="status"]');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });
});
