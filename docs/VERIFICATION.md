# Verification evidence

## Status

**Phase 1 passed the final unified verifier with exit code 0.**
Phase 0 design artifacts were written before implementation. Its Git
initialization item remains explicitly deferred by user decision.
No Phase 2+ implementation, remote CI run, benchmark, or production-readiness
claim is included.

## Environment observed

- Docker Desktop Linux engine: 29.4.1; Compose: v5.1.3.
- Container Node: 22.23.4; npm: 10.9.9.
- Container Maven: 3.9.11; Java: Eclipse Temurin 21.0.9.
- Host Node/Java installations were not changed.
- Initially the folder contained only the 3-page engineering PDF.
- No pre-existing `lightsprint` containers or listeners on 18105/18205 were found.
- No Git repository was initialized, and no other project/session was activated.

## Commands already executed

All project commands run from the LightSprint directory:

```powershell
docker version --format '{{json .}}'
docker compose version
.\scripts\Initialize-Local.ps1
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml config --quiet
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps web-tool sh -lc 'npm install --save-dev --save-exact typescript@latest @types/react@latest @types/react-dom@latest --no-fund --no-audit && npx tsc --init'
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps api-tool mvn -B -ntp spotless:apply
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps e2e-tool npm install --save-exact --no-fund --no-audit
```

Observed: all commands above exited zero. Java formatting touched 8 Java files.
Frontend dependency install added 45 packages; E2E install added 3. PowerShell
parser validation passed for both scripts. Generated TypeScript defaults were
then adapted for strict Vite/browser compilation; no compilation result is
claimed yet.

Persistent transcripts:

- `artifacts/bootstrap-web.log`
- `artifacts/bootstrap-api.log`
- `artifacts/bootstrap-e2e.log`

## Verification procedure

Run Prettier, then `scripts/Verify.ps1`. It must check formatting, compile/package,
run unit/integration tests, start only the bounded local stack, verify
port/mount/resource isolation, exercise real database failure and recovery,
verify migration persistence, and run real Chromium smoke tests.

No benchmark, full security audit, or remote CI execution is claimed.

## First full run: failure retained, not called complete

Command: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Verify.ps1`

- Prettier check: passed.
- Maven Spotless/compile/test/package: passed, 15 tests, zero failures/errors/skips.
- Vitest: passed, 8 tests.
- TypeScript and Vite: passed; production assets built.
- API and web image builds: passed.
- All three container-local health checks: passed.
- First Windows-host HTTP request: failed. Independent `curl.exe --noproxy '*'`
  probes also returned connection refusal for both reserved ports.
- Docker inspect: configured API port `127.0.0.1:18205`, but effective
  `8080/tcp` binding was empty on the all-internal network.

Root cause and correction are recorded as D-016 in the decisions. Database
outage/recovery, persistence, browser smoke, and overall completion were not
claimed by this failed run. The test database was stopped.

An independent assertion also confirmed the exact CPU/memory/PID budgets for
all eight services against the architecture table, not merely nonzero limits.

## Subsequent failures and focused recovery

- A Docker control-plane request returned HTTP 500 while starting the corrected
  stack. Read-only inspection showed a healthy API with the proper effective
  loopback binding. Repeating the project-scoped `up` succeeded; no daemon
  restart or other-project operation was performed.
- The second full verifier passed all build/test checks, live HTTP and isolation,
  and observed readiness `503 DOWN`, system status `503`, and liveness `200 UP`
  during the real database outage. Recovery succeeded, but a later API restart
  exceeded the 180-second Compose wait while Docker inspection commands also
  stalled. This run failed rather than claiming completion.
- After the control plane became responsive, the API was observed stopped with
  `OOMKilled=false`. No cause outside this project's evidence is asserted.
  A project-only `up` restored all three healthy services.
- First Chromium launch failed because its report mount was nested beneath a
  read-only source bind and the mountpoint did not exist. The report destination
  was moved to a separate writable `/results` bind. Sources/root filesystem
  remain read-only; no permission or resource ceiling was relaxed.
- Targeted Chromium rerun: **6 passed (7.2 seconds), zero retries**. Includes live
  UI/API/PostgreSQL flow, real invalid-input rejection, sanitized JSON errors,
  network failure/retry, route/header boundaries, and mobile overflow check.
- The desktop screenshot was inspected: loaded database status, readable form,
  clear validation-only result, and no visible layout clipping.
- The VS Code embedded-browser helper timed out and could not recover its page.
  Actual browser coverage was obtained from the containerized Chromium suite,
  not claimed from that unavailable helper.
- Windows PowerShell transcripts did not retain native process stdout. The
  verifier now additionally tees stdout to a project-local command log so actual
  test summaries persist alongside its command/HTTP transcript.

Targeted command:

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps e2e
```

Persistence spot-check after recovery: metadata row still has schema `1` and
creation time `2026-11-11 15:23:03.260168+00`; migration `1` is successful.
This is supporting evidence, not a replacement for the verifier's before/after
comparison.

## Final unified run: passed

From `C:\Users\upadhsah\Desktop\project\LightSprint`:

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps web-tool npm run format
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Verify.ps1
```

Both commands exited **0**. The verifier exercised the complete sequence after
the fixes rather than treating isolated passing checks as overall success.

| Gate                      | Observed final result                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier                  | All matched files use the configured style.                                                                                              |
| Java formatting/build     | Spotless passed; Java 21 compilation/package via Maven `verify` succeeded.                                                               |
| Java tests                | 6 integration + 9 validation cases = **15 passed**, 0 failures/errors/skips.                                                             |
| Frontend tests            | **8 passed** using Vitest with one worker.                                                                                               |
| Frontend production build | `tsc --noEmit` and Vite production build passed.                                                                                         |
| Runtime image assembly    | API/web images built; three application containers became healthy.                                                                       |
| Live host HTTP            | Web health 200; API readiness 200 `UP`; DB-backed system status 200 with schema 1.                                                       |
| Isolation                 | Effective loopback bindings 18105/18205; no DB host port; internal database network; no app bind mounts; CPU/memory/PID limits verified. |
| Real DB outage            | Readiness 503 `DOWN`; system endpoint 503 sanitized problem; liveness 200 `UP`.                                                          |
| Recovery/persistence      | DB/API restart recovered; exact bootstrap row remained unchanged; one successful version-1 migration.                                    |
| Actual browser smoke      | **6 passed in 7.1 seconds**, 0 retries, 0 skips, 0 unexpected/flaky outcomes. This is a test duration, not a benchmark.                  |
| Final runtime             | Only app/API/database services running and healthy; temporary test DB stopped.                                                           |

The persistent Java XML and browser JSON reports were independently parsed:
15 Java tests and 6 expected browser results, with zero failures or flaky tests.

### Persistent evidence

- [Full command and HTTP transcript](../artifacts/verify-20261111-232946.log)
- [Native command output and exit codes](../artifacts/verify-20261111-232946-commands.log)
- [API integration JUnit XML](../services/api/target/surefire-reports/TEST-dev.lightsprint.api.ApiIntegrationTest.xml)
- [API validation JUnit XML](../services/api/target/surefire-reports/TEST-dev.lightsprint.api.SpecValidationControllerTest.xml)
- [Browser JSON results](../artifacts/e2e/results.json)
- [Browser JUnit XML](../artifacts/e2e/junit.xml)
- [Browser HTML report](../artifacts/e2e/html/index.html)
- [Observed desktop screenshot](../artifacts/e2e/dashboard.png)

Earlier failed-run transcripts are retained as
`artifacts/verify-20261111-201714.log` and
`artifacts/verify-20261111-210023.log`. Native process stdout was not captured by
those early transcripts; their persisted command/HTTP evidence and this
failure narrative must not be mistaken for complete native logs.

### Exact component commands used by the verifier

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml config --quiet
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps web-tool npm run format:check
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm api-tool mvn -B -ntp verify
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml stop test-db
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps web-tool npm test
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps web-tool npm run build
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml build api web
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml up -d --wait --wait-timeout 180 db api web
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml stop db
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml up -d --wait --wait-timeout 180 db api web
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml restart api
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml up -d --wait --wait-timeout 180 db api web
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps e2e
```

Read-only persistence queries executed before/after restart:

```sql
SELECT schema_version::text || '|' || created_at::text
FROM app_metadata WHERE id = 1;
SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success;
```

Retained row: `1|2026-11-11 15:23:03.260168+00`. Migration count: `1`.

### Actual dependency/runtime versions

- Java 21.0.9 / Maven 3.9.11 / Spring Boot 3.5.16.
- Node 22.23.4 / npm 10.9.9 / TypeScript 7.0.2.
- React and React DOM 19.3.1 / React types 19.3.0.
- Vite 8.3.8 / React Vite plugin 6.3.0 / Vitest 5.1.0 / Prettier 3.9.10.
- Playwright 1.65.0 with its matching official Chromium image.
- PostgreSQL 17.11 from the digest-pinned PostgreSQL 17 Alpine image.

These are locally observed versions, not claims about production support or
security certification. Host runtimes were not replaced.

## Changed files

The initial folder contained only the unchanged engineering PDF. The following
**49 source/configuration/documentation files** were created. Package locks and
the initial TypeScript configuration were generated by project-local tooling;
all other edits also remained inside this project.

### Project and engineering (14)

- [README.md](../README.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [.editorconfig](../.editorconfig)
- [.env.example](../.env.example)
- [.gitignore](../.gitignore)
- [.prettierignore](../.prettierignore)
- [.prettierrc.json](../.prettierrc.json)
- [CI workflow](../.github/workflows/ci.yml)
- [PRD](PRD.md)
- [Architecture](ARCHITECTURE.md)
- [Threat model](THREAT_MODEL.md)
- [Plan](PLAN.md)
- [Decisions](DECISIONS.md)
- [This verification report](VERIFICATION.md)

### Web (14)

- [package.json](../apps/web/package.json)
- [package-lock.json](../apps/web/package-lock.json)
- [tsconfig.json](../apps/web/tsconfig.json)
- [vite.config.js](../apps/web/vite.config.js)
- [index.html](../apps/web/index.html)
- [favicon.svg](../apps/web/public/favicon.svg)
- [App.tsx](../apps/web/src/App.tsx)
- [client.ts](../apps/web/src/client.ts)
- [client.test.ts](../apps/web/src/client.test.ts)
- [main.tsx](../apps/web/src/main.tsx)
- [styles.css](../apps/web/src/styles.css)
- [Dockerfile](../apps/web/Dockerfile)
- [.dockerignore](../apps/web/.dockerignore)
- [nginx.conf](../apps/web/nginx.conf)

### API (13)

- [pom.xml](../services/api/pom.xml)
- [Dockerfile](../services/api/Dockerfile)
- [.dockerignore](../services/api/.dockerignore)
- [LightSprintApplication.java](../services/api/src/main/java/dev/lightsprint/api/LightSprintApplication.java)
- [SystemController.java](../services/api/src/main/java/dev/lightsprint/api/SystemController.java)
- [SpecValidationController.java](../services/api/src/main/java/dev/lightsprint/api/SpecValidationController.java)
- [JsonConfiguration.java](../services/api/src/main/java/dev/lightsprint/api/JsonConfiguration.java)
- [ApiExceptionHandler.java](../services/api/src/main/java/dev/lightsprint/api/ApiExceptionHandler.java)
- [RequestLoggingFilter.java](../services/api/src/main/java/dev/lightsprint/api/RequestLoggingFilter.java)
- [application.yaml](../services/api/src/main/resources/application.yaml)
- [V1 bootstrap migration](../services/api/src/main/resources/db/migration/V1__bootstrap_metadata.sql)
- [ApiIntegrationTest.java](../services/api/src/test/java/dev/lightsprint/api/ApiIntegrationTest.java)
- [SpecValidationControllerTest.java](../services/api/src/test/java/dev/lightsprint/api/SpecValidationControllerTest.java)

### Contracts, infrastructure, scripts and browser tests (8)

- [OpenAPI contract](../packages/contracts/openapi.yaml)
- [Compose](../infra/docker/compose.yaml)
- [Initialize-Local.ps1](../scripts/Initialize-Local.ps1)
- [Verify.ps1](../scripts/Verify.ps1)
- [E2E package.json](../tests/e2e/package.json)
- [E2E package-lock.json](../tests/e2e/package-lock.json)
- [Playwright configuration](../tests/e2e/playwright.config.ts)
- [Browser smoke tests](../tests/e2e/smoke.spec.ts)

Generated/ignored runtime material is separate from this 49-file inventory:
the local `.env` (value never reported), build outputs, test reports, and logs.
No Git diff/commit exists because Git initialization was explicitly declined.

## Blockers, limitations, and next step

- **No remaining Phase 1 implementation blocker** after the final passing run.
- Phase 0 Git initialization remains intentionally pending; no commits/remotes.
- Remote CI was not executed. Shared Docker load/interruption can slow or fail
  control-plane operations; the verifier fails explicitly and is safe to rerun
  without resetting the persistent application database.
- No production auth/rate limits, full security audit, agent execution,
  worktrees, domain APIs, merge gates, or benchmarks exist yet.
- Next: await explicit Phase 2 authorization, then design domain/API permissions
  and idempotency before implementing project/spec persistence.
- Runtime total ceilings remain 1.5 CPUs / 832 MiB, with no DB host port.
- No cloud resources, real data, global runtime replacement, other-session
  activation, global Docker cleanup, or destructive data action occurred.
