# Implementation Plan: Admin Login

## Overview

This plan implements authentication for the Finance Investment Manager — a single-user personal portfolio tracker. The implementation adds Prisma models for admin users and sessions, a server-side auth service with bcrypt hashing and rate limiting, Express middleware for route protection, and a React client-side login page with route guarding and auth context. All tasks use TypeScript and follow existing project conventions (factory functions, Zod validation, DI via parameters).

## Tasks

- [x] 1. Database schema and credential seeding
  - [x] 1.1 Add AdminUser and AdminSession Prisma models and run migration
    - Add `AdminUser` model with `id`, `username` (unique), `passwordHash`, `createdAt`, `updatedAt`
    - Add `AdminSession` model with `id`, `token` (unique, indexed), `adminId` (FK), `expiresAt` (indexed), `createdAt`
    - Configure `onDelete: Cascade` from AdminUser to AdminSession
    - Run `prisma migrate dev` to generate the migration
    - _Requirements: 2.1, 6.1_

  - [x] 1.2 Create admin credential seeder script
    - Create `server/prisma/seed-admin.ts` that reads `ADMIN_USERNAME` and `ADMIN_PASSWORD` from env
    - Hash password with bcrypt (cost factor 10+) and upsert into `admin_users`
    - Fail with a descriptive error if env vars are missing or empty
    - Integrate into existing `prisma/seed.ts` by calling the admin seeder
    - Update `.env.example` with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_COOKIE_NAME`, `SESSION_EXPIRY_DAYS`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.3 Install new server dependencies
    - Add `bcryptjs` (pure JS bcrypt implementation) and `@types/bcryptjs` as dependencies
    - Add `cookie-parser` and `@types/cookie-parser` as dependencies
    - _Requirements: 6.1, 2.5_

- [x] 2. Server-side auth core (service, validator, rate limiter)
  - [x] 2.1 Implement rate limiter utility
    - Create `server/src/lib/rate-limiter.ts` with `createRateLimiter(config)` factory
    - Implement `isLimited(key)`, `recordAttempt(key)`, `reset(key)` methods
    - Config: `maxAttempts: 5`, `windowMs: 15 * 60 * 1000`, `lockoutMs: 15 * 60 * 1000`
    - Use in-memory `Map<string, AttemptRecord>` — no external dependencies
    - _Requirements: 1.6_

  - [x] 2.2 Write property test for rate limiter
    - **Property 4: Rate limiter locks after threshold**
    - **Validates: Requirements 1.6**
    - File: `server/src/__tests__/rate-limiter.property.test.ts`

  - [x] 2.3 Implement auth input validator
    - Create `server/src/validators/auth-validator.ts` with Zod schema
    - Username: `z.string().min(3).max(50)`
    - Password: `z.string().min(8).max(128)`
    - Export `validateLoginInput(data)` returning discriminated union (success/failure)
    - _Requirements: 1.3_

  - [x] 2.4 Write property test for auth validator
    - **Property 3: Login input validation enforces length boundaries**
    - **Validates: Requirements 1.3**
    - File: `server/src/__tests__/auth-validator.property.test.ts`

  - [x] 2.5 Implement auth service
    - Create `server/src/services/auth-service.ts` with `createAuthService({ db })` factory
    - `authenticate(username, password, clientIp)`: verify credentials via bcrypt.compare, generate 32-byte crypto random token (hex-encoded, 64 chars), store session with 7-day expiry
    - `validateSession(token)`: lookup session in DB, check expiry, update expiresAt (sliding window)
    - `invalidateSession(token)`: delete session record from DB
    - Integrate rate limiter: check before auth, record on failure, reset on success
    - Return generic "Invalid credentials" error for any auth failure (no field indication)
    - Never include password hash in any return value or log
    - _Requirements: 1.1, 1.2, 1.6, 2.1, 2.2, 2.3, 6.2, 6.5_

  - [x] 2.6 Write property tests for auth service
    - **Property 1: Token issuance produces secure tokens**
    - **Property 2: Invalid credentials produce identical error responses**
    - **Property 5: Session validation refreshes expiration (sliding window)**
    - **Property 11: Logout invalidates session completely**
    - **Property 12: Password hash never appears in outputs**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 5.2, 6.5**
    - File: `server/src/__tests__/auth-service.property.test.ts`

- [x] 3. Checkpoint - Ensure all server-side auth core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Server-side middleware and routes
  - [x] 4.1 Implement auth middleware
    - Create `server/src/middleware/auth-middleware.ts` with `createAuthMiddleware({ authService })` factory
    - Extract session token from cookie (using `cookie-parser`)
    - Return 401 with `{ error: "Authentication required" }` if no token present
    - Return 401 with `{ error: "Invalid token format" }` if token is malformed (non-hex or wrong length)
    - Return 401 with `{ error: "Session expired or invalid" }` if session not found or expired
    - Attach `adminId` to `req` on successful validation
    - Extend Express Request type with `adminId?: string`
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.5, 3.6_

  - [x] 4.2 Write property tests for auth middleware
    - **Property 7: Middleware rejects all invalid tokens**
    - **Property 8: Valid token attaches admin identity**
    - **Validates: Requirements 2.4, 3.2, 3.3, 3.5, 3.6**
    - File: `server/src/__tests__/auth-middleware.property.test.ts`

  - [x] 4.3 Implement auth routes
    - Create `server/src/routes/auth-routes.ts` with `createAuthRouter(authService)` factory
    - `POST /api/auth/login`: validate input, authenticate, set httpOnly/Secure/SameSite=Strict cookie with 7-day max-age, return admin info
    - `POST /api/auth/logout`: require auth, invalidate session, clear cookie (Max-Age=0)
    - `GET /api/auth/me`: require auth, return current admin identity
    - Include `Retry-After` header on 429 rate-limit responses
    - _Requirements: 1.1, 1.2, 1.4, 1.6, 2.5, 5.2_

  - [x] 4.4 Write property test for cookie security attributes
    - **Property 6: Cookie contains required security attributes**
    - **Validates: Requirements 2.5**
    - File: `server/src/__tests__/auth-routes.property.test.ts`

  - [x] 4.5 Wire auth middleware into Express app
    - Add `cookie-parser` middleware to `app.ts`
    - Apply auth middleware to all `/api/*` routes except `/api/auth/login`
    - Exempt `/health` and `/api/test/reset` (non-production) from auth
    - Register auth routes under `/api/auth`
    - _Requirements: 3.4_

- [x] 5. Checkpoint - Ensure all server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Client-side auth infrastructure
  - [x] 6.1 Create auth API client
    - Create `client/src/services/auth-api-client.ts` following existing `investment-api-client.ts` pattern
    - `login(username, password)`: POST to `/api/auth/login` with `credentials: 'include'`
    - `logout()`: POST to `/api/auth/logout` with `credentials: 'include'`
    - `fetchCurrentAdmin()`: GET `/api/auth/me` with `credentials: 'include'`
    - All fetch calls must include `credentials: 'include'` for cookie transmission
    - _Requirements: 1.1, 5.2_

  - [x] 6.2 Update existing API client to include credentials
    - Add `credentials: 'include'` to the base `request()` function in `investment-api-client.ts`
    - This ensures cookies are sent with all existing API requests
    - _Requirements: 2.3, 3.1_

  - [x] 6.3 Create auth context provider
    - Create `client/src/contexts/auth-context.tsx` with React context
    - State: `isAuthenticated`, `isLoading`, `admin` (id + username)
    - Actions: `login(username, password)`, `logout()`
    - On mount: call `fetchCurrentAdmin()` to restore session from cookie
    - On 401 from any API call: clear auth state, redirect to login
    - Timeout: if auth check takes > 5 seconds, stop loading and redirect to login
    - On logout: clear TanStack Query cache via `queryClient.clear()`
    - On logout network failure/timeout (10s): still clear local state and redirect
    - _Requirements: 2.3, 4.3, 4.4, 4.5, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.4 Write property test for 401 response handling
    - **Property 10: 401 response triggers auth cleanup**
    - **Validates: Requirements 4.3**
    - File: `client/src/__tests__/auth-api-client.property.test.ts`

- [x] 7. Client-side route guard and login page
  - [x] 7.1 Create RouteGuard component
    - Create `client/src/components/RouteGuard.tsx`
    - If not authenticated and not loading: redirect to login page with `?returnTo=` current path
    - If authenticated and on login page: redirect to home
    - While loading: show a full-page loading spinner
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 7.2 Write property test for route guard
    - **Property 9: Route guard preserves return path**
    - **Validates: Requirements 4.1**
    - File: `client/src/__tests__/route-guard.property.test.ts`

  - [x] 7.3 Create LoginPage component
    - Create `client/src/pages/LoginPage.tsx` using React Hook Form + Zod + shadcn/ui
    - Username field (3–50 chars), password field (8–128 chars), submit button
    - Disable button and show loading indicator while request is in progress
    - Display generic "Invalid credentials" error on 401
    - Display lockout message with remaining time on 429
    - Display "Service unavailable" on network error, preserve username value
    - On success: redirect to `returnTo` path or home page
    - Mobile-responsive layout (centered card)
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 7.4 Add logout button to main layout
    - Add a logout button/icon accessible from the HomePage layout
    - Wire to auth context `logout()` action
    - _Requirements: 5.1_

- [x] 8. Wire client-side auth into App
  - [x] 8.1 Integrate AuthProvider and RouteGuard into App.tsx
    - Wrap the app with `AuthProvider`
    - Add routing logic: show `LoginPage` when unauthenticated, protected content when authenticated
    - Pass `queryClient` to auth context for cache clearing on logout
    - _Requirements: 4.1, 4.2, 5.3_

- [x] 9. Checkpoint - Ensure all client and server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integration testing
  - [x] 10.1 Write server integration tests
    - Test full login flow with real DB (valid credentials → token → cookie → access)
    - Test protected route access with valid/invalid/expired tokens
    - Test logout invalidates session and clears cookie
    - Test rate limiting across multiple failed requests
    - File: `server/src/__tests__/auth-integration.test.ts`
    - _Requirements: 1.1, 1.2, 1.6, 2.3, 2.4, 3.1, 3.2, 5.2_

  - [x] 10.2 Write client unit tests for auth components
    - Test auth context state transitions (loading → authenticated, loading → unauthenticated)
    - Test route guard redirect logic and loading states
    - Test login form validation and error display
    - Files: `client/src/__tests__/auth-context.test.tsx`, `client/src/__tests__/route-guard.test.tsx`
    - _Requirements: 1.3, 1.4, 4.1, 4.2, 4.4, 4.5_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript throughout (server + client)
- `fast-check` library is needed for property tests (install as dev dependency when executing PBT tasks)
- All server factories follow the existing DI pattern (`createXxx(deps)`)
- Cookie-based auth requires `credentials: 'include'` on all client fetch calls

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "4.5"] },
    { "id": 6, "tasks": ["6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4"] },
    { "id": 8, "tasks": ["7.1", "7.3"] },
    { "id": 9, "tasks": ["7.2", "7.4", "8.1"] },
    { "id": 10, "tasks": ["10.1", "10.2"] }
  ]
}
```
