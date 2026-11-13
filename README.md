# LightSprint

An independent, local prototype of a **Dependency-Aware Multi-Agent Software
Factory**. This project is not affiliated with LightSprint and does not claim
access to its private architecture or systems.

## Current scope

This session implements **Phase 0 (contract and safety)** and **Phase 1 (working
skeleton)** from `05_LightSprint_Multi_Agent_Dev.pdf`, read in full before work.
Implementation and verification status are tracked in [the plan](docs/PLAN.md).
Do not interpret the proposed product capabilities as implemented features.

**Verified foundation:** production builds, 15 Java tests, and live database
failure/recovery/persistence. **Current interface:** a real-time WebGL2 scene;
frontend production build, 22 unit tests and 12 real Chromium tests passed.
The Git repository and its GitHub remote were created by the user, not by the
build session; see [the plan](docs/PLAN.md).

Phase 1 provides:

- A Java 21 / Spring Boot 3 API and React / TypeScript dashboard.
- Private PostgreSQL storage, a Flyway bootstrap migration, and database-backed
  readiness.
- A synthetic specification validation sandbox. It does **not** store
  specifications, create plans, run agents, use Git, or merge changes.
- Isolated Docker Compose services, automated checks, and a real browser smoke
  test against the running web/API/database stack.

The task DAG, worktrees, agent adapters, contract overlap detection, checks,
approval UI, and merge queue belong to later phases.

## Local setup and verification

Prerequisites: Docker Desktop with Linux containers, Docker Compose v2 or newer,
and PowerShell. No host Node, Java, Maven, or PostgreSQL installation is needed.
Node 14 on the host is intentionally unused.

From this project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Verify.ps1
```

The verifier initializes an ignored, random local-only database password if
needed; installs locked dependencies inside resource-limited containers; checks
formatting; compiles; runs tests against a separate temporary test database;
builds and starts the local application; and runs browser smoke tests.
It leaves only the application services running and preserves local data.
It never initializes Git, commits, pushes, prunes Docker, or contacts a cloud
deployment service.

- Dashboard: <http://127.0.0.1:18105>
- API readiness: <http://127.0.0.1:18205/actuator/health/readiness>
- API contract: [OpenAPI](packages/contracts/openapi.yaml)
- Results and exact command evidence: [verification](docs/VERIFICATION.md)

After a successful verification, subsequent starts do not require rebuilding:

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml up -d --wait db api web
```

The three services also start by themselves whenever Docker Desktop starts, and
can be started from Docker Desktop in any order. The page loads at once. The API
needs up to a minute to boot; until then the page shows "Cannot load stack
status" with a **Retry connection** button. The `test-db` container is only
used by the tests and does not need to run.

To stop **only this application's** containers without deleting data:

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml stop web api db
```

Stopped this way, they stay stopped, also after Docker restarts, until they are
started again.

Do not use global prune commands or volume-removing shutdown commands.
Generated reports live in `artifacts/`; credentials and dependency/build output
are ignored. Initial image/package downloads require access to public dependency
registries, but no application source or input is sent to an external service.

## Demo

1. Open <http://127.0.0.1:18105>. A loader counts up, then a point of light
   bursts into a swarm of particles behind the headline. Move the pointer: the
   particles move away from it.
2. Scroll. The same particles re-form as you go: a converging dependency graph
   while the manifesto lights up word by word, a calm field behind the
   playground, and a single-direction sprint behind the roadmap.
3. In the playground, confirm live PostgreSQL readiness and schema version `1`.
4. Enter a synthetic title and one acceptance criterion per line, or select
   **Use a synthetic example**. The panel beside the form lists each criterion
   as the validator will receive it.
5. Select **Validate specification**. The result says nothing was saved or
   executed, and a ripple of light crosses the field.
6. Submit more than ten criteria to see the server's rejection; the scene
   flashes red.

The scene is an illustration, not an agent run or a live plan. It is drawn with
hand-written WebGL2 and locally served fonts: no graphics library and no
third-party request.

How it is drawn depends on the browser, and the line at the bottom of the first
screen says which applies:

- **Realtime**: the animation described above. Detail adapts to measured frame
  time, from 14,000 to 96,000 particles.
- **Still frames**: one still picture per section, with normal browser
  scrolling. Used when reduced motion is requested and when the renderer is too
  slow to animate (for example a software renderer).
- **Static backdrop**: a plain gradient when WebGL2 is unavailable.

Add `?render=still` or `?render=live` to the address to force a mode. The form
and every check work the same in all three.

## Safety and limitations

This is a loopback-only development skeleton, not production-ready software.
There is no authentication, authorization system, agent runner, repository
access, cloud integration, real-data support, or benchmark result. API input is
validated, but full rate limiting and end-to-end request size limits are later
hardening work. Never expose the stack publicly.

The build session did not initialize Git, commit or push. The user created the
repository and pushed it; GitHub then ran the CI workflow on each push. The
verifier itself never commits, pushes, or contacts a deployment service.

## Engineering documents

- [Requirements and measurable acceptance criteria](docs/PRD.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Ordered plan and progress](docs/PLAN.md)
- [Decisions and authorized exceptions](docs/DECISIONS.md)
- [Coding and verification conventions](CONTRIBUTING.md)
