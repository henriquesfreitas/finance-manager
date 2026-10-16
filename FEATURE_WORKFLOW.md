# Feature Planning Workflow

Use this workflow only when the user explicitly asks for it. It is intended for small or medium features that affect user-visible behavior, multiple related files, or data/API behavior. Trivial fixes can proceed directly unless the user asks to plan them.

## Activation prompt

Start a feature request with:

> Use `FEATURE_WORKFLOW.md` to plan this feature. Ask me any questions you need, show me the implementation plan, and wait for my approval before editing files.

## 1. Read-only discovery

Before proposing an implementation:

1. Read `AGENTS.md` and the relevant business rules in `PROJECT_RULES.md`.
2. Inspect the existing code and nearby tests in the affected area. Check current behavior and conventions before proposing changes.
3. Identify the user scenarios, including the normal flow, important edge cases, and failure states.
4. Do not edit files, generate code, or run commands that change project state during planning.

## 2. Clarify requirements

- Ask concise, grouped questions for decisions that materially affect behavior, scope, or data compatibility.
- Ask these questions before presenting a final plan. Wait for the user's answers; do not make dependent implementation decisions on their behalf.
- If no clarification is needed, state the assumptions that matter and proceed to the plan.
- Avoid asking about routine implementation details that can be decided by following existing project patterns.

## 3. Present the plan and stop

Show a concise plan containing:

- Your understanding of the requested outcome and acceptance criteria.
- The proposed behavior and important edge cases.
- Expected files or areas to change, with a short reason for each.
- Any API, database, migration, permission, or compatibility impact, when relevant.
- The focused tests and checks that would verify the change.
- Material alternatives or risks only when they require a decision.

End by asking the user to approve or revise the plan. Do not edit files or begin implementation until the user explicitly approves it.

## 4. Implement only the approved plan

- Follow the approved scope. If discovery during implementation requires a material change to scope or behavior, stop and present a revised plan for approval.
- Add or update focused tests for changed behavior where appropriate. Run the checks the user requested or approved in the plan.
- Do not add unrelated refactors or speculative improvements.

## 5. Report completion

Summarize the implementation, files changed, checks actually run and their results, and any remaining limitations. Never report a check as passing unless it was run.
