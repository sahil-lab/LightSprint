# Ordered plan and progress

## Authority and scope

- Engineering PDF: all 3 pages read completely, including prompts 6-9 and the
  eventual definition of done.
- Execute Phase 0, then Phase 1 only. Prompts for subsequent phases are deferred.
- Operate only in `C:\Users\upadhsah\Desktop\project\LightSprint`.
- Docker verified responsive: Linux engine 29.4.1, Compose v5.1.3.
- Shared-host constraints: Compose `lightsprint`, web 18105, API 18205, no DB
  host port, bounded resources, no other session activation.
- User decision: **leave Git uninitialized**. No commits, remotes, or pushes.

## Phase 0 - contract and safety

- [x] Inspect the initially PDF-only project and read the entire guide.
- [x] Document requirements, stories, non-goals, and measurable acceptance tests.
- [x] Document architecture, API boundaries, persistence, and resource budgets.
- [x] Document threat model and safety/approval restrictions.
- [x] Establish ignore rules, coding conventions, and CI/local check contract.
- [ ] Initialize Git repository: **explicitly deferred by user decision**.

Gate: requirements/architecture/safety artifacts precede implementation.
The Git exception is visible and must not be represented as completed.
CI is authored only; remote execution is not authorized or claimed.

## Phase 1 - working skeleton

- [x] Author Java 21 / Spring Boot 3 API and structured local logging.
- [x] Author PostgreSQL configuration and Flyway bootstrap migration.
- [x] Author readiness/liveness, DB-backed metadata, and strict input validation.
- [x] Author React/TypeScript dashboard with explicit failure states.
- [x] Add isolated Compose services and supported container tooling.
- [x] Add and run formatting, compilation, unit/integration, and browser checks.
- [x] Verify persistent migration state, health failure/recovery, port isolation,
      and resource ceilings.
- [x] Record exact commands, failures/fixes, test counts, evidence, and handoff.

Current status: **Phase 1 verified**. The final unified verifier exited **0**.
Formatting, Java compilation/package, 15 Java tests, 8 frontend tests, TypeScript
checking, Vite build, image builds, and 6 real Chromium tests passed. There were
no failed/skipped tests or browser retries in the final run.

The original networking failure and browser report mount failure were fixed,
and transient Docker control-plane failures were recorded rather than hidden.
Live checks verified effective loopback ports, private PostgreSQL, resource
limits, database outage/recovery, persistent bootstrap metadata, and exactly one
successful Flyway migration after database/application restarts.
See [verification evidence](VERIFICATION.md).

Phase 0 remains complete **except for the explicitly deferred Git initialization
item**. CI is authored but has not been run remotely. No later phase was begun.

## Deferred phases

2. Core domain entities, API contracts, permissions, idempotency, transitions.
3. DAG planning, interface overlap detection, check gates, merge queue.
4. Explicitly limited agent adapters, isolated worktrees, human execution approval.
5. Reliability/observability, rate limiting, retries, chaos checks.
6. Reproducible benchmarks, packaging, demo recording, deployment guide.

The guide's examples involving two real agents, conflicting APIs, and gated
merges are **later MVP acceptance criteria**, not Phase 1 benchmark results.

## Next step

Await authorization for Phase 2. Begin with domain/API and permission contracts,
then add project/spec persistence and idempotency with focused integration tests.
Do not introduce agents, worktrees, or merges yet. Revisit Git initialization only
if the user separately authorizes it.

The local dashboard is available at <http://127.0.0.1:18105>; the API readiness
endpoint is <http://127.0.0.1:18205/actuator/health/readiness>.

A later visual refinement replaced the flat skeleton styling with self-hosted
Instrument Serif and Instrument Sans. A second pass turned the first screen into
a full-viewport title sequence, moving constraint reel, credit-style stack, and
closing slate. It did not change API behavior. Frontend production build and 6
Chromium smoke tests passed again after that change.
Only application services remain running; the temporary test DB is stopped and
one-shot tooling containers exit automatically.

## Light-sculpture refinement

User-approved direction: an interactive light sculpture, not another
typography-only reskin. The design and accessibility boundary is documented in
D-017 before implementation.

- [x] Replace the title sequence with the light sculpture and coherent workspace.
- [x] Preserve Phase 1 validation and explicit error/retry behavior.
- [x] Verify motion controls, reduced motion, keyboard access and responsive sizes.
- [x] Run frontend formatting, typecheck/build/unit tests and real browser checks.
- [x] Inspect desktop/mobile screenshots and persist actual results.

Status: **implemented and verified**. The new design includes an original
56-rib projected light sculpture, pointer-responsive perspective, scatter/align
controls, a pause button, reduced-motion support, and a compact playground.
The illustration is explicitly not a live agent run. No backend, dependency,
Compose-resource, or security-policy change was needed.

Observed checks: 8 frontend unit tests, TypeScript/Vite production build, and
9 real Chromium tests passed. An additional focused run passed the strengthened
pointer-transform assertion, alignment controls, pause, and offscreen behavior.
Desktop, tablet, small-phone, full-page mobile, and scattered-state captures were
visually inspected. See the light-sculpture section of [verification](VERIFICATION.md).

Only the LightSprint web container was replaced. API/database services and all
other projects were left untouched. The next engineering phase is still gated
on explicit Phase 2 authorization.
