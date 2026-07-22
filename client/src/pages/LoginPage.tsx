import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import {
  windowLocationService,
  type LocationService,
} from '@/components/RouteGuard';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .max(128, 'Maximum 128 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the `?returnTo=` query param from the location service, or null if absent.
 * Guards against open-redirect: only allows same-origin relative paths.
 */
function getReturnTo(locationService: LocationService): string | null {
  const params = new URLSearchParams(locationService.getSearch());
  const value = params.get('returnTo');
  // Guard against open-redirect: only allow same-origin relative paths
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return null;
}

/**
 * Maps a thrown error to a user-facing message.
 * Keeps error categorisation out of the render body.
 */
function toServerErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Service unavailable. Please try again later.';

  if (err.message === 'Invalid credentials') {
    return 'Invalid credentials';
  }
  if (err.message.includes('Too many login attempts')) {
    return 'Too many login attempts. Try again in 15 minutes.';
  }
  // Network error or any other server error (Req 1.7)
  return 'Service unavailable. Please try again later.';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Login page with React Hook Form + Zod validation and shadcn/ui components.
 *
 * Behaviour:
 * - Validates username (3–50 chars) and password (8–128 chars) client-side
 * - Disables the submit button and shows a spinner while the request is in flight
 * - On 401: shows "Invalid credentials"
 * - On 429: shows lockout message
 * - On network/server error: shows "Service unavailable", preserves entered username
 * - On success: redirects to `?returnTo` param or home page
 *
 * @example <LoginPage />
 */
export function LoginPage({
  locationService = windowLocationService,
}: {
  locationService?: LocationService;
} = {}): React.JSX.Element {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm): Promise<void> {
    setServerError(null);
    try {
      await login(data.username, data.password);
      locationService.replace(getReturnTo(locationService) ?? '/');
    } catch (err) {
      const message = toServerErrorMessage(err);
      setServerError(message);

      // On network/service error, preserve the username but clear the password
      // field so the user can retry without retyping their username (Req 1.7).
      // On credential/lockout errors the form stays as-is.
      if (message === 'Service unavailable. Please try again later.') {
        setValue('password', '');
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold">
          Finance Manager
        </h1>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
          noValidate
        >
          {/* ── Username ──────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              aria-describedby={errors.username ? 'username-error' : undefined}
              {...register('username')}
            />
            {errors.username && (
              <p
                id="username-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.username.message}
              </p>
            )}
          </div>

          {/* ── Password ──────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          {/* ── Server-side error ─────────────────────────────────────────── */}
          {serverError && (
            <p
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
