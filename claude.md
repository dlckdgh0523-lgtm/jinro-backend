# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

5. Project Memory and Work Logging

Every meaningful task must be recorded in memory.md.

For each completed or changed task:

Update memory.md with what was changed.
Include the reason for the change.
Include important decisions, tradeoffs, and known limitations.
Include verification results, such as tests, build checks, or manual checks.
Do not overwrite useful historical context unless explicitly asked.

memory.md is the project memory. It should help future developers and LLM agents understand what happened, why it happened, and what must not be repeated.

6. Testing and CI Discipline

Every feature, bug fix, and behavior change must be verified with tests.

Write tests for new logic.
Write regression tests for fixed bugs.
Predict realistic user actions and edge cases, then test them.
Run the relevant test suite before considering the task complete.
Ensure the project can pass CI.
Do not mark a task as done just because the code "looks right."

When possible, cover:

Successful user flows.
Invalid inputs.
Missing data.
Permission or authorization failures.
Boundary cases.
Database-related failures.
API response shape compatibility.
Frontend/backend contract expectations.

A change is not complete until it is verified.

7. Error Handling Policy

Do not ignore errors. Do not move on while errors remain unresolved.

Treat every error, warning, failed test, failed build, failed migration, and failed deployment as important.
Do not suppress errors just to make the output look clean.
Do not bypass TypeScript, ESLint, Prisma, test, or build errors without a clear and justified reason.
Do not use temporary hacks unless explicitly approved by the user.
If an error cannot be fixed immediately, document the exact reason, current status, and next required action.

Never proceed by assumption when an error is still active.

8. Critical Thinking and Pushback

Think critically. Challenge unsafe or weak decisions.

Do not blindly follow instructions if the requested approach creates avoidable risk.

When you see a better path:

Explain the risk in the current approach.
Suggest a safer or simpler alternative.
Mention tradeoffs clearly.
Prefer production-grade decisions over quick hacks.
Protect the user from hidden technical debt, security risk, and deployment failure.

The goal is not only to complete the task. The goal is to complete it in a way that can survive real usage.

9. Deployment Target

The primary deployment target is EC2.

When making backend, Docker, environment, CI/CD, or infrastructure-related decisions:

Assume the service should eventually run on EC2.
Prefer solutions compatible with Docker-based EC2 deployment.
Keep production deployment in mind.
Avoid choices that only work locally unless they are clearly marked as local-only.
Consider health checks, logs, environment variables, database connectivity, and restart behavior.

Do not introduce deployment assumptions that conflict with EC2 unless the user explicitly changes the deployment target.

10. No Mock Data Unless Explicitly Requested

Do not use mock data as a substitute for real implementation.

Do not silently add mock data.
Do not fake API responses.
Do not hardcode sample users, scores, admissions data, counseling results, or AI responses as if they were real.
If temporary mock data is absolutely necessary for development, clearly label it as temporary and ask before using it.
Prefer real database-backed flows and real API contracts.

Mock data can hide integration failures. Avoid it unless the user explicitly approves it.

11. No Arbitrary Work

Do not make arbitrary changes.

Do not invent requirements.
Do not rename files, variables, routes, tables, or fields without a clear reason.
Do not restructure folders unless the task requires it.
Do not change unrelated code.
Do not silently modify business rules.
Do not replace working code with a preferred style.
Do not make assumptions about missing requirements when clarification is needed.

Every change must be traceable to the user request, a bug, a test failure, a deployment requirement, or a documented project rule.

12. Completion Standard

All work must be implemented completely.

A task is only complete when:

The requested behavior is implemented.
Related tests are added or updated.
Existing tests still pass.
TypeScript/build checks pass.
Database schema and Prisma client are consistent, if applicable.
Environment requirements are documented.
memory.md is updated.
No known blocking errors remain.

Do not leave half-implemented code, unused routes, broken imports, TODO-only solutions, or disconnected UI/API flows.

13. Environment Variable and Secret Safety

Never commit .env files or secrets into the codebase.

Do not include real API keys, database URLs, tokens, passwords, AWS credentials, or private secrets in source code.
Do not commit .env.
Use .env.example for documenting required environment variables.
Keep secret values in the deployment environment, CI secret store, or hosting provider settings.
If a secret appears in code or logs, warn the user immediately and recommend rotation.

Environment variables should be referenced by name, not hardcoded by value.

14. File Reading and Repository Inspection

Reading files does not require extra permission.

When working inside the repository:

Read relevant files before editing.
Inspect existing structure, naming, patterns, and conventions.
Check related types, routes, schemas, tests, and configuration before making changes.
Do not ask for permission to read files that are necessary to complete the task.
Ask only before destructive actions, broad rewrites, deleting files, changing deployment settings, or modifying unrelated areas.

Good implementation starts with understanding the existing code.

15. Jinro Project Rules

This project is a real service, not a toy prototype.

For the Jinro project:

Prioritize production-grade backend design.
Keep student, teacher, admin, admissions data, AI counseling, and RAG-related flows consistent.
Protect user data and avoid careless exposure of sensitive information.
Keep API contracts stable unless a change is clearly required.
Prefer maintainable, testable, and deployable code over fast but fragile implementation.
Treat database schema changes carefully and verify Prisma migrations.
Do not break existing frontend expectations without identifying the impact first.

The project should be implemented as if it will be deployed, used, debugged, and maintained by real users.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, fewer hidden errors, better test coverage, clearer deployment readiness, and clarifying questions come before implementation rather than after mistakes.