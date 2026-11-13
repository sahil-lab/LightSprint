# Ordered plan and progress

## Authority and scope

- Engineering PDF: all 3 pages read completely, including prompts 6-9 and the
  eventual definition of done.
- Execute Phase 0, then Phase 1 only. Prompts for subsequent phases are deferred.
- Operate only in the LightSprint project folder.
- Docker verified responsive: Linux engine 29.4.1, Compose v5.1.3.
- Shared-host constraints: Compose `lightsprint`, web 18105, API 18205, no DB
  host port, bounded resources, no other session activation.
- User decision at the start: **leave Git uninitialized**. No commits, remotes,
  or pushes by this session.
- **Update, 2026-11-12:** a Git repository now exists in this folder with two
  commits by the user's account (`fb2b709`, `a89137b`), pushed to the public
  repository `github.com/sahil-lab/LightSprint`. It was created outside this
  session. This session has still run no Git write command; its later changes
  are uncommitted in the working tree.

## Phase 0 - contract and safety

- [x] Inspect the initially PDF-only project and read the entire guide.
- [x] Document requirements, stories, non-goals, and measurable acceptance tests.
- [x] Document architecture, API boundaries, persistence, and resource budgets.
- [x] Document threat model and safety/approval restrictions.
- [x] Establish ignore rules, coding conventions, and CI/local check contract.
- [x] Initialize Git repository: deferred by this session at the user's
      decision; **done by the user outside this session on 2026-11-12**.

Gate: requirements/architecture/safety artifacts precede implementation.
CI was authored by this session and never run by it. After the user pushed,
GitHub ran the workflow on both commits and both runs succeeded (2.5 and 2.9
minutes, read from the public run list on 2026-11-12).

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

Phase 0 is complete. Its Git item was deferred here and later done by the user;
see the update under "Authority and scope". No later phase was begun.

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
Do not introduce agents, worktrees, or merges yet. Commits and pushes stay with
the user unless they ask for them.

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

**Superseded.** The user rejected this result as well; the sculpture and its
page were removed and replaced by the real-time scene below.

## Real-time scene

The user asked a third time for an Awwwards-level interface. D-018 records the
change of approach: the page background is now one real-time WebGL2 particle
scene that morphs through four formations as the page scrolls, with a loader,
a headline that rises letter by letter, a pinned manifesto, glass panels, a
cursor ring, magnetic buttons and inertial scrolling.

- [x] Record the approach, constraints and acceptance (D-018) before building.
- [x] Build the particle engine, quality control and scroll-to-scene mapping.
- [x] Rebuild the page around the scene; keep every Phase 1 behaviour.
- [x] Add still-frame and static fallbacks and reduced-motion behaviour.
- [x] Unit-test the pure logic; rewrite the browser suite to read real pixels.
- [x] Inspect every scene at desktop and phone sizes and fix what was wrong.
- [x] Fix the proxy timeout the browser suite exposed (D-019).

Status: **implemented and verified**. 22 frontend unit tests, the TypeScript
and Vite production build, and 12 real Chromium tests passed on the final
build. No dependency, API, database, Compose resource or security-policy change
was made apart from the proxy timeout in D-019.

What is not verified: the frame rate of the full-quality animation on a
hardware GPU. The test browser has only a software renderer. The host's own
Edge was run headless once and reported a hardware renderer and 56,000
particles, but that run used virtual time and measures no frame rate. See the
real-time section of [verification](VERIFICATION.md).

These changes are uncommitted. The two commits on GitHub hold the earlier
light-sculpture interface, and CI has not seen the real-time scene.

Only the LightSprint web container was replaced. The next engineering phase is
still gated on explicit Phase 2 authorization.

## Start-up fixes (2026-11-13)

The page refused connections twice in one day: once because the web server
crashed when the containers were started together, and once because nothing
started them after the PC restarted.

- [x] The web server no longer needs the API in order to start (D-021).
- [x] The three services start with Docker, at the user's choice (D-022).
- [x] The verifier checks that the web image starts without a resolvable API.

Status: **fixed and checked** by reproducing the crash before the fix, starting
the containers together in the worst order after it, and making the web server
and the API fail so that Docker had to bring them back. Not checked: a real
Docker or PC restart, because that would stop every other project on this
machine. See the last section of [verification](VERIFICATION.md).
