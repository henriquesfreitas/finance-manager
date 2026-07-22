# Requirements Document

## Introduction

This feature adds authentication to the Finance Investment Manager application. Since this is a personal portfolio tracker used by a single admin user, the implementation focuses on pragmatic single-user login rather than a full multi-user RBAC system. The feature covers a login page, session management with secure tokens, server-side route protection via middleware, client-side route guarding, and logout functionality.

## Glossary

- **Admin**: The single authorized user of the application
- **Auth_Middleware**: Express middleware that validates session tokens on protected API routes
- **Auth_Service**: Server-side service responsible for credential verification and session lifecycle
- **Login_Page**: Client-side page rendering the authentication form
- **Session_Token**: A cryptographically secure token issued upon successful authentication, used to authorize subsequent API requests
- **Route_Guard**: Client-side component that redirects unauthenticated users to the Login_Page
- **Protected_Route**: Any API endpoint that requires a valid Session_Token to access

## Requirements

### Requirement 1: Admin Login

**User Story:** As the admin, I want to authenticate with my credentials, so that I can access my portfolio data securely.

#### Acceptance Criteria

1. WHEN the admin submits valid credentials on the Login_Page, THE Auth_Service SHALL issue a Session_Token with an expiration time of 24 hours and return it in the response
2. WHEN the admin submits invalid credentials on the Login_Page, THE Auth_Service SHALL return a 401 status with a generic error message that does not reveal whether the username or password was incorrect
3. THE Login_Page SHALL render a form with a username field accepting 3 to 50 characters and a password field accepting 8 to 128 characters, and a submit button
4. WHILE the login request is in progress, THE Login_Page SHALL disable the submit button and display a loading indicator
5. WHEN authentication succeeds, THE Login_Page SHALL redirect the admin to the home page
6. IF the admin submits 5 consecutive failed login attempts within a 15-minute window, THEN THE Auth_Service SHALL reject further login attempts from that client for 15 minutes and return an error message indicating the account is temporarily locked
7. IF the Auth_Service is unavailable when the admin submits credentials, THEN THE Login_Page SHALL display an error message indicating the service is unreachable and preserve the entered username value

### Requirement 2: Session Management

**User Story:** As the admin, I want my session to persist across page reloads, so that I do not have to log in every time I open the app.

#### Acceptance Criteria

1. WHEN a Session_Token is issued, THE Auth_Service SHALL generate a cryptographically random token of at least 256 bits and store it in the database with an expiration timestamp set to 7 days from the moment of issuance
2. WHEN the Auth_Service successfully validates a Session_Token on an authenticated request, THE Auth_Service SHALL update the token's expiration timestamp to 7 days from the current time so that the session expires only after 7 days of inactivity
3. WHEN the admin makes an authenticated request, THE Auth_Service SHALL validate the Session_Token against the database and verify the token has not expired
4. IF a Session_Token is expired or not found in the database, THEN THE Auth_Middleware SHALL return a 401 status and reject the request
5. WHEN authentication succeeds, THE Login_Page SHALL store the Session_Token in a cookie configured with httpOnly, Secure, and SameSite=Strict attributes and a max-age of 7 days so that the token persists across page reloads

### Requirement 3: Server-Side Route Protection

**User Story:** As the admin, I want all API endpoints to be protected, so that unauthorized users cannot access my financial data.

#### Acceptance Criteria

1. THE Auth_Middleware SHALL validate the Session_Token on every request to a Protected_Route by verifying the token is present, has a valid signature, and has not expired, before passing control to the route handler
2. IF a request to a Protected_Route lacks a Session_Token, THEN THE Auth_Middleware SHALL return a 401 status with an error response body containing an error field indicating that authentication is required
3. IF a request to a Protected_Route contains a Session_Token that has an invalid signature or has expired, THEN THE Auth_Middleware SHALL return a 401 status with an error response body containing an error field indicating the reason for rejection
4. THE Auth_Middleware SHALL protect all `/api/*` routes except the login endpoint, the health check (`/health`), and the test reset endpoint (`/api/test/reset`) when running outside production
5. WHEN the Auth_Middleware validates a token successfully, THE Auth_Middleware SHALL attach the admin user identifier extracted from the token payload to the request object for downstream use
6. IF a Protected_Route receives a request with a malformed Session_Token that cannot be parsed, THEN THE Auth_Middleware SHALL return a 401 status with an error response body containing an error field indicating the token format is invalid

### Requirement 4: Client-Side Route Protection

**User Story:** As the admin, I want the app to redirect me to the login page when I am not authenticated, so that the app does not show broken or empty states.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to any page other than the Login_Page, THE Route_Guard SHALL redirect the user to the Login_Page and preserve the originally requested path so it can be restored after successful login
2. WHEN an authenticated user navigates to the Login_Page, THE Route_Guard SHALL redirect the user to the home page
3. WHEN an API request returns a 401 status, THE Route_Guard SHALL remove the stored authentication token from client storage and redirect the admin to the Login_Page
4. WHILE the authentication state is being determined on initial load, THE Route_Guard SHALL display a visible loading indicator instead of the Login_Page or the protected page content
5. IF the authentication state has not been determined within 5 seconds of initial load, THEN THE Route_Guard SHALL stop the loading indicator and redirect the user to the Login_Page

### Requirement 5: Logout

**User Story:** As the admin, I want to log out of the application, so that my session is terminated and the app is secured.

#### Acceptance Criteria

1. THE Home_Page SHALL display a logout button accessible from the main layout
2. WHEN the admin clicks the logout button, THE Auth_Service SHALL invalidate the Session_Token in the database and clear the httpOnly session cookie in the response
3. WHEN logout completes, THE Login_Page SHALL be displayed, the httpOnly session cookie SHALL be removed, and all TanStack Query cached data SHALL be cleared
4. IF the logout request fails due to a network error, THEN THE Login_Page SHALL still be displayed, the httpOnly session cookie SHALL be expired client-side via a max-age=0 response or equivalent server-initiated clear on next request, and all TanStack Query cached data SHALL be cleared
5. IF the logout request does not receive a response within 10 seconds, THEN THE system SHALL treat the request as failed and apply the same local cleanup as a network error

### Requirement 6: Admin Credential Storage

**User Story:** As the admin, I want my password stored securely, so that it cannot be compromised if the database is accessed by an unauthorized party.

#### Acceptance Criteria

1. THE Auth_Service SHALL store the admin password as a bcrypt hash with a cost factor of at least 10
2. WHEN a password is submitted for authentication, THE Auth_Service SHALL compare it against the stored hash using bcrypt's built-in constant-time verification function
3. THE Admin credentials SHALL be seeded via an environment variable or a database seed script, not through a registration endpoint
4. IF the admin credential environment variable is missing or empty at application startup, THEN THE Auth_Service SHALL fail to start and log an error message indicating the missing credential configuration
5. THE Auth_Service SHALL never include the password hash in API responses or application logs
