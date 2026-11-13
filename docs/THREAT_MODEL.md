# Threat model

This is a Phase 0 design assessment, not a penetration test, certification, or
claim of production safety.

## Assets and trust boundaries

Assets: the user's host and other project sessions, future repository contents
and credentials, local database integrity, and truthful verification evidence.
Phase 1 accepts synthetic data only.

Boundaries: browser to loopback web server; web proxy to API; API to private
PostgreSQL; project source to build/check tools; and future agents to repository
execution. The last boundary remains closed in this phase.

## Threats and controls

| Threat                                    | Phase 0/1 control                                                                                                                   | Residual risk / later work                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Other projects stopped or data removed    | Use only Compose project `lightsprint`, explicit service names, unique ports, no prune, no global stop, no volume-removing cleanup. | Docker daemon is shared; verify resource limits and avoid parallel builds.                                 |
| Public or cross-project database exposure | Database has no host port and uses only the internal database network; credentials are random, ignored, local-only values.          | Docker administrators can inspect containers/volumes; this is not tenant-grade isolation.                  |
| Credential or repository disclosure       | No Docker socket or host repo mounts in runtime containers; no agents, Git operations, external telemetry, or remote AI calls.      | Development tools mount only this project's relevant sources to build them.                                |
| Command injection through specifications  | Validation-only endpoint; no shell, file path, Git, task, or process dispatch.                                                      | Agent execution requires separate future design and approval.                                              |
| SQL injection                             | Only a fixed bootstrap metadata query; no user input enters SQL.                                                                    | Reassess with Phase 2 domain queries and permissions.                                                      |
| Invalid input / reflected data leakage    | Bean Validation bounds, strict JSON fields, sanitized errors; UI uses React text rendering; rejected values/bodies are not logged.  | Complete abuse protection and fuzzing are not yet implemented.                                             |
| XSS / browser embedding                   | No raw HTML rendering; same-origin API; CSP, nosniff, no-referrer, and frame-ancestor restrictions.                                 | CSP is defense in depth, not proof of absence of XSS.                                                      |
| Resource exhaustion                       | CPU/memory/PID ceilings, small connection pool, bounded check workers, proxy body cap and timeouts.                                 | The direct loopback API does not yet enforce a streaming body cap or rate limit. Never expose it publicly. |
| Unauthorized data modification            | No domain persistence or execution endpoints; dry-run validation only.                                                              | No authentication exists. Phase 2 must add permissions before meaningful mutations.                        |
| False health/success                      | Database included in readiness; schema read from PostgreSQL; errors are explicit; real browser verification required.               | Production monitoring and distributed tracing remain later work.                                           |
| Compromised dependency                    | Exact manifests/lockfiles, official runtime images, no uploaded code or real data.                                                  | A full supply-chain/security audit is not part of this phase; record actual versions.                      |
| Failed tests nevertheless integrated      | No integration/merge operations are available; CI contract checks formatting/build/tests/e2e.                                       | The real merge gate and human approval system are not implemented.                                         |

## Non-negotiable restrictions

- Never auto-merge protected branches or expose repository secrets to agents.
- No commits, remotes or pushes by an agent without explicit permission. The
  user declined Git initialization at the start and later created and pushed
  the repository themselves; that does not extend permission to agents.
- No cloud resources, billing, real user data, or other project/session access.
- Do not claim benchmark, security, CI, or production results that were not run.
- Do not globally prune Docker, stop other projects, or delete database volumes.
- All authored files and local evidence remain inside the LightSprint folder.

## Required checks

Validate rejected fields and sanitized errors; verify absent future execution
routes; inspect loopback bindings, no DB port, container mounts and resource
ceilings; exercise genuine DB readiness failure/recovery; and run a real browser
against the local services. Store observed outcomes in the verification report.

## Verified network correction

An all-internal runtime network made Docker 29 discard effective published
bindings, so container-only health was insufficient. The corrected design uses
a loopback-published edge bridge for web/API, while PostgreSQL remains solely on
an internal network. No public host binding is authorized. The edge permits
outbound connectivity at the network layer; the application has no external
providers or telemetry and must continue using synthetic data only.
