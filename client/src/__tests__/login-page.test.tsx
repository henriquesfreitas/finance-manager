/**
 * Unit tests for LoginPage component.
 *
 * Strategy:
 * - Mock the auth context's `login` action to control outcomes.
 * - Pass a fake LocationService (same interface as RouteGuard uses) to
 *   LoginPage so we never need to touch the non-configurable
 *   window.location jsdom global.
 * - Use @testing-library/react + @testing-library/user-event to simulate
 *   user interactions (typing, submitting).
 *
 * Requirements covered:
 * - Req 1.2 — generic error on 401
 * - Req 1.3 — field length validation
 * - Req 1.4 — disabled button + loading indicator while in-flight
 * - Req 1.5 — redirect on success
 * - Req 1.6 — lockout message on 429
 * - Req 1.7 — service unavailable message + username preserved
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../pages/LoginPage';
import type { LocationService } from '../components/RouteGuard';

// ─── Mock auth context ────────────────────────────────────────────────────────

const mockLogin = vi.fn();

vi.mock('../contexts/auth-context', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../contexts/auth-context';
const mockUseAuth = vi.mocked(useAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a fake LocationService so tests never touch window.location.
 */
function makeLocationService(
  search = '',
): LocationService & { replace: ReturnType<typeof vi.fn> } {
  return {
    getPathname: () => '/login',
    getSearch: () => search,
    replace: vi.fn(),
  };
}

/**
 * Renders LoginPage with an injectable location service and returns both
 * the user-event instance and the location stub.
 */
function setup(search = '') {
  const user = userEvent.setup();
  const loc = makeLocationService(search);
  render(<LoginPage locationService={loc} />);
  return { user, loc };
}

function getUsername(): HTMLInputElement {
  return screen.getByLabelText(/username/i) as HTMLInputElement;
}

function getPassword(): HTMLInputElement {
  return screen.getByLabelText(/password/i) as HTMLInputElement;
}

function getSubmit(): HTMLButtonElement {
  return screen.getByRole('button', { name: /sign in/i }) as HTMLButtonElement;
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  username = 'admin',
  password = 'SecurePass1',
): Promise<void> {
  await user.type(getUsername(), username);
  await user.type(getPassword(), password);
  await user.click(getSubmit());
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  mockLogin.mockReset();
  // Re-apply mockImplementation after reset so the mock always returns
  // the expected shape for login-page tests.
  mockUseAuth.mockImplementation(() => ({ login: mockLogin }));
});

afterEach(() => {
  // Explicitly unmount between tests — jsdom doesn't auto-cleanup when
  // globals:true is set without @testing-library/react/pure imports.
  cleanup();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('LoginPage — rendering', () => {
  it('renders username field, password field, and submit button', () => {
    setup();
    expect(getUsername()).toBeInTheDocument();
    expect(getPassword()).toBeInTheDocument();
    expect(getSubmit()).toBeInTheDocument();
  });

  it('password field has type="password"', () => {
    setup();
    expect(getPassword()).toHaveAttribute('type', 'password');
  });

  it('submit button is enabled initially', () => {
    setup();
    expect(getSubmit()).not.toBeDisabled();
  });
});

// ─── Field validation (Req 1.3) ───────────────────────────────────────────────

describe('LoginPage — client-side validation (Req 1.3)', () => {
  it('shows error when username is too short (< 3 chars)', async () => {
    const { user } = setup();
    await user.type(getUsername(), 'ab');
    await user.type(getPassword(), 'ValidPass1');
    await user.click(getSubmit());

    expect(await screen.findByText(/minimum 3 characters/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows error when username is too long (> 50 chars)', async () => {
    const { user } = setup();
    await user.type(getUsername(), 'a'.repeat(51));
    await user.type(getPassword(), 'ValidPass1');
    await user.click(getSubmit());

    expect(await screen.findByText(/maximum 50 characters/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows error when password is too short (< 8 chars)', async () => {
    const { user } = setup();
    await user.type(getUsername(), 'admin');
    await user.type(getPassword(), 'short');
    await user.click(getSubmit());

    expect(await screen.findByText(/minimum 8 characters/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows error when password is too long (> 128 chars)', async () => {
    const { user } = setup();
    await user.type(getUsername(), 'admin');
    await user.type(getPassword(), 'a'.repeat(129));
    await user.click(getSubmit());

    expect(await screen.findByText(/maximum 128 characters/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('accepts username at minimum boundary (3 chars)', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { user } = setup();
    await user.type(getUsername(), 'abc');
    await user.type(getPassword(), 'ValidPass1');
    await user.click(getSubmit());

    await waitFor(() => expect(mockLogin).toHaveBeenCalledOnce());
    expect(screen.queryByText(/minimum 3 characters/i)).not.toBeInTheDocument();
  });

  it('accepts password at minimum boundary (8 chars)', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { user } = setup();
    await user.type(getUsername(), 'admin');
    await user.type(getPassword(), '12345678');
    await user.click(getSubmit());

    await waitFor(() => expect(mockLogin).toHaveBeenCalledOnce());
    expect(screen.queryByText(/minimum 8 characters/i)).not.toBeInTheDocument();
  });
});

// ─── Loading state (Req 1.4) ──────────────────────────────────────────────────

describe('LoginPage — loading state (Req 1.4)', () => {
  it('disables the submit button while request is in progress', async () => {
    mockLogin.mockReturnValue(new Promise(() => {}));
    const { user } = setup();

    await user.type(getUsername(), 'admin');
    await user.type(getPassword(), 'SecurePass1');
    await user.click(getSubmit());

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled(),
    );
  });

  it('shows a loading indicator while request is in progress', async () => {
    mockLogin.mockReturnValue(new Promise(() => {}));
    const { user } = setup();

    await user.type(getUsername(), 'admin');
    await user.type(getPassword(), 'SecurePass1');
    await user.click(getSubmit());

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument(),
    );
  });
});

// ─── Success redirect (Req 1.5) ───────────────────────────────────────────────

describe('LoginPage — success redirect (Req 1.5)', () => {
  it('redirects to "/" when login succeeds and no returnTo param is present', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { user, loc } = setup();

    await fillAndSubmit(user);

    await waitFor(() => expect(loc.replace).toHaveBeenCalledWith('/'));
  });

  it('redirects to returnTo path when present and is a valid relative path', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { user, loc } = setup('?returnTo=/portfolio');

    await fillAndSubmit(user);

    await waitFor(() => expect(loc.replace).toHaveBeenCalledWith('/portfolio'));
  });

  it('falls back to "/" when returnTo is an open-redirect URL (external)', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { user, loc } = setup('?returnTo=//evil.example.com');

    await fillAndSubmit(user);

    await waitFor(() => expect(loc.replace).toHaveBeenCalledWith('/'));
  });
});

// ─── 401 error message (Req 1.2) ─────────────────────────────────────────────

describe('LoginPage — 401 invalid credentials (Req 1.2)', () => {
  it('displays generic "Invalid credentials" message on 401', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    const { user, loc } = setup();

    await fillAndSubmit(user);

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(loc.replace).not.toHaveBeenCalled();
  });

  it('does not show a field-specific error message (Req 1.2)', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    const { user } = setup();

    await fillAndSubmit(user);

    await screen.findByText('Invalid credentials');
    // Error alerts must not contain any field-specific wording
    const alerts = screen.getAllByRole('alert');
    for (const alert of alerts) {
      expect(alert.textContent).not.toMatch(/incorrect password/i);
      expect(alert.textContent).not.toMatch(/user.*not found/i);
    }
  });
});

// ─── 429 lockout message (Req 1.6) ───────────────────────────────────────────

describe('LoginPage — 429 rate-limit lockout (Req 1.6)', () => {
  it('displays lockout message when rate limited', async () => {
    mockLogin.mockRejectedValue(
      new Error('Too many login attempts. Try again in 15 minutes.'),
    );
    const { user, loc } = setup();

    await fillAndSubmit(user);

    expect(
      await screen.findByText(/too many login attempts/i),
    ).toBeInTheDocument();
    expect(loc.replace).not.toHaveBeenCalled();
  });
});

// ─── Network error + username preservation (Req 1.7) ─────────────────────────

describe('LoginPage — network error (Req 1.7)', () => {
  it('displays "Service unavailable" on network error', async () => {
    mockLogin.mockRejectedValue(new Error('Network error'));
    const { user, loc } = setup();

    await fillAndSubmit(user, 'myuser', 'SecurePass1');

    expect(await screen.findByText(/service unavailable/i)).toBeInTheDocument();
    expect(loc.replace).not.toHaveBeenCalled();
  });

  it('preserves the entered username value on network error', async () => {
    mockLogin.mockRejectedValue(new Error('Network error'));
    const { user } = setup();

    await fillAndSubmit(user, 'myuser', 'SecurePass1');

    await screen.findByText(/service unavailable/i);
    expect(getUsername()).toHaveValue('myuser');
  });

  it('clears the password field on network error', async () => {
    mockLogin.mockRejectedValue(new Error('Network error'));
    const { user } = setup();

    await fillAndSubmit(user, 'myuser', 'SecurePass1');

    await screen.findByText(/service unavailable/i);
    expect(getPassword()).toHaveValue('');
  });
});

// ─── Error recovery ───────────────────────────────────────────────────────────

describe('LoginPage — error recovery', () => {
  it('clears server error when a new submission begins', async () => {
    // First attempt fails
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    const { user } = setup();
    await fillAndSubmit(user);
    await screen.findByText('Invalid credentials');

    // Second attempt succeeds — error should clear when submission starts
    mockLogin.mockResolvedValueOnce(undefined);
    await user.click(getSubmit());

    await waitFor(() =>
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument(),
    );
  });
});
