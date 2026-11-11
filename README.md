# LightSprint

An independent, local prototype of a **Dependency-Aware Multi-Agent Software
Factory**. This project is not affiliated with LightSprint and does not claim
access to its private architecture or systems.

## Current scope

This session implements **Phase 0 (contract and safety)** and **Phase 1 (working
skeleton)** from `05_LightSprint_Multi_Agent_Dev.pdf`, read in full before work.
Implementation and verification status are tracked in [the plan](docs/PLAN.md).
Do not interpret the proposed product capabilities as implemented features.

**Verified:** formatting, production builds, 15 Java tests, 8 frontend tests,
6 real Chromium smoke tests, and live database failure/recovery/persistence.
Phase 0 Git initialization remains deferred by the user's decision.

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

To stop **only this application's** containers without deleting data:

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml stop web api db
```

Do not use global prune commands or volume-removing shutdown commands.
Generated reports live in `artifacts/`; credentials and dependency/build output
are ignored. Initial image/package downloads require access to public dependency
registries, but no application source or input is sent to an external service.

## Demo

1. Open the dashboard and confirm PostgreSQL readiness and schema version `1`.
2. Enter a synthetic title and one acceptance criterion per line.
3. Select **Validate specification**. The result explicitly says nothing was
   saved or executed.
4. Submit more than ten criteria to see an explicit validation failure.

## Safety and limitations

This is a loopback-only development skeleton, not production-ready software.
There is no authentication, authorization system, agent runner, repository
access, cloud integration, real-data support, or benchmark result. API input is
validated, but full rate limiting and end-to-end request size limits are later
hardening work. Never expose the stack publicly.

Git initialization was **declined by the user**. CI configuration is supplied for
future use, but no remote workflow is triggered and no Git history is created.

## Engineering documents

- [Requirements and measurable acceptance criteria](docs/PRD.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Ordered plan and progress](docs/PLAN.md)
- [Decisions and authorized exceptions](docs/DECISIONS.md)
- [Coding and verification conventions](CONTRIBUTING.md)
