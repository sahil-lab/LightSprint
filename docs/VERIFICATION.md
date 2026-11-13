# Verification evidence

## Status

**Phase 1 passed the final unified verifier with exit code 0.**
Phase 0 design artifacts were written before implementation. No Phase 2+
implementation, benchmark, or production-readiness claim is included.

**Repository and CI, as of 2026-11-12.** The sections below were written while
this folder had no Git repository, and they say so; that was true then. A
repository now exists, created by the user's account outside this session: two
commits (`fb2b709`, `a89137b`) pushed to the public repository
`github.com/sahil-lab/LightSprint`. GitHub ran the CI workflow on both pushes
and both runs succeeded (2.5 and 2.9 minutes), read from the public run list.
This session ran no Git write command and never ran CI. The real-time scene and
the start-up fixes in the last two sections are uncommitted and have not been
through CI. `.env` and `artifacts/` are untracked.

The current interface is the real-time scene documented in its own section near
the end of this report. Earlier results below are historical; each browser run
replaces the default Playwright report directory.

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

From the LightSprint project folder:

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
- After the Phase 1 gate, the dashboard visual system was refined. The rerun of
  `npm run format`, `npm run build`, and the Chromium suite passed: **6 tests,
  0 failures**. Evidence images: `artifacts/e2e/dashboard.png` and
  `artifacts/e2e/mobile.png`.
- Runtime total ceilings remain 1.5 CPUs / 832 MiB, with no DB host port.
- No cloud resources, real data, global runtime replacement, other-session
  activation, global Docker cleanup, or destructive data action occurred.

## Light-sculpture UI refinement - 2026-11-12 (superseded)

This design was rejected by the user and removed. `LightSculpture.tsx`, its
styles, its nine browser tests and its screenshots no longer exist, so the file
and image links in this section are historical and no longer resolve. The four
`light-sculpture-*.log` files are kept. The current interface is described in
the real-time section of this report.

### Approved design and scope

The user selected **interactive light sculpture** after rejecting the earlier
typography-only passes. D-017 was written before implementation. The result
replaces the oversized title sequence with an original ribbed light sculpture,
pointer-responsive perspective, reversible scatter/align controls, a pause
button, deliberate desktop/mobile composition, and a compact working playground.

The 56-rib illustration is clearly labeled as a concept, not an agent run. Its
projected geometry and materials are computed once; transitions move those
surfaces at up to 30 updates per second, and typing in the form does not rebuild
the sculpture. There is no WebGL runtime or new dependency. Self-hosted fonts,
the API contract, the database, resource ceilings, and CSP remain unchanged.

### Actual validation

| Check                 | Observed result                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting            | Modified TypeScript, CSS, HTML and test sources formatted with existing Prettier.                                                                                                           |
| Unit tests            | **8 passed**, zero failures.                                                                                                                                                                |
| Compilation           | `tsc --noEmit` and Vite production build passed.                                                                                                                                            |
| Browser suite         | **9 passed**, zero retries; final full run reported 4.3 minutes on the shared host. This is elapsed test time, not a benchmark.                                                             |
| Focused pointer check | **1 passed** after adding an assertion against the actual computed perspective transform; also verified scatter/align, pause and offscreen state.                                           |
| Existing workflows    | Real web/API/PostgreSQL success; server-side validation failure; malformed JSON; network failure/retry; absent future mutation routes and headers preserved.                                |
| Motion and keyboard   | Geometry changes on Scatter and returns on Align; pause stops running animations; reduced motion is static; keyboard controls and skip-to-playground work.                                  |
| Responsive rendering  | Checked 320 x 740, 390 x 844, 768 x 1024 and 1440 x 900. Heading, form fields and sculpture controls stay inside the viewport.                                                              |
| Browser console       | Happy-path test records both page errors and console errors and passed with neither.                                                                                                        |
| Visual inspection     | Inspected first-screen desktop/tablet/phone images, the full working page/mobile form, and the scattered sculpture. Refined heavy-looking initial geometry into thinner reflective ribbons. |

A temporary component-wrapper syntax error was caught by Prettier before any
replacement image was deployed. It was fixed, then compilation, unit tests and
the full browser suite were rerun successfully. The old data-URL grain was
observed blocked by CSP and removed; the policy was not weakened.

The API code did not change, so Java compilation/tests and destructive-style
database outage exercises were not repeated for this UI-only refinement.
The live browser suite still exercised the real, running backend and database.

### Exact commands

Run from the LightSprint project directory. Docker remains the only runtime
requirement on the host:

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps web-tool sh -lc 'npx prettier --write src/LightSculpture.tsx && npm test && npm run build'
docker build --tag lightsprint-web:local .\apps\web
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml up -d --no-deps --wait --wait-timeout 120 web
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps e2e
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps e2e npm test -- --grep 'light sculpture rearranges'
```

Formatting was also run with narrower file lists after each affected edit. Each
dependent build/recreate/test step was gated on the previous exit code. No npm
installation, host runtime change, Git action, cloud deployment or other-project
operation was performed.

### Persistent evidence for this refinement

- [Final frontend build/unit output](../artifacts/light-sculpture-build.log)
- [Full nine-test browser output](../artifacts/light-sculpture-e2e.log)
- [Focused pointer/scatter/pause output](../artifacts/light-sculpture-pointer.log)
- [Desktop light study](../artifacts/e2e/light-study-1440.png)
- [Tablet light study](../artifacts/e2e/light-study-768.png)
- [Small-phone light study](../artifacts/e2e/light-study-320.png)
- [Full desktop page](../artifacts/e2e/dashboard.png)
- [Full mobile page](../artifacts/e2e/mobile.png)
- [Scattered state](../artifacts/e2e/sculpture-scattered.png)

The default Playwright JSON/JUnit/HTML report paths now contain the **most recent
focused one-test run**, not the earlier nine-test suite. The complete nine-test
stdout remains in `artifacts/light-sculpture-e2e.log`; do not confuse the two.

### Changed files in this refinement

Added:

- [LightSculpture.tsx](../apps/web/src/LightSculpture.tsx)

Modified:

- [App.tsx](../apps/web/src/App.tsx)
- [styles.css](../apps/web/src/styles.css)
- [index.html](../apps/web/index.html)
- [favicon.svg](../apps/web/public/favicon.svg)
- [smoke.spec.ts](../tests/e2e/smoke.spec.ts)
- [playwright.config.ts](../tests/e2e/playwright.config.ts): removed an unsupported
  `use.animations` option; screenshot calls use the supported per-capture option.
- [README.md](../README.md)
- [PLAN.md](PLAN.md)
- [DECISIONS.md](DECISIONS.md)
- [VERIFICATION.md](VERIFICATION.md)

### Handoff

The new web image is running at <http://127.0.0.1:18105>. Only LightSprint's web
container was replaced; API/database services and other projects were left
alone. One-shot check containers exited. No remaining UI implementation blocker
was observed. The work remains a local Phase 1 prototype, not an award winner or
a finished multi-agent product. Phase 2 and Git initialization still require
separate permission.

## Real-time scene - 2026-11-12

### What changed and why

The user asked a third time for an Awwwards-level interface. The earlier passes
restyled a conventional page; D-018 changes the approach. The page background
is now one WebGL2 particle scene that the page content sits on. The same
particles form four shapes as the page scrolls: a swarm, a converging dependency
graph, a calm field and a single-direction sprint. Around it: a loader that
hands over to an intro burst, a headline that rises letter by letter, a pinned
manifesto that lights up with scroll, glass panels, a cursor ring, magnetic
buttons and inertial wheel scrolling.

It is hand-written WebGL2 with the existing self-hosted fonts: no new
dependency, no third-party request, CSP unchanged. The API, database, Compose
resources and Phase 1 scope are unchanged. The only infrastructure change is the
proxy read timeout in D-019.

### Results on the final build

| Check                     | Observed result                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting                | Whole project passes the existing Prettier check.                                                                                                                                                        |
| Unit tests                | **22 passed** in 4 files: 8 existing HTTP-boundary tests, 3 formation, 5 scroll-mapping and 6 quality-control tests.                                                                                     |
| Compilation               | `tsc --noEmit` and the Vite production build passed. JavaScript 272.86 kB (85.87 kB gzip), CSS 23.31 kB.                                                                                                 |
| Browser suite             | **12 passed**, no retries, 5.9 minutes on the shared host. Elapsed test time, not a benchmark.                                                                                                           |
| Phase 1 flows             | Real web/API/PostgreSQL validation, server-side rejection, malformed JSON, network failure and retry, absent future routes, headers and CORS: all still pass.                                            |
| The scene is really drawn | Tests copy the WebGL canvas and read its pixels. Lit pixels appear after the intro, and each of the four scenes is a measurably different picture from the one before it.                                |
| Pointer                   | The swarm opens around the pointer (brightness at its centre fell to about half) and closes when the pointer leaves. Cursor ring and magnetic button follow the pointer and reset.                       |
| Scroll                    | The wheel is taken over and lands exactly on its target; the pinned manifesto goes from dim to fully lit across the section; anchor links glide to their section.                                        |
| Scene responses           | A successful validation raises the lit area of the field (ripple). With the stack unreachable the scene dims to under half; it recovers on retry. A rejection turns the scene red and editing clears it. |
| Still frames              | With `?render=still` the page scrolls natively, takes neither wheel nor pointer, and shows a different still picture for each section.                                                                   |
| Reduced motion            | No running animations, no loader, no pinning; the same position always gives an identical picture; keyboard skip link reaches the playground.                                                            |
| No WebGL2                 | With WebGL2 disabled the page shows its static backdrop, says so on the page and in the console, and the form still validates.                                                                           |
| Responsive                | 320 x 740, 390 x 844, 768 x 1024 and 1440 x 900: each headline line stays on one line and inside the screen; form, button and readout stay inside the screen; no horizontal overflow.                    |
| Console                   | The live and still-frame tests record page errors, console errors and WebGL error messages; there were none.                                                                                             |

### Failures found and fixed

- **Two real 504 responses.** The first full run failed the two validation tests
  with HTTP 504. The API had answered correctly in 11.7 s and 6.0 s; nginx gave
  up after 5 s. Reproduced by holding only this project's API for 9 s (504 at
  5.17 s), fixed by a 30 s read timeout (200 at 8.64 s). See D-019. This was a
  pre-existing weakness, exposed by this suite running a software renderer next
  to the API.
- **The animation was unusable on a slow renderer.** In the test container the
  lowest quality took about 765 ms per frame, which made scrolling and the
  cursor stutter. The page now detects this and switches to still frames; with
  no preference set it settled 9.7 s after navigation.
- **Sprint scene read as static noise.** The first version was uniform dots.
  Particles now run in 26 lanes as streaks led by their brightest points.
- **Graph was washed out on phones** and the field crowded the horizon. Dense
  formations are drawn dimmer, narrow screens get lower gain, and distant light
  fades out.
- **Cursor ring turned purple over the lime buttons** (a difference blend). It
  is now a neutral ring with a dark outer edge.
- **Hero copy collided with the headline**, the header let content show
  through, the manifesto ran under the graph, and the footer wordmark was
  clipped. Each was fixed and re-inspected.

### What was inspected by eye

Stills of all four scenes, the playground and the footer at 1440 x 900 and
390 x 844, rendered at the 56,000-particle level by overriding the reported
renderer name; the loader at 1440 x 900; motion captures of the burst and of
each morph at the 14,000-particle software level; the stack-unreachable,
rejected, pointer and no-WebGL2 states; and the suite's own screenshots of the
final build.

### What is not verified

- **Frame rate at full quality on a hardware GPU.** The test browser only has a
  software renderer. The host's own Edge was run headless once: it reported
  `webgl2`, a live loop and 56,000 particles (the hardware starting level) and
  produced `host-edge-intro.png`, a frame of the intro burst with light trails.
  That run used virtual time, so it shows the picture is drawn but measures no
  frame rate. The quality control is covered by unit tests, not by a real GPU.
- The VS Code browser tool could not be used: its page was reported missing
  after opening, as in earlier passes.
- Java tests and the database-outage exercise were not repeated: no API or
  database code changed. The full `scripts/Verify.ps1` was not re-run; its
  frontend parts (format check, unit tests, build, image, browser suite) were
  run individually on the final build.
- GitHub's CI has not seen this change. It passed on the two earlier commits,
  but the changes here are uncommitted. The browser suite is now slower because
  it draws WebGL in software, so the workflow's 30-minute limit is untested for
  it (the earlier runs took under three minutes).
- Safari and Firefox were not tested. Only Chromium was.

### Exact commands

From the LightSprint project directory. Docker is the only host requirement.

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps web-tool sh -lc 'npx prettier --write src ../../tests/e2e && npm test && npm run build'
docker build --quiet --tag lightsprint-web:local .\apps\web
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml up -d --no-deps --wait --wait-timeout 120 web
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps e2e
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps web-tool npm run format:check
```

A single browser test can be run by name, for example:

```powershell
docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml --profile tools run --rm --no-deps e2e npm test -- --grep 'answers the pointer'
```

The 504 was reproduced with `docker pause lightsprint-api-1`, a request through
the web proxy, and `docker unpause lightsprint-api-1` nine seconds later. Only
this project's API container was paused, twice, and it returned to healthy each
time. Temporary inspection scripts were run with the `e2e` service and deleted.
The host Edge run used a throwaway profile inside `artifacts/`, also deleted.

### Evidence

- [Frontend unit tests and build](../artifacts/realtime-build.log) (first build
  of this pass; later builds were read from the console)
- [Final 12-test browser output](../artifacts/realtime-e2e.log)
- Final-build screenshots in `artifacts/e2e/`: `scene-1-swarm.png`,
  `scene-1-pointer.png`, `scene-2-graph.png`, `scene-3-field.png`,
  `scene-4-sprint.png`, `validated.png`, `rejected.png`, `static-backdrop.png`,
  `hero-{320,390,768,1440}.png`, `playground-{320,390,768,1440}.png`
- `artifacts/e2e/host-edge-intro.png`: the host's Edge, 56,000 particles
- Playwright JSON, JUnit and HTML reports of the final run in `artifacts/e2e/`

The suite's screenshots come from the software renderer, so they show the
14,000-particle level. The inspection stills at 56,000 particles were temporary
and were deleted, along with the screenshots of the two superseded designs.

### Changed files

Added in `apps/web/src/experience/`:

- [engine.ts](../apps/web/src/experience/engine.ts): WebGL2 renderer
- [shaders.ts](../apps/web/src/experience/shaders.ts): particle, bloom and composite shaders
- [director.ts](../apps/web/src/experience/director.ts): motion, scrolling, pointer, fallbacks
- [formations.ts](../apps/web/src/experience/formations.ts) and its tests: particle positions
- [scenes.ts](../apps/web/src/experience/scenes.ts) and its tests: scroll-to-scene mapping
- [quality.ts](../apps/web/src/experience/quality.ts) and its tests: quality control

Rewritten: [App.tsx](../apps/web/src/App.tsx),
[styles.css](../apps/web/src/styles.css),
[smoke.spec.ts](../tests/e2e/smoke.spec.ts).

Modified: [main.tsx](../apps/web/src/main.tsx) (font file with the width axis),
[index.html](../apps/web/index.html),
[nginx.conf](../apps/web/nginx.conf) (D-019),
[playwright.config.ts](../tests/e2e/playwright.config.ts) (longer timeouts),
[README.md](../README.md), [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md),
[ARCHITECTURE.md](ARCHITECTURE.md) and this report.

Deleted: `apps/web/src/LightSculpture.tsx`.

### Handoff

The new web image is running at <http://127.0.0.1:18105>. Only LightSprint's
web container was replaced; its API and database kept running, and no other
project was touched. No Git write, npm installation, host runtime change or
cloud deployment was made. Outside requests were limited to Docker registry
metadata during image builds and read-only queries of the repository's public
run list. All changes are uncommitted in the working
tree. This remains a local Phase 1 prototype: it has won no award and is not a
finished multi-agent product. Phase 2 still needs separate permission.

## Connection refused after a restart - 2026-11-13

### What happened

Times are local. Neither start of the containers at 12:33 nor the restart of
the PC was done by this session.

- **12:33** All four LightSprint containers were started together after having
  been down since about 11:35. The web container started 7 s before the API.
  nginx stopped with `host not found in upstream "api"` (exit code 1) and
  stayed down, while the API and the database were healthy. The user reported
  "connection refused" at 12:44.
- **About 12:51** The web container was started again and the page answered.
- **13:03** The PC restarted. Docker Desktop was back at 13:15, but every
  LightSprint container stayed stopped (exit code 255, restart policy `no`)
  until this session started them at 13:32.

### Fixes

- D-021: nginx looks the API up per request, so the web server starts whether
  or not the API is running.
- D-022: `db`, `api` and `web` use `restart: unless-stopped`, chosen by the
  user, so they start with Docker.

### Checks

| Check                                                                                              | Before the fix                                  | After the fix                                                                                                                                                |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web image loads its configuration with no network, so the API name cannot be resolved (`nginx -t`) | Exit code 1, `host not found in upstream "api"` | Exit code 0                                                                                                                                                  |
| Web container started alone with the API stopped                                                   | Crashed at start (the incident)                 | Healthy. Page 200 in 0.05 s; API through the page 502 in 4.2 s                                                                                               |
| API started afterwards, web container untouched                                                    | Not applicable                                  | API through the page 200 in 0.2 s; web container not restarted                                                                                               |
| All three stopped, then started together with `docker start`, web first and database last          | Not applicable                                  | Page 200 after 14 s, the first probe once the start command returned; API through the page 200 after 53 s; no container restarted                            |
| Restart policy                                                                                     | `no` everywhere                                 | `unless-stopped` on `db`, `api`, `web`; `no` on `test-db`. CPU, memory and loopback ports unchanged                                                          |
| Database row across the recreation of the containers                                               | `1\|2026-11-11 15:23:03.260168+00`              | Identical                                                                                                                                                    |
| Web server ended from inside the container (`nginx -s quit`)                                       | Not applicable                                  | Docker restarted it; page 200 again after 2.2 s                                                                                                              |
| API started while the database was stopped                                                         | Not applicable                                  | The API failed and Docker restarted it after 41 s. The database was then started and the API answered through the page 33 s later, with nobody restarting it |
| Browser tests that go through the proxy                                                            | Not applicable                                  | 5 passed: validation, rejection, malformed JSON, network failure and retry, headers and absent routes                                                        |
| Verifier                                                                                           | Not applicable                                  | Parses; its new step, run as written, passed                                                                                                                 |

### Not verified

- **A real Docker or PC restart with the new policy.** Restarting Docker would
  stop every other project on this machine. Supporting observation: three other
  containers on this machine that already use `unless-stopped` came back at
  13:16:20, a minute after Docker Desktop started at 13:15:09.
- The full `scripts/Verify.ps1`, the Java tests and the other seven browser
  tests were not re-run. No Java, database or page code changed.
- For about the first minute after a start the API is still booting. The page
  loads and shows "Cannot load stack status" with its retry button; it does not
  retry by itself.

### Exact commands

From the LightSprint project directory. `$c` stands for
`docker compose --env-file .\.env -p lightsprint -f .\infra\docker\compose.yaml`.

```powershell
docker build --quiet --tag lightsprint-web:local .\apps\web
docker run --rm --network none --memory 64m --cpus 0.25 --pids-limit 64 --entrypoint nginx lightsprint-web:local -t
$c stop web api
$c up -d --no-deps --wait --wait-timeout 60 web
$c up -d --wait --wait-timeout 180 db api web
docker stop lightsprint-web-1 lightsprint-api-1 lightsprint-db-1
docker start lightsprint-web-1 lightsprint-api-1 lightsprint-db-1 lightsprint-test-db-1
docker exec lightsprint-web-1 nginx -s quit
docker stop lightsprint-api-1 lightsprint-db-1
docker start lightsprint-api-1
docker start lightsprint-db-1
$c --profile tools run --rm --no-deps e2e npm test -- --grep 'real browser validates|server-side rejection|sanitized errors|network failure is visible|browser headers'
```

The page and the API were probed with `curl.exe --noproxy '*'` against
`http://127.0.0.1:18105/` and `http://127.0.0.1:18105/api/v1/system`. Only
LightSprint's own containers were stopped or started; the `test-db` container
was stopped again afterwards. Browser test output:
[proxy-fix-e2e.log](../artifacts/proxy-fix-e2e.log).

### Changed files

- [nginx.conf](../apps/web/nginx.conf): per-request lookup of the API (D-021)
- [compose.yaml](../infra/docker/compose.yaml): restart policy (D-022)
- [Verify.ps1](../scripts/Verify.ps1): start-up check for the web image
- [README.md](../README.md), [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md),
  [ARCHITECTURE.md](ARCHITECTURE.md) and this report

All of it is uncommitted, like the real-time scene.
