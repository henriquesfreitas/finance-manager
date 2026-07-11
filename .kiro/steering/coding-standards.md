# Coding Standards & Agent Guidelines

## Architecture

- **Clean Architecture** with strict Separation of Concerns
- **Frontend components must NEVER contain business logic.** Business rules, validation, data transformations, and calculated fields belong in dedicated service/utility modules. Components only handle UI rendering, user interaction, and calling APIs.
- **SOLID & DRY** — single responsibility per function/module, no code duplication
- **Dependency Injection** — inject dependencies through constructor/parameter, wrap third-party libs behind interfaces
- **Design Patterns** — use Factory, Strategy, Observer where they add clarity

## Code Style

- **Functions: 4-20 lines.** Split if longer.
- **Files: under 500 lines, ideally 200-300.** Split by responsibility.
- **Explicit types everywhere.** No `any`, no untyped functions.
- **Specific, grepable names.** Avoid generic `data`, `handler`, `Manager`. Prefer names that return <5 grep hits.
- **Early returns over nested ifs.** Max 2 levels of indentation.
- **Error messages must include the offending value and expected shape.**

## Comments & Documentation

- **Write WHY, not WHAT.** Don't caption obvious code.
- **Preserve comments on refactor** — they carry intent and provenance.
- **Docstrings on public functions:** intent + one usage example.
- **Reference issue numbers** when a line exists because of a specific bug.

## Testing (Mandatory)

- **Every business logic function gets a unit test.** Bug fixes get a regression test.
- **Tests run with a single command** (`npm test`).
- **Tests must run headless** without manual setup or secret credentials.
- **Mock external I/O** (API, DB, filesystem) with named fake classes.
- **Coverage target:** 80%+ overall, 95%+ on business logic.
- **After every implementation step**, run the full test suite to catch regressions.
- **Playwright E2E tests** cover all user flows.

## Implementation Standards

- Use the latest stable features of the language and framework
- Optimize for performance and memory efficiency
- Defensive programming: validation at boundaries, graceful error handling
- If an approach fails twice, stop and try a fundamentally different approach

## Infrastructure

- **Database and infrastructure services run in Docker** (Postgres via docker-compose)
- **Application code runs locally during development** for speed and hot reload
- **Full Docker setup available** for CI/staging
- **Idempotent setup:** a single command must reach a working state from a clean machine

## Security

- Validate all input data at the boundary (Zod schemas)
- Structured JSON logging for observability
- Prepared for auth middleware in future versions

## Workflow

- Never jump to code blindly — read existing code first, match project conventions
- For new features: understand requirements → design → implement → test
- Keep implementations focused: build exactly what's required, no speculative over-engineering
- Update PROJECT_RULES.md when introducing new patterns or constraints
