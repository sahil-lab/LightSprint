import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { getSystemStatus, validateSpecification } from "./client";
import type { SystemStatus } from "./client";
import { Director } from "./experience/director";
import type { RenderPreference, RendererInfo } from "./experience/director";

type StackState =
  { kind: "loading" } | { kind: "ready"; value: SystemStatus } | { kind: "error"; message: string };

type Submission = { kind: "success"; count: number } | { kind: "error"; message: string } | null;

const MANIFESTO =
  "Parallel work needs more than speed. It needs a common language, clear boundaries, and a human who decides what happens next.";

const SCENES = [
  { href: "#top", label: "Swarm" },
  { href: "#idea", label: "Graph" },
  { href: "#playground", label: "Field" },
  { href: "#roadmap", label: "Sprint" },
] as const;

const BOUNDARIES = [
  "No agents",
  "No merges",
  "No secrets",
  "Synthetic only",
  "Human control",
  "Local loopback",
] as const;

const READOUT_ROWS = 10;

const glyphs = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  diagonal: "M7 17 17 7M8 7h9v9",
  refresh: "M19 10a7 7 0 1 0-1 7M19 4v6h-6",
  check: "m5 12 4 4L19 6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Z",
};

function Glyph({ name }: { name: keyof typeof glyphs }) {
  return (
    <svg
      className="glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
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
        d="M22 2.5 23.9 9l6.6 1.9-6.6 1.9L22 19.3l-1.9-6.5-6.6-1.9L20.1 9Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Splits text into per-character spans so the headline can rise letter by letter. */
function Split({ text, from }: { text: string; from: number }) {
  let index = from;
  return text.split(" ").map((word, position) => (
    <Fragment key={`${position}-${word}`}>
      {position > 0 ? " " : null}
      <span className="word">
        {Array.from(word).map((character) => {
          const order = index;
          index += 1;
          return (
            <span className="char" key={order} style={{ "--i": order } as CSSProperties}>
              {character}
            </span>
          );
        })}
      </span>
    </Fragment>
  ));
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected request failure occurred.";
}

/** `?render=still` forces still frames and `?render=live` keeps the animation running. */
function renderPreference(): RenderPreference {
  const value = new URLSearchParams(window.location.search).get("render");
  return value === "live" || value === "still" ? value : "auto";
}

export default function App() {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const directorRef = useRef<Director | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready">(reduced ? "ready" : "loading");
  const [loaderVisible, setLoaderVisible] = useState(!reduced);
  const [renderer, setRenderer] = useState<RendererInfo | null>(null);

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
  const manifestoWords = MANIFESTO.split(" ");

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const director = new Director({
      canvas,
      root,
      reducedMotion: reduced,
      render: renderPreference(),
      onRenderer: setRenderer,
    });
    directorRef.current = director;
    return () => {
      director.destroy();
      directorRef.current = null;
    };
  }, [reduced]);

  // The loader counts while fonts arrive, then hands over to the intro burst.
  useEffect(() => {
    if (reduced) {
      setPhase("ready");
      setLoaderVisible(false);
      directorRef.current?.reveal();
      return;
    }
    let frame = 0;
    let hideTimer = 0;
    let fontsReady = false;
    const started = performance.now();
    const fontTimeout = window.setTimeout(() => {
      fontsReady = true;
    }, 3000);
    void document.fonts.ready.then(() => {
      fontsReady = true;
    });
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 1300);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round((fontsReady ? 100 : 86) * eased);
      if (counterRef.current) counterRef.current.textContent = String(value).padStart(3, "0");
      if (progress >= 1 && fontsReady) {
        setPhase("ready");
        directorRef.current?.reveal();
        hideTimer = window.setTimeout(() => setLoaderVisible(false), 1300);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer);
      window.clearTimeout(fontTimeout);
    };
  }, [reduced]);

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

  // The scene dims when the stack is unreachable and answers each validation result.
  useEffect(() => {
    const health = stack.kind === "ready" ? 1 : stack.kind === "loading" ? 0.7 : 0.15;
    directorRef.current?.setHealth(health);
  }, [stack.kind, reduced]);

  useEffect(() => {
    const director = directorRef.current;
    if (!director) return;
    director.setAlert(submission?.kind === "error");
    if (submission?.kind === "success") director.pulse();
  }, [submission]);

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

  const particles = renderer?.mode === "webgl2" ? renderer.particles.toLocaleString("en-US") : "";
  const rendererLine =
    renderer === null
      ? "Preparing the scene"
      : renderer.mode === "static"
        ? "Static backdrop / WebGL2 unavailable"
        : `${renderer.live ? "Realtime" : "Still frames"} / ${particles} particles / WebGL2`;
  const sceneHint =
    renderer?.mode !== "webgl2"
      ? ""
      : renderer.live
        ? "Move your pointer. Scroll to transform."
        : "Scroll to change the scene.";

  return (
    <div className="site" id="top" ref={rootRef} data-phase={phase}>
      <canvas className="stage" ref={canvasRef} aria-hidden="true" />
      <div className="stage-still" aria-hidden="true" />
      {loaderVisible && (
        <div className="loader" aria-hidden="true">
          <div className="loader-row">
            <span className="brand">
              <BrandMark />
              lightsprint
            </span>
            <span className="tag">Local prototype</span>
          </div>
          <div className="loader-count">
            <span ref={counterRef}>000</span>
          </div>
          <div className="loader-row">
            <span className="tag">Gathering light</span>
            <span className="loader-bar" />
            <span className="tag">Many minds. One direction.</span>
          </div>
        </div>
      )}
      <div className="cursor" data-cursor-ring aria-hidden="true" />
      <div className="page-progress" aria-hidden="true" />
      <a className="skip-link" href="#playground">
        Skip to playground
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="LightSprint home">
          <BrandMark />
          lightsprint
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#idea">The idea</a>
          <a href="#playground">Playground</a>
          <a href="#roadmap">What&apos;s next</a>
        </nav>
        <a className="pill" href="#playground" data-magnetic>
          Open the playground <Glyph name="diagonal" />
        </a>
      </header>

      <nav className="rail" aria-label="Scenes">
        {SCENES.map((scene, index) => (
          <a
            key={scene.href}
            href={scene.href}
            data-index={index}
            aria-label={`Scene ${index + 1}: ${scene.label}`}
          >
            <span>{scene.label}</span>
          </a>
        ))}
      </nav>

      <main>
        <section className="hero" data-scene="0" data-hero aria-labelledby="page-heading">
          <div className="hero-inner">
            <div className="hero-top">
              <p className="tag rise">LS-01 / Light study, not an agent run</p>
              <p className="tag rise">{sceneHint}</p>
            </div>
            <div className="hero-body">
              <p className="eyebrow rise">
                <span className="status-dot" />A little less chaos. A lot more clarity.
              </p>
              <h1 id="page-heading" className="hero-title" aria-label="Many minds. One direction.">
                <span className="line" aria-hidden="true">
                  <Split text="Many minds." from={0} />
                </span>{" "}
                <span className="line" aria-hidden="true">
                  <Split text="One" from={10} />{" "}
                  <em>
                    <Split text="direction." from={13} />
                  </em>
                </span>
              </h1>
              <div className="hero-aside rise rise-late">
                <p className="hero-description">
                  Great things happen when everything comes together. A more intentional future for
                  parallel engineering, starting with a clear specification.
                </p>
                <div className="hero-actions">
                  <a className="button" href="#playground" data-magnetic>
                    Enter the playground
                    <span className="button-orb">
                      <Glyph name="arrow" />
                    </span>
                  </a>
                  <a className="text-link" href="#idea">
                    Meet the idea
                  </a>
                </div>
              </div>
            </div>
            <div className="hero-meta rise rise-late">
              <a className="scroll-cue" href="#idea">
                Scroll
                <span aria-hidden="true" />
              </a>
              <p className="tag renderer-line">{rendererLine}</p>
              <p className="tag">Local by design. Human by default.</p>
            </div>
          </div>
        </section>

        <section
          className="idea"
          id="idea"
          data-scene="1"
          data-pin
          tabIndex={-1}
          aria-labelledby="idea-heading"
        >
          <div className="idea-pin">
            <div className="idea-head">
              <span className="index">01</span>
              <h2 id="idea-heading">
                Not more noise. <em>A shared intention.</em>
              </h2>
            </div>
            <p
              className="manifesto"
              style={{ "--n": manifestoWords.length / 0.8 } as CSSProperties}
            >
              {manifestoWords.map((word, index) => (
                <Fragment key={`${index}-${word}`}>
                  <span className="w" style={{ "--i": index } as CSSProperties}>
                    {word}
                  </span>{" "}
                </Fragment>
              ))}
            </p>
            <div className="idea-foot">
              <p className="scope-note">
                That&apos;s the vision. Today, we&apos;re building the foundation.
              </p>
              <p className="tag">Fig. 01 / Dependency graph. Illustration, not a live plan.</p>
            </div>
          </div>
        </section>

        <section
          className="playground"
          id="playground"
          data-scene="2"
          tabIndex={-1}
          aria-labelledby="playground-heading"
        >
          <div className="section-head" data-reveal>
            <p className="index-line">
              <span className="index">02</span>The playground
            </p>
            <h2 id="playground-heading">
              A clear idea. <em>A good place to start.</em>
            </h2>
            <p className="section-lede">
              A small, working piece of the bigger picture. Try a synthetic specification and see
              what holds up.
            </p>
          </div>

          <section className="stack glass" data-glow data-reveal aria-labelledby="stack-heading">
            <div className="stack-head">
              <h3 id="stack-heading">
                <span className="status-dot" data-state={stack.kind} />
                Your local stack
              </h3>
              <span className="tag">Loopback only</span>
              <button
                className="link-button"
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
                <p className="stack-wait">Connecting to the API and PostgreSQL...</p>
              )}
              {stack.kind === "error" && (
                <div className="notice error" role="alert">
                  <div>
                    <strong>Cannot load stack status.</strong>
                    <p>{stack.message}</p>
                    <button
                      className="link-button"
                      type="button"
                      onClick={() => setRefresh((value) => value + 1)}
                    >
                      Retry connection <Glyph name="arrow" />
                    </button>
                  </div>
                </div>
              )}
              {stack.kind === "ready" && (
                <dl className="services">
                  <div>
                    <dt>API</dt>
                    <dd>Ready</dd>
                    <dd className="detail">Spring Boot / Java 21</dd>
                  </div>
                  <div>
                    <dt>Database</dt>
                    <dd>PostgreSQL connected</dd>
                    <dd className="detail">Private network / no host port</dd>
                  </div>
                  <div>
                    <dt>Migration</dt>
                    <dd>Schema version {stack.value.schemaVersion}</dd>
                    <dd className="detail">Read from persistent storage</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>Validation only</dd>
                    <dd className="detail">No agents or repository access</dd>
                  </div>
                </dl>
              )}
            </div>
          </section>

          <div className="console-grid">
            <section
              className="console glass"
              data-glow
              data-reveal
              aria-labelledby="intake-heading"
            >
              <div className="console-head">
                <span className="tag">/ 001</span>
                <h3 id="intake-heading">Specification sandbox</h3>
                <span className="badge">Dry run</span>
              </div>
              <form onSubmit={submit}>
                <fieldset disabled={submitting}>
                  <legend className="visually-hidden">Synthetic specification</legend>
                  <div className="field-row">
                    <label htmlFor="spec-title">Specification title</label>
                    <span className="count">{title.length} / 80</span>
                  </div>
                  <input
                    id="spec-title"
                    name="title"
                    value={title}
                    required
                    maxLength={80}
                    autoComplete="off"
                    placeholder="A clearer status dashboard"
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setSubmission(null);
                    }}
                  />
                  <div className="field-row">
                    <label htmlFor="spec-criteria">Acceptance criteria</label>
                    <span className="count" data-over={criteriaLines.length > 10}>
                      {criteriaLines.length} / 10
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
                    <button className="button" type="submit" data-magnetic>
                      {submitting ? "Validating..." : "Validate specification"}
                      <span className="button-orb">
                        <Glyph name="arrow" />
                      </span>
                    </button>
                    <button className="link-button" type="button" onClick={useExample}>
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
                    <div>
                      <strong>Validation did not pass.</strong>
                      <p>{submission.message}</p>
                    </div>
                  </div>
                )}
              </form>
              <p className="console-foot">
                <Glyph name="lock" />
                Synthetic input. No persistence. No execution.
              </p>
            </section>

            <aside
              className="readout glass"
              data-glow
              data-reveal
              aria-labelledby="readout-heading"
            >
              <div className="console-head">
                <span className="tag">/ 002</span>
                <h3 id="readout-heading">What will be checked</h3>
              </div>
              <dl className="readout-totals">
                <div>
                  <dt>Title</dt>
                  <dd>{title.trim().length} / 80</dd>
                </div>
                <div>
                  <dt>Criteria</dt>
                  <dd data-over={criteriaLines.length > 10}>{criteriaLines.length} / 10</dd>
                </div>
              </dl>
              {criteriaLines.length === 0 ? (
                <p className="readout-empty">
                  Each line you write becomes one criterion. They appear here as the validator will
                  receive them.
                </p>
              ) : (
                <ol className="readout-list">
                  {criteriaLines.slice(0, READOUT_ROWS).map((line, index) => (
                    <li key={`${index}-${line}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span>{line}</span>
                      <span data-over={line.length > 240}>{line.length}</span>
                    </li>
                  ))}
                </ol>
              )}
              {criteriaLines.length > READOUT_ROWS && (
                <p className="readout-more" data-over="true">
                  +{criteriaLines.length - READOUT_ROWS} more than the limit of 10
                </p>
              )}
              <p className="readout-note">
                We check structure, not feasibility. Your input stays in this local stack.
              </p>
            </aside>
          </div>

          <ol className="principles glass" data-glow data-reveal>
            <li>
              <span className="index">01</span>
              <strong>Put it into words.</strong>
              <p>A title. Clear acceptance criteria.</p>
            </li>
            <li>
              <span className="index">02</span>
              <strong>Check the shape.</strong>
              <p>Real input validation. Honest feedback.</p>
            </li>
            <li>
              <span className="index">03</span>
              <strong>Keep the next move yours.</strong>
              <p>Nothing runs, saves, or merges.</p>
            </li>
          </ol>
        </section>

        <section
          className="roadmap"
          id="roadmap"
          data-scene="3"
          tabIndex={-1}
          aria-labelledby="roadmap-heading"
        >
          <div className="section-head" data-reveal>
            <p className="index-line">
              <span className="index">03</span>Built with intention
            </p>
            <h2 id="roadmap-heading">
              A foundation. <em>Not a finish line.</em>
            </h2>
          </div>
          <ol className="phases">
            <li className="phase" data-current="true" data-glow data-reveal>
              <span className="phase-number">01</span>
              <h3>The foundation</h3>
              <p>Health checks, persistence, and a safe place to validate ideas.</p>
              <span className="phase-state">
                <span className="status-dot" />
                Working locally
              </span>
              <span className="badge">You are here</span>
            </li>
            <li className="phase" data-glow data-reveal>
              <span className="phase-number">02</span>
              <h3>A common language</h3>
              <p>Domain contracts, permissions, and intentional state changes.</p>
              <span className="phase-state">Planned / not implemented</span>
            </li>
            <li className="phase" data-glow data-reveal>
              <span className="phase-number">03+</span>
              <h3>Better, together</h3>
              <p>Dependency-aware plans, isolated agents, and human approval.</p>
              <span className="phase-state">Planned / not implemented</span>
            </li>
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <p key={copy}>
                {BOUNDARIES.map((boundary) => (
                  <span key={boundary}>{boundary}</span>
                ))}
              </p>
            ))}
          </div>
        </div>
        <div className="footer-row">
          <p>
            Less friction. <em>More possibility.</em>
          </p>
          <a className="pill" href="#top" data-magnetic>
            Back to top <Glyph name="diagonal" />
          </a>
        </div>
        <p className="wordmark" aria-hidden="true">
          lightsprint<span>.</span>
        </p>
        <div className="footer-legal">
          <span>Independent prototype. Not affiliated with LightSprint.</span>
          <span>Made for local exploration. Not production-ready.</span>
        </div>
      </footer>
    </div>
  );
}
