import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getSystemStatus, validateSpecification } from "./client";
import type { SystemStatus } from "./client";

type StackState =
  { kind: "loading" } | { kind: "ready"; value: SystemStatus } | { kind: "error"; message: string };

type Submission = { kind: "success"; count: number } | { kind: "error"; message: string } | null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected request failure occurred.";
}

export default function App() {
  const [stack, setStack] = useState<StackState>({ kind: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<Submission>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStack({ kind: "loading" });
    getSystemStatus(controller.signal)
      .then((value) => setStack({ kind: "ready", value }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStack({ kind: "error", message: errorMessage(error) });
        }
      });
    return () => controller.abort();
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmission(null);
    setSubmitting(true);
    try {
      const result = await validateSpecification({
        title: title.trim(),
        acceptanceCriteria: criteria
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
      });
      setSubmission({ kind: "success", count: result.criterionCount });
    } catch (error: unknown) {
      setSubmission({ kind: "error", message: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  function useExample() {
    setTitle("Synthetic status dashboard");
    setCriteria("Show database readiness\nDisplay validation failures clearly");
    setSubmission(null);
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="LightSprint home">
          <span className="brand-mark" aria-hidden="true">
            L
          </span>
          LightSprint<span className="brand-divider">/</span>
          <span className="brand-subtitle">Engineering workspace</span>
        </a>
        <span className="local-badge">
          <span className="dot" />
          Local only
        </span>
      </header>

      <main id="main">
        <section className="intro" aria-labelledby="page-heading">
          <div>
            <p className="eyebrow">FOUNDATION / PHASE 01</p>
            <h1 id="page-heading">
              Good engineering starts
              <br />
              with clear boundaries.
            </h1>
            <p className="intro-copy">
              Check the stack. Shape a specification. Keep execution under human control.
            </p>
          </div>
          <div className="phase-stamp">
            <span className="stamp-number">
              01<span>/ 06</span>
            </span>
            <span>Working skeleton</span>
          </div>
        </section>

        <section className="stack-panel" aria-labelledby="stack-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LIVE CONNECTION</p>
              <h2 id="stack-heading">Your local stack</h2>
            </div>
            <button
              className="quiet-button"
              onClick={() => setRefresh((value) => value + 1)}
              disabled={stack.kind === "loading"}
            >
              {stack.kind === "loading" ? "Checking..." : "Refresh status"}
            </button>
          </div>
          <div aria-live="polite">
            {stack.kind === "loading" && (
              <p className="muted">Checking the API and PostgreSQL...</p>
            )}
            {stack.kind === "error" && (
              <div className="notice error" role="alert">
                <strong>Cannot load stack status.</strong>
                <p>{stack.message}</p>
                <button className="quiet-button" onClick={() => setRefresh((value) => value + 1)}>
                  Retry connection
                </button>
              </div>
            )}
            {stack.kind === "ready" && (
              <div className="service-grid">
                <div className="service">
                  <span className="service-label">API</span>
                  <strong>
                    <span className="dot" />
                    Ready
                  </strong>
                  <span>Spring Boot / Java 21</span>
                </div>
                <div className="service">
                  <span className="service-label">DATABASE</span>
                  <strong>
                    <span className="dot" />
                    PostgreSQL connected
                  </strong>
                  <span>Private network / no host port</span>
                </div>
                <div className="service">
                  <span className="service-label">MIGRATION</span>
                  <strong>Schema version {stack.value.schemaVersion}</strong>
                  <span>Read from persistent storage</span>
                </div>
                <div className="service">
                  <span className="service-label">EXECUTION</span>
                  <strong>Validation only</strong>
                  <span>No agents or repository access</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="content-grid">
          <section className="panel intake-panel" aria-labelledby="intake-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SAFE TO EXPLORE</p>
                <h2 id="intake-heading">Specification sandbox</h2>
              </div>
              <span className="outline-badge">Dry run</span>
            </div>
            <p className="section-copy">
              Try a synthetic requirement. We validate its shape, not its feasibility.
            </p>
            <form onSubmit={submit}>
              <fieldset disabled={submitting}>
                <legend className="visually-hidden">Synthetic specification</legend>
                <label htmlFor="spec-title">Specification title</label>
                <input
                  id="spec-title"
                  name="title"
                  value={title}
                  required
                  maxLength={80}
                  autoComplete="off"
                  placeholder="e.g. Synthetic status dashboard"
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setSubmission(null);
                  }}
                />
                <div className="label-row">
                  <label htmlFor="spec-criteria">Acceptance criteria</label>
                  <span>One per line</span>
                </div>
                <textarea
                  id="spec-criteria"
                  name="criteria"
                  rows={5}
                  required
                  maxLength={2650}
                  value={criteria}
                  aria-describedby="criteria-help"
                  placeholder={"Show database readiness\nDisplay validation failures clearly"}
                  onChange={(event) => {
                    setCriteria(event.target.value);
                    setSubmission(null);
                  }}
                />
                <p className="field-help" id="criteria-help">
                  1-10 criteria, up to 240 characters each. Synthetic data only.
                </p>
                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    {submitting ? "Validating..." : "Validate specification"}
                    <span aria-hidden="true"> &rarr;</span>
                  </button>
                  <button className="quiet-button" type="button" onClick={useExample}>
                    Use a synthetic example
                  </button>
                </div>
              </fieldset>
              {submission?.kind === "success" && (
                <div className="notice success" role="status">
                  <strong>
                    Validated {submission.count} acceptance{" "}
                    {submission.count === 1 ? "criterion" : "criteria"}.
                  </strong>
                  <p>Nothing was saved or executed.</p>
                </div>
              )}
              {submission?.kind === "error" && (
                <div className="notice error" role="alert">
                  <strong>Validation did not pass.</strong>
                  <p>{submission.message}</p>
                </div>
              )}
            </form>
          </section>

          <aside className="panel roadmap-panel" aria-labelledby="roadmap-heading">
            <p className="eyebrow">INTENTIONALLY INCREMENTAL</p>
            <h2 id="roadmap-heading">Build trust before speed.</h2>
            <ol className="roadmap">
              <li className="current">
                <span className="step-number">01</span>
                <div>
                  <strong>Working skeleton</strong>
                  <p>
                    Health, migrations, validation.
                    <br />
                    The current implementation scope.
                  </p>
                </div>
              </li>
              <li>
                <span className="step-number">02</span>
                <div>
                  <strong>Contracts &amp; permissions</strong>
                  <p>
                    Domain state and safe mutations.
                    <br />
                    Not implemented.
                  </p>
                </div>
              </li>
              <li>
                <span className="step-number">03+</span>
                <div>
                  <strong>Plan, execute, approve</strong>
                  <p>
                    DAGs, isolated agents, merge gates.
                    <br />
                    Not implemented.
                  </p>
                </div>
              </li>
            </ol>
            <div className="boundary-note">
              <span className="boundary-label">HUMAN CONTROL, BY DESIGN</span>
              <p>
                No autonomous execution. No merges. No repository secrets. Those boundaries stay
                closed.
              </p>
            </div>
          </aside>
        </div>
        <footer>
          <span>Independent prototype. Not affiliated with LightSprint.</span>
          <span>Local development only / not production-ready</span>
        </footer>
      </main>
    </div>
  );
}
