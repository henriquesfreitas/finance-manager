/**
 * Property-Based Tests — RouteGuard component
 * Feature: admin-login, Property 9: Route guard preserves return path
 *
 * Validates: Requirements 4.1
 *
 * For any URL path that is not the login page, when an unauthenticated user
 * navigates to that path, the route guard SHALL redirect to the login page
 * with the original path preserved as a query parameter (?returnTo=<path>).
 *
 * Module isolation strategy:
 * Uses vi.resetModules() + dynamic import in beforeEach so this file always
 * gets a fresh module graph regardless of what sibling test files have done
 * to the auth-context module registry (vmForks shares module cache across
 * files when fileParallelism: false).
 */

import * as fc from 'fast-check';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';

// ─── Teardown ─────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
});

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates arbitrary URL-safe paths that are guaranteed not to be `/login`.
 * Paths start with `/` and contain only alphanumeric characters, hyphens,
 * underscores, and forward slashes — a realistic subset of valid URL paths.
 */
const pathArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => `/${s.replace(/[^a-zA-Z0-9/_-]/g, 'x')}`)
  .filter((p) => p !== '/login');

// ─── Property 9: Route guard preserves return path ───────────────────────────

/**
 * **Property 9: Route guard preserves return path**
 * **Validates: Requirements 4.1**
 *
 * For any URL path that is not `/login`, when an unauthenticated user visits
 * that path, the RouteGuard SHALL:
 * 1. Call locationService.replace() exactly once.
 * 2. Call it with a URL that starts with `/login?returnTo=`.
 * 3. Encode the path such that decoding the `returnTo` param yields the
 *    original path exactly.
 */
describe('Property 9: Route guard preserves return path', () => {
  it('for any path !== /login, redirects to /login?returnTo=<encoded-path>', async () => {
    // Reset modules to get a pristine module graph isolated from all sibling
    // test files — avoids vi.mock hoisting conflicts in vmForks shared cache.
    vi.resetModules();

    // Register a fresh mock for auth-context in this isolated module graph.
    vi.doMock('../contexts/auth-context', () => ({
      useAuth: () => ({
        isAuthenticated: false,
        isLoading: false,
        admin: null,
        login: vi.fn(),
        logout: vi.fn(),
      }),
    }));

    // Dynamically import RouteGuard and LocationService after resetting modules
    // so they bind to the fresh mock above.
    const { RouteGuard } = await import('../components/RouteGuard');
    const { render } = await import('@testing-library/react');

    fc.assert(
      fc.property(pathArb, (path) => {
        const replaceFn = vi.fn();

        const loc = {
          getPathname: () => path,
          getSearch: () => '',
          replace: replaceFn,
        };

        render(
          React.createElement(RouteGuard, { locationService: loc },
            React.createElement('div', null, 'protected')
          ),
        );

        // Must redirect exactly once
        expect(replaceFn).toHaveBeenCalledOnce();

        const redirectTarget = replaceFn.mock.calls[0]?.[0] as string;

        // Redirect must start with /login?returnTo=
        expect(redirectTarget).toMatch(/^\/login\?returnTo=/);

        // Decoding the returnTo param must recover the original path exactly
        const url = new URL(redirectTarget, 'http://test');
        const returnTo = url.searchParams.get('returnTo');
        expect(decodeURIComponent(returnTo ?? '')).toBe(path);

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
