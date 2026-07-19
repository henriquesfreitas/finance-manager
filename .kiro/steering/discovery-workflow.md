---
inclusion: manual
---

# 🔄 Discovery & Implementation Workflow

This workflow applies to **new features, architectural changes, or multi-file refactors**. For single-file bug fixes or cosmetic tweaks, skip straight to implementation.

---

## Phase 1 — Requirements Discovery

**Recommended model: Opus.** If the current model is not Opus, ask: *"This phase benefits from Opus — would you like to switch models before we continue?"*

Before writing any code:

1. **Read `PROJECT_RULES.md`** to understand current architecture, patterns, and conventions before analyzing anything.
2. **Analyze the request.** Do not jump into code generation.
3. **Read existing code** in the affected area to understand current patterns and constraints.
4. **Scenario Breakdown.** Identify the main user-flow scenarios: happy path, edge cases, error/failure states.
5. **Discovery Questions.** Ask targeted clarification questions to resolve ambiguities. Group them clearly so I can answer in one pass.
6. **Summarize requirements** as a numbered list once all questions are answered.

**Exit gate:** Present the requirements summary and ask: *"Requirements look complete — shall we move to the Tech Design phase?"*

---

## Phase 2 — Tech Design

**Recommended model: Opus.** If the current model is not Opus, ask: *"This phase benefits from Opus — would you like to switch models before we continue?"*

1. **Options & Trade-offs.** When more than one viable approach exists, present each with Pros/Cons (complexity, performance, maintainability, alignment with existing patterns).
2. **Proposed plan.** After I pick an option (or if there's only one reasonable path), describe the implementation plan: which files change, new modules needed, data model impact, and any migration steps.
3. **Wait for explicit approval** before writing code.

**Exit gate:** Present the plan and ask: *"Tech design is ready — shall we move to implementation?"*

---

## Phase 3 — Implementation

**Recommended model: Sonnet.** If the current model is not Sonnet, ask: *"Implementation is best handled by Sonnet — would you like to switch models before we continue?"*

1. Execute the approved plan step by step.
2. Run the test suite after each meaningful change (`npm test` in the affected package).
3. If something fails twice, stop and propose an alternative approach instead of patching blindly.

### Test Gate (mandatory before declaring the task complete)

Before finishing, verify:

- [ ] **Unit tests:** New/changed business logic has corresponding unit tests. Bug fixes include a regression test.
- [ ] **E2E tests:** If the change affects a user flow, update or add a Playwright E2E spec.
- [ ] **All tests pass:** Run `npm test` in both `client/` and `server/`, and `npm run test:e2e` if E2E tests were touched.

**Do not declare the task complete until all boxes are checked.** If tests are missing, write them before wrapping up.

---

## Scope Threshold

| Change size | Example | Workflow |
|------------|---------|----------|
| Trivial | Fix typo, rename variable | Just do it |
| Small | Single-file bug fix, add a field | Brief confirmation, then implement |
| Medium+ | New feature, new endpoint, multi-file refactor | Full 3-phase workflow |
