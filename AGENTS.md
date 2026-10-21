# Instructions for AI contributors

## Before changing code

- Read this file and the relevant sections of `PROJECT_RULES.md` before changing business behavior.
- Inspect the implementation and nearby tests before editing. Treat the code as the current behavior; if documentation disagrees, verify the intended behavior and update the stale documentation when appropriate.
- Keep changes focused on the user's request. Follow existing patterns in the affected area instead of introducing a new architecture or abstraction without a concrete need.
- Ask a question only when an ambiguity blocks a safe, correct implementation. Do not add approval gates to routine code changes.

## Project conventions

- This is a TypeScript React client and Express server. Both use strict TypeScript and Zod validation.
- Keep responsibilities clear: client pages compose screens, hooks coordinate server state, API services handle HTTP, and components primarily render UI. Follow local patterns; form schemas may stay beside the form when that is how the feature is structured.
- Validate untrusted input at the server boundary. Keep business rules enforced on the server even when the client also validates for usability.
- Use `unknown` and narrow values instead of `any`. Add explicit types at public boundaries when they improve clarity; avoid annotations that only restate obvious inference.
- Keep non-obvious business decisions and invariants documented in `PROJECT_RULES.md`. Add code comments when they explain why a choice exists, not merely what the next line does.
- When a database schema or migration changes tables, columns, relationships, indexes, or enums, update [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) in the same change.
- When adding or changing a persistent data module, make sure `scripts/backup-db.sh` detects changes to its tables, including updates and deletions, and update the backup inventory in `README.md`. The backup dump covers the full database; the change detector must also cover the module so its data triggers a backup.
- Preserve the existing English and Portuguese UI support when changing user-facing copy.
- Do not hand-edit generated shadcn primitives under `client/src/components/ui/`; update them through the project's shadcn tooling when needed.
- Preserve security boundaries: do not expose secrets, password hashes, or session tokens in client responses or logs. When changing routes, preserve authentication and permission checks.

## Tests and checks

- For behavior changes, add or update focused tests where the project has test coverage for that area. Prefer tests for the changed behavior over arbitrary coverage targets.
- Run the relevant checks when the user asks for verification or the task requires it. Report checks that were not run; do not claim they passed.

## Sources of truth

- `PROJECT_RULES.md` contains domain behavior and business invariants only.
- For implementation details, inspect the relevant code and package scripts rather than relying on a second, potentially stale architecture inventory.
