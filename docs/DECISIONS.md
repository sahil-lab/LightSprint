# Decisions

| ID    | Decision                                                                       | Rationale                                                                                                                 |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Limit execution to Phases 0 and 1.                                             | Explicit user scope overrides later prompts and full-MVP checklists.                                                      |
| D-002 | Do not initialize Git.                                                         | User selected `leave-uninitialized`; record the Phase 0 exception without blocking independent local scaffold work.       |
| D-003 | Java 21 / Spring Boot 3, React/TypeScript, PostgreSQL.                         | Follow the supplied architecture; host Node 14 and missing Java are not altered.                                          |
| D-004 | Use containerized Maven 3.9.11 / Java 21 and Node 22.23.4.                     | Verified cached supported runtimes; no global runtime replacement.                                                        |
| D-005 | Spring Boot 3.5.16; exact npm dependencies and lockfiles.                      | Boot 3 line verified from Maven Central; frontend versions checked using the supported Node container before scaffolding. |
| D-006 | Implement a non-persisting specification validator, not `POST /projects`.      | Demonstrates request validation without accidentally starting Phase 2 domain APIs.                                        |
| D-007 | Bootstrap metadata is the only application table.                              | Proves migration and persistence while deferring the domain schema.                                                       |
| D-008 | No Redis, Kafka, worker, agents, or cloud integration yet.                     | The skeleton has no async workload; avoid unnecessary resources and unsafe execution.                                     |
| D-009 | Use `lightsprint`, loopback 18105/18205, and private PostgreSQL.               | Coexist with nine other sessions and prevent unintended network exposure.                                                 |
| D-010 | Compile/test in bounded containers; assemble minimal runtime images afterward. | Avoid unconstrained parallel build compilers on the shared Docker host.                                                   |
| D-011 | Isolate test DB from persisted app DB.                                         | Repeatable tests must not reset or contaminate app state.                                                                 |
| D-012 | Generate an ignored local-only DB password.                                    | No credential literal in source, no external secrets access, no real data.                                                |
| D-013 | No authentication in the read/validate-only loopback skeleton.                 | Explicitly temporary boundary; permissions are required before Phase 2 mutations.                                         |
| D-014 | Structured local logs now; external tracing later.                             | Meet basic diagnosability without sending input or source to third parties.                                               |
| D-015 | Run browser tests against built images, not mock servers.                      | Verify the complete required web -> API -> migrated PostgreSQL path.                                                      |

## Prompt interpretation

The PDF's start-from-zero prompt supplies the lead-engineer workflow: inspect,
write the design artifacts first, scaffold, verify every slice, and record
evidence. Its instruction to commit is superseded by the user's prohibition.
Its other prompts are retained as future guidance, not executed ahead of their
phase. No security certification, benchmark, cloud deployment, or finished
multi-agent factory is implied.

## D-016: separate edge and database networks after observed failure

The first full verification passed formatting, 15 Java tests, 8 frontend tests,
TypeScript compilation, Vite build, image builds, and container health, but
failed the first host HTTP check. Docker inspect showed the requested loopback
mapping in `HostConfig.PortBindings` and an empty effective binding in
`NetworkSettings.Ports` on the all-internal network. Curl independently confirmed
connection refusal on both reserved ports.

Use a normal project-owned edge bridge for web/API and retain a separate internal
API/database network. No database host port, extra host port, public binding,
runtime privilege, or resource ceiling change is needed. Verify effective
bindings, not only configuration or container-local health.

## D-017: interactive light-sculpture art direction

The user explicitly selected `light-sculpture` after rejecting the typography-only
redesigns. Replace the sparse title sequence with an original, visibly
three-dimensional light study, a deliberate first-screen composition, and a
compact functional playground. The sculpture is an illustration of alignment,
not a task graph, agent run, performance measurement, or Phase 2 feature.

Use procedurally projected SVG geometry and the existing self-hosted fonts.
No external image service, graphics dependency, cloud service, runtime network
request, CSP relaxation, or backend change is required. The earlier blocked
data-URL grain effect is removed rather than permitting inline images.

Acceptance for this refinement: obvious visual change at desktop and phone
sizes; keyboard-operable scatter/align and motion controls; a static, usable
reduced-motion state; no continuous animation while offscreen or hidden;
unobscured anchor navigation; preserved API success/failure behavior; and
format/typecheck/build/unit/browser evidence. Inspect actual screenshots and
browser console output, not only passing HTTP checks. Do not claim an award or
objective aesthetic multiplier.

## D-018: real-time WebGL scene replaces the static sculpture

The user rejected D-017's result a second time with the same request: an
Awwwards-level experience. The SVG sculpture was a still illustration placed on
a conventional page. Sites of that kind are built differently, so the approach
changes rather than the styling:

- The page background is one real-time WebGL2 particle scene. The same particles
  form four shapes that morph as the page scrolls: a swarm, a converging
  dependency graph, a calm field and a single-direction sprint.
- The scene has light trails, two-level bloom, depth of field, fog, grain and a
  filmic grade, and it answers the pointer, each validation result and the
  health of the local stack.
- The page adds a loader that hands over to an intro burst, a headline that
  rises letter by letter, a pinned manifesto that lights up with scroll, glass
  panels, a cursor ring, magnetic buttons and inertial wheel scrolling.

Constraints kept: no new dependency and no third-party request (hand-written
WebGL2, existing self-hosted fonts); CSP unchanged; API, database, Compose
resources and Phase 1 scope unchanged. The scene is labelled as an illustration,
not an agent run or a live plan.

Required behaviour: quality adapts to measured frame time; software renderers
start at the lowest level; without WebGL2 a static backdrop is shown and the
page says so; with reduced motion there is no loop, no pinning, no cursor or
scroll takeover, only still frames. Keyboard, touch and scrollbar scrolling stay
native.

Acceptance: unit tests for the pure formation and scroll-mapping logic; browser
tests that read real canvas pixels, prove the picture changes between scenes
and is still under reduced motion, and re-run every Phase 1 flow; screenshots
of every scene inspected at desktop and phone sizes. No award or multiplier is
claimed.

Decisions taken while building it:

- **Three ways to draw, chosen by what the browser can do.** Live: a frame loop
  with trails, pointer response and inertial scrolling. Still frames: one frame
  per scene, drawn on demand, with native scrolling. Static backdrop: a CSS
  gradient when WebGL2 is missing or a frame cannot be drawn. The page states
  which one is active.
- **A renderer that cannot animate stops trying.** The test browser's software
  renderer drew about one frame every 0.77 s at the lowest quality. A loop that
  slow makes the whole page stutter, so after roughly three seconds below about
  15 frames per second at the lowest quality the page switches to still frames
  for the rest of the visit. `?render=live` and `?render=still` force a mode;
  the browser tests use them because their renderer is always the slow one.
- **Reduced motion gets whole scenes only.** No loop, no pinning, no cursor ring
  and no scroll takeover; the scene changes only when a new section is reached.
- **The scene reports real state.** It dims and loses colour while the local
  stack is unreachable, ripples once when a specification validates, and turns
  red for a rejection (a short flash when live; for as long as the rejection is
  shown in still frames).
- **Quality is measured, not assumed.** Four levels from 14,000 to 96,000
  particles. The median frame time of each window decides; a level that proved
  too slow is never tried again in the same visit.

## D-019: proxy read timeout raised from 5 s to 30 s

Found by the first full browser run of D-018, not by inspection: two validation
requests returned HTTP 504. The API had answered correctly, in 11.7 s and
6.0 s, but nginx gave up after 5 s. The API has a 0.75 CPU share on a busy host
and its first request after a long idle is slow. Holding only this project's
API for 9 s reproduced the 504 at 5.17 s; with a 30 s read timeout the same
request returned 200 after 8.64 s.

The timeout stays bounded, the 3 s connect timeout and the 16 kB body cap are
unchanged, and both ports remain loopback-only. A stalled API can now hold a
proxy connection for up to 30 s instead of 5 s, which matters only if the stack
were exposed; it must not be. The interface already reports a proxy failure as
an error rather than as success.

## D-020: the repository belongs to the user; agents still do not commit

D-002 recorded the user's choice to leave Git uninitialized. On 2026-11-12 the
user's account created the repository, committed twice and pushed to a public
GitHub repository; GitHub ran the CI workflow on both pushes and both runs
succeeded. None of this was done by the build session.

D-002's rule for agents stands: no commit, push or remote change without an
explicit request. Work is left uncommitted in the working tree and reported.
Because the repository is public, `.env` and `artifacts/` must stay untracked
(they are), and documents should not contain local paths or account names.

## D-021: the web server no longer needs the API in order to start

On 2026-11-13 the page refused connections. All four LightSprint containers had
been started together, outside `docker compose up`, with the web container 7 s
ahead of the API. nginx resolves a fixed `proxy_pass` host name once, when it
starts; Docker's DNS only knows running containers, so nginx stopped with "host
not found in upstream api" and stayed down.

nginx now looks the API up per request through Docker's built-in DNS (a
`resolver` and a variable in `proxy_pass`), re-checked every 10 s. The web
server starts in any order and survives the API container being replaced. While
the API is down the proxy answers 502, after about 4 s here (the time Docker's
DNS takes to give up on the name), and the interface shows its existing "Cannot
load stack status" error with its retry button. The interface does not retry by
itself.

Compose still starts the web container only after the API is healthy. The
verifier now loads the web image's configuration with no resolvable API name;
that check fails on the old configuration.

## D-022: the three services start with Docker (user decision)

Later the same day the PC restarted and nothing started LightSprint again:
every service had restart policy `no`. Asked whether LightSprint should start
automatically with Docker Desktop, the user chose yes.

`db`, `api` and `web` now use `restart: unless-stopped`; `test-db` and the tool
services do not. Docker starts the three together, in no particular order, so
D-021 is a precondition. The API still gives up if the database is not
reachable when it starts; Docker then restarts it until the database is up.
`docker compose stop` keeps a service stopped across Docker restarts, which is
how to switch LightSprint off.

Cost: LightSprint uses its share (at most 1.5 CPUs and 832 MiB, unchanged)
whenever Docker runs, and a service that cannot start is retried for as long as
Docker runs, within its CPU limit.
