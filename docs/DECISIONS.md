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
