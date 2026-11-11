# Development conventions

- Read the requirements, plan, and tests before changing the next slice.
- Keep all work inside this project. Do not initialize Git or create
  commits/remotes without fresh, explicit permission.
- Use containerized project tooling; do not depend on host Node 14 or install a
  replacement global Java/Node runtime.
- Java: Java 21, Spring Boot 3, records for API payloads, Bean Validation,
  constructor injection, Google Java Format through Spotless.
- TypeScript: strict checking, runtime validation at HTTP boundaries, React text
  rendering, accessible forms and explicit errors; no `any` escape hatches.
- Frontend/docs/config formatting: Prettier. Use spaces and LF; default to ASCII.
- SQL: versioned Flyway migrations; no automatic destructive rollback or clean.
- Errors: use sanitized Problem Details; never log submitted specifications,
  credentials, or request bodies. Do not substitute healthy-looking defaults.
- Tests: focus on observable behavior and introduced edge cases. Use the isolated
  test DB and synthetic browser inputs only.
- Use `scripts/Verify.ps1` for the local and CI contract. It must fail on any
  unsuccessful check and preserve diagnostic output inside `artifacts/`.
- Record actual results and limitations in the plan/verification report. A
  checked-in CI workflow is not evidence of a successful remote CI run.
- Never globally prune Docker, stop other projects, remove data volumes, access
  real data, or activate other project sessions.
