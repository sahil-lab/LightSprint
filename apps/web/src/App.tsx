import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getSystemStatus, validateSpecification } from "./client";
import type { SystemStatus } from "./client";
import LightSculpture from "./LightSculpture";

type StackState =
  { kind: "loading" } | { kind: "ready"; value: SystemStatus } | { kind: "error"; message: string };

type Submission = { kind: "success"; count: number } | { kind: "error"; message: string } | null;

const glyphs = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  diagonal: "M6 18 18 6M6 6h12v12",
  down: "M12 4v16m-6-6 6 6 6-6",
  refresh: "M19 10a7 7 0 1 0-1 7M19 4v6h-6",
  check: "m5 12 4 4L19 6",
  layers: "m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Z",
  server: "M4 4h16v6H4V4Zm0 10h16v6H4v-6ZM8 7h.01M8 17h.01",
  database: "M4 6c0-4 16-4 16 0s-16 4-16 0Zm0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0",
};

function Glyph({ name }: { name: keyof typeof glyphs }) {
  return (
    <svg
      className="glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={glyphs[name]} />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 5h5v15h17v5H5Z" fill="currentColor" />
      <path
        d="m15 3 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z"
        fill="currentColor"
        opacity=".8"
        transform="translate(6 -4) scale(.64)"
      />
    </svg>
  );
}

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
  const criteriaLines = criteria
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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
        acceptanceCriteria: criteriaLines,
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
    <div className="site" id="top">
      <a className="skip-link" href="#playground">
        Skip to playground
      </a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="LightSprint home">
          <BrandMark />{" "}
          <span>
            lightsprint<span className="brand-period">.</span>
          </span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#approach">The idea</a>
          <a href="#playground">Playground</a>
          <a href="#roadmap">What&apos;s next</a>
        </nav>
        <a className="header-cta" href="#playground">
          Explore the prototype <Glyph name="diagonal" />
        </a>
      </header>

      <main>
        <section className="hero section-width" aria-labelledby="page-heading">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> A LITTLE LESS CHAOS. A LOT MORE CLARITY.
            </p>
            <h1 id="page-heading">
              Many minds. <br />
              One <em>direction.</em>
            </h1>
            <p className="hero-description">
              Great things happen when everything comes together. A more intentional future for
              parallel engineering, starting with a clear specification.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#playground">
                Enter the playground <Glyph name="arrow" />
              </a>
              <a className="text-link" href="#approach">
                Meet the idea <Glyph name="down" />
              </a>
            </div>
            <div className="hero-assurance">
              <Glyph name="lock" />
              <span>Local by design.</span>
              <span>Human by default.</span>
            </div>
          </div>
          <LightSculpture />
          <div className="hero-baseline">
            <span>
              <span className="tiny-cross" aria-hidden="true" /> INDEPENDENT ENGINEERING EXPLORATION
            </span>
            <span>01 / THE FOUNDATION</span>
            <a href="#approach" aria-label="Scroll to the approach">
              SCROLL TO DISCOVER <Glyph name="down" />
            </a>
          </div>
        </section>

        <section className="approach-section" id="approach" aria-labelledby="approach-heading">
          <div className="section-width approach-layout">
            <div className="section-marker">
              <span>01</span>
              <p>THE IDEA</p>
            </div>
            <h2 id="approach-heading">
              Not more noise.
              <br />
              <em>A shared intention.</em>
            </h2>
            <div className="approach-copy">
              <p>
                Parallel work needs more than speed. It needs a common language, clear boundaries,
                and a human who decides what happens next.
              </p>
              <span className="scope-note">
                That&apos;s the vision. Today, we&apos;re building the foundation.
              </span>
            </div>
          </div>
        </section>

        <section
          className="playground section-width"
          id="playground"
          aria-labelledby="playground-heading"
        >
          <div className="section-intro">
            <div>
              <p className="eyebrow">
                <span className="section-number">02</span> THE PLAYGROUND
              </p>
              <h2 id="playground-heading">
                A clear idea.
                <br />
                <em>A good place to start.</em>
              </h2>
            </div>
            <p>
              A small, working piece of the bigger picture.
              <br />
              Try a synthetic specification. See what holds up.
            </p>
          </div>

          <section className="system-strip" aria-labelledby="stack-heading">
            <div className="system-heading">
              <h3 id="stack-heading">
                <span className="status-dot" data-ready={stack.kind === "ready"} /> Your local stack
              </h3>
              <span className="local-label">LOOPBACK ONLY</span>
              <button
                className="refresh-button"
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                disabled={stack.kind === "loading"}
              >
                <Glyph name="refresh" />
                {stack.kind === "loading" ? "Checking..." : "Refresh status"}
              </button>
            </div>
            <div aria-live="polite">
              {stack.kind === "loading" && (
                <p className="stack-loading">Connecting to the API and PostgreSQL...</p>
              )}
              {stack.kind === "error" && (
                <div className="notice error" role="alert">
                  <strong>Cannot load stack status.</strong>
                  <p>{stack.message}</p>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    Retry connection <Glyph name="arrow" />
                  </button>
                </div>
              )}
              {stack.kind === "ready" && (
                <div className="system-services">
                  <div>
                    <Glyph name="server" />
                    <span>
                      <small>API</small>
                      <strong>Ready</strong>
                    </span>
                    <span className="service-detail">Java 21</span>
                  </div>
                  <div>
                    <Glyph name="database" />
                    <span>
                      <small>DATABASE</small>
                      <strong>PostgreSQL connected</strong>
                    </span>
                  </div>
                  <div>
                    <Glyph name="layers" />
                    <span>
                      <small>MIGRATION</small>
                      <strong>Schema version {stack.value.schemaVersion}</strong>
                    </span>
                  </div>
                  <div>
                    <Glyph name="lock" />
                    <span>
                      <small>MODE</small>
                      <strong>Validation only</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="workspace-grid">
            <section className="spec-panel" aria-labelledby="intake-heading">
              <div className="spec-panel-heading">
                <div>
                  <span className="panel-index">/ 001</span>
                  <h3 id="intake-heading">Specification sandbox</h3>
                </div>
                <span className="dry-run-badge">
                  <span /> DRY RUN
                </span>
              </div>
              <form onSubmit={submit}>
                <fieldset disabled={submitting}>
                  <legend className="visually-hidden">Synthetic specification</legend>
                  <div className="label-row">
                    <label htmlFor="spec-title">Specification title</label>
                    <span>{title.length} / 80</span>
                  </div>
                  <input
                    id="spec-title"
                    name="title"
                    value={title}
                    required
                    maxLength={80}
                    autoComplete="off"
                    placeholder="e.g. A clearer status dashboard"
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setSubmission(null);
                    }}
                  />
                  <div className="label-row">
                    <label htmlFor="spec-criteria">Acceptance criteria</label>
                    <span className={criteriaLines.length > 10 ? "over-limit" : undefined}>
                      {criteriaLines.length} / 10 criteria
                    </span>
                  </div>
                  <textarea
                    id="spec-criteria"
                    name="criteria"
                    rows={4}
                    required
                    maxLength={2650}
                    value={criteria}
                    aria-describedby="criteria-help"
                    placeholder={
                      "Show database readiness\nMake validation failures easy to understand"
                    }
                    onChange={(event) => {
                      setCriteria(event.target.value);
                      setSubmission(null);
                    }}
                  />
                  <p className="field-help" id="criteria-help">
                    One criterion per line. 1-10 criteria, up to 240 characters each.
                  </p>
                  <div className="form-actions">
                    <button className="button button-primary" type="submit">
                      {submitting ? "Validating..." : "Validate specification"}
                      <Glyph name="arrow" />
                    </button>
                    <button className="text-button" type="button" onClick={useExample}>
                      Use a synthetic example <Glyph name="diagonal" />
                    </button>
                  </div>
                </fieldset>
                {submission?.kind === "success" && (
                  <div className="notice success" role="status">
                    <Glyph name="check" />
                    <div>
                      <strong>
                        Validated {submission.count} acceptance{" "}
                        {submission.count === 1 ? "criterion" : "criteria"}.
                      </strong>
                      <p>Nothing was saved or executed.</p>
                    </div>
                  </div>
                )}
                {submission?.kind === "error" && (
                  <div className="notice error" role="alert">
                    <strong>Validation did not pass.</strong>
                    <p>{submission.message}</p>
                  </div>
                )}
              </form>
              <div className="spec-footer">
                <Glyph name="lock" /> Synthetic input. No persistence. No execution.
              </div>
            </section>

            <aside className="intention-panel" aria-labelledby="intention-heading">
              <span className="eyebrow">SMALL STEPS. REAL SIGNAL.</span>
              <h3 id="intention-heading">
                Clarity before
                <br />
                <em>complexity.</em>
              </h3>
              <svg className="flow-illustration" viewBox="0 0 300 145" aria-hidden="true">
                <defs>
                  <linearGradient id="flow-light">
                    <stop stopColor="#a2c879" stopOpacity=".15" />
                    <stop offset=".7" stopColor="#dbff91" />
                    <stop offset="1" stopColor="#a2c879" stopOpacity=".2" />
                  </linearGradient>
                </defs>
                <g fill="none" stroke="url(#flow-light)" strokeWidth="1">
                  <path d="M12 22h48q24 0 34 22l9 20q7 13 28 13h155M12 77h274M12 132h48q24 0 34-22l9-20q7-13 28-13h155" />
                  <circle cx="161" cy="77" r="32" stroke="#6e8a55" />
                  <circle cx="161" cy="77" r="41" opacity=".4" />
                </g>
                <circle cx="161" cy="77" r="23" fill="#283522" />
                <path d="m151 77 6 6 14-14" fill="none" stroke="#d5f4ae" strokeWidth="1.5" />
                <g fill="#d6f4ac">
                  <circle cx="13" cy="22" r="2" />
                  <circle cx="13" cy="77" r="2" />
                  <circle cx="13" cy="132" r="2" />
                  <circle cx="286" cy="77" r="2" />
                </g>
              </svg>
              <ol className="intention-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>Put it into words.</strong>
                    <p>A title. Clear acceptance criteria.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Check the shape.</strong>
                    <p>Real input validation. Honest feedback.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Keep the next move yours.</strong>
                    <p>Nothing runs, saves, or merges.</p>
                  </div>
                </li>
              </ol>
              <p className="intention-footnote">
                We validate structure, not feasibility.
                <br />
                Your input stays in this local stack.
              </p>
            </aside>
          </div>
        </section>

        <section
          className="roadmap-section section-width"
          id="roadmap"
          aria-labelledby="roadmap-heading"
        >
          <div className="roadmap-heading">
            <p className="eyebrow">
              <span className="section-number">03</span> BUILT WITH INTENTION
            </p>
            <h2 id="roadmap-heading">
              A foundation. <em>Not a finish line.</em>
            </h2>
          </div>
          <ol className="roadmap">
            <li className="roadmap-current">
              <div>
                <span className="roadmap-number">01</span>
                <span className="phase-badge">YOU ARE HERE</span>
              </div>
              <h3>The foundation</h3>
              <p>Health checks, persistence, and a safe place to validate ideas.</p>
              <span className="phase-state">
                <span className="status-dot" /> Working locally
              </span>
            </li>
            <li>
              <div>
                <span className="roadmap-number">02</span>
                <Glyph name="lock" />
              </div>
              <h3>A common language</h3>
              <p>Domain contracts, permissions, and intentional state changes.</p>
              <span className="phase-state">Planned / not implemented</span>
            </li>
            <li>
              <div>
                <span className="roadmap-number">03+</span>
                <Glyph name="lock" />
              </div>
              <h3>Better, together</h3>
              <p>Dependency-aware plans, isolated agents, and human approval.</p>
              <span className="phase-state">Planned / not implemented</span>
            </li>
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <div className="section-width footer-top">
          <a className="brand" href="#top" aria-label="LightSprint back to top">
            <BrandMark />
            <span>lightsprint.</span>
          </a>
          <p>
            Less friction. <em>More possibility.</em>
          </p>
          <a className="back-top" href="#top">
            Back to top <Glyph name="diagonal" />
          </a>
        </div>
        <div className="section-width footer-bottom">
          <span>Independent prototype. Not affiliated with LightSprint.</span>
          <span>Made for local exploration. Not production-ready.</span>
        </div>
      </footer>
    </div>
  );
}
