# Requirements

## Product intent

Parallel coding agents can conflict, break interface contracts, and overwhelm
human review. The eventual product will translate a specification into a
dependency graph, allocate isolated worktrees, collect execution evidence, and
gate integration on checks and human approval.

Audience: engineering teams and technical evaluators. This is an original
prototype inspired only by the public product area described in the supplied
engineering guide.

## Phase boundaries

The guide's start-from-zero prompt is the governing implementation prompt for
this session. Its core-engine, hardening, and demo prompts inform the roadmap,
not authorization to skip ahead. Only Phases 0 and 1 are in scope.

### Phase 0

- Requirements, non-goals, architecture, threat model, and measurable acceptance
  criteria exist before implementation.
- Establish ignore rules, formatting conventions, and a local/CI check contract.
- Repository initialization requires separate permission. The user declined;
  record this exception instead of running Git.

### Phase 1 user stories

1. As an evaluator, I can start the stack using Docker and PowerShell without
   changing global Node or Java installations.
2. As an evaluator, I can see API/database readiness and the applied bootstrap
   schema version in a browser.
3. As an evaluator, I can submit only synthetic requirements to a validation
   sandbox and get either an explicit success or actionable field errors.
4. As an engineer, I can reproduce formatting, compilation, tests, migration
   checks, and a browser smoke test without connecting to a production system.
5. As a co-tenant, I am not affected by ports, Docker cleanup, or resource use
   from this project beyond the documented bounded budget.

### Phase 1 interfaces

- `GET /actuator/health/liveness`: process liveness.
- `GET /actuator/health/readiness`: application readiness including PostgreSQL.
- `GET /api/v1/system`: metadata read from the migrated database; not a fabricated
  database status.
- `POST /api/v1/intake/validate`: validation-only operation; no persistence,
  repository access, scheduling, or command execution.

A title must contain non-whitespace text and be at most 80 characters.
`acceptanceCriteria` must contain 1-10 strings, each non-whitespace and at most
240 characters. Unknown JSON fields and malformed JSON are rejected. Errors
must not echo rejected input or stack traces.

## Measurable Phase 1 acceptance criteria

| ID    | Required evidence                                                                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Compose project name is `lightsprint`; only web `127.0.0.1:18105` and API `127.0.0.1:18205` are published; PostgreSQL has no host port.                                |
| AC-02 | Every runtime/check service has explicit CPU, memory, and PID limits. Application containers have no host repository or Docker socket mount.                           |
| AC-03 | Java formatting, Maven compilation/tests/package, frontend formatting, TypeScript check, Vite production build, and frontend unit tests exit zero.                     |
| AC-04 | An isolated test database receives Flyway version 1 successfully; running app reports schema version 1 from PostgreSQL.                                                |
| AC-05 | Readiness and liveness return HTTP 200 with `UP` while the database is ready; readiness becomes unhealthy when the database is unavailable.                            |
| AC-06 | A real Chromium browser loads the built UI, reads live database-backed status, submits a valid synthetic specification, and displays validation-only success.          |
| AC-07 | Empty/oversized input, malformed/unknown JSON, and excessive criteria return HTTP 400 with sanitized problem details; the UI shows server/network failures explicitly. |
| AC-08 | Restarting the application/database retains bootstrap metadata and exactly one successful version-1 migration.                                                         |
| AC-09 | Future project/plan/task/merge routes are absent, and no test invokes Git, agents, cloud services, or real user data.                                                  |
| AC-10 | Exact commands, observed results, failures/fixes, remaining risks, and next steps are persisted locally. Remote CI execution is not claimed.                           |

## Non-goals

- Phases 2-6: domain persistence/APIs, permissions, idempotency, DAG scheduling,
  worktrees, agent adapters, contract registry, overlap detection, checks, merge
  queue, and human execution approval.
- Redis, Kafka, workers, external AI providers, OpenTelemetry export, or cloud
  deployment before an actual requirement justifies them.
- Production readiness, security certification, benchmarks, public hosting,
  private company integrations, or importing real specifications/repositories.
- Activating or operating on the user's other nine project sessions.
