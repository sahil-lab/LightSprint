import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";

type Point = { x: number; y: number; z: number };
type Face = { id: string; path: string; fill: string; depth: number; movement: Point };

function turn(point: Point): Point {
  const x = point.x * Math.cos(0.48) + point.z * Math.sin(0.48);
  const z = -point.x * Math.sin(0.48) + point.z * Math.cos(0.48);
  const y = point.y * Math.cos(0.62) - z * Math.sin(0.62);
  return {
    x: x * Math.cos(-0.5) - y * Math.sin(-0.5),
    y: x * Math.sin(-0.5) + y * Math.cos(-0.5),
    z: point.y * Math.sin(0.62) + z * Math.cos(0.62),
  };
}

function surface(angle: number, cross: number): Point {
  const twist = angle / 2 + 0.25;
  const radial =
    0.67 * Math.cos(cross) * Math.cos(twist) - 0.14 * Math.sin(cross) * Math.sin(twist);
  return turn({
    x: (1.44 + radial) * Math.cos(angle),
    y: (1.44 + radial) * Math.sin(angle),
    z: 0.67 * Math.cos(cross) * Math.sin(twist) + 0.14 * Math.sin(cross) * Math.cos(twist),
  });
}

function project(point: Point): string {
  return `${(360 + point.x * 150).toFixed(2)},${(325 - point.y * 150).toFixed(2)}`;
}

function makeSculpture(): Face[] {
  const faces: Face[] = [];
  const ribs = 56;
  const sides = 32;

  for (let rib = 0; rib < ribs; rib += 1) {
    const start = (rib / ribs) * Math.PI * 2;
    const end = start + (Math.PI * 2 * 0.74) / ribs;
    const movement = turn({
      x: Math.sin(rib * 2.399) * 0.44,
      y: Math.cos(rib * 1.73) * 0.44,
      z: Math.sin(rib * 1.31) * 0.8,
    });
    for (let side = 0; side < sides; side += 1) {
      const cross = (side / sides) * Math.PI * 2;
      const next = ((side + 1) / sides) * Math.PI * 2;
      const a = surface(start, cross);
      const b = surface(end, cross);
      const c = surface(end, next);
      const d = surface(start, next);
      const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const v = { x: d.x - a.x, y: d.y - a.y, z: d.z - a.z };
      const normal = {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x,
      };
      const length = Math.hypot(normal.x, normal.y, normal.z);
      const diffuse = Math.max(0, (normal.x * -0.3 + normal.y * 0.6 + normal.z * 0.74) / length);
      const specular = Math.pow(
        Math.max(0, (normal.x * -0.43 + normal.y * 0.22 + normal.z * 0.876) / length),
        14,
      );
      const innerLight = Math.pow(Math.max(0, -Math.cos(cross)), 3) * 0.32;
      const red = Math.min(255, Math.round(22 + diffuse * 148 + specular * 196 + innerLight * 110));
      const green = Math.min(
        255,
        Math.round(32 + diffuse * 171 + specular * 170 + innerLight * 160),
      );
      const blue = Math.min(255, Math.round(31 + diffuse * 144 + specular * 194 + innerLight * 35));
      faces.push({
        id: `${rib}-${side}`,
        path: `M${project(a)}L${project(b)}L${project(c)}L${project(d)}Z`,
        fill: `rgb(${red},${green},${blue})`,
        depth: (a.z + b.z + c.z + d.z) / 4,
        movement,
      });
    }
  }

  // Painter's order preserves the depth of the folded ribs without a WebGL dependency.
  return faces.sort((left, right) => left.depth - right.depth);
}

const sculpture = makeSculpture();

export default memo(function LightSculpture() {
  const id = useId().replaceAll(":", "");
  const [aligned, setAligned] = useState(true);
  const [alignment, setAlignment] = useState(1);
  const alignmentRef = useRef(1);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const container = useRef<HTMLElement>(null);
  const pointerLayer = useRef<HTMLDivElement>(null);
  const faces = useMemo(
    () =>
      sculpture
        .map((face) => ({
          ...face,
          depth: face.depth + face.movement.z * (1 - alignment),
          transform: `translate(${(face.movement.x * 150 * (1 - alignment)).toFixed(2)} ${(-face.movement.y * 150 * (1 - alignment)).toFixed(2)})`,
        }))
        .sort((left, right) => left.depth - right.depth),
    [alignment],
  );
  const moving = !paused && !reducedMotion && inView && pageVisible;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setReducedMotion(preference.matches);
    const onVisibility = () => setPageVisible(!document.hidden);
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    if (container.current) observer.observe(container.current);
    return () => {
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const target = aligned ? 1 : 0;
    if (alignmentRef.current === target) return;
    if (!moving) {
      alignmentRef.current = target;
      setAlignment(target);
      return;
    }
    const from = alignmentRef.current;
    const started = performance.now();
    let frame = 0;
    let lastFrame = 0;
    const animate = (time: number) => {
      const progress = Math.min(1, (time - started) / 700);
      if (time - lastFrame >= 1000 / 30 || progress === 1) {
        const eased = 1 - Math.pow(1 - progress, 3);
        alignmentRef.current = from + (target - from) * eased;
        setAlignment(alignmentRef.current);
        lastFrame = time;
      }
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [aligned, moving]);

  function followPointer(event: PointerEvent<HTMLDivElement>) {
    if (!moving || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    pointerLayer.current?.style.setProperty("--turn-x", `${-y * 12}deg`);
    pointerLayer.current?.style.setProperty("--turn-y", `${x * 12}deg`);
  }

  function resetPointer() {
    pointerLayer.current?.style.setProperty("--turn-x", "0deg");
    pointerLayer.current?.style.setProperty("--turn-y", "0deg");
  }

  return (
    <figure
      className="light-study"
      ref={container}
      aria-label="Interactive light sculpture"
      data-alignment={aligned ? "aligned" : "scattered"}
      data-motion={moving ? "playing" : "paused"}
    >
      <div className="study-topline">
        <span>
          <span className="tiny-cross" aria-hidden="true" /> LIGHT STUDY / 001
        </span>
        <span className="study-state">{aligned ? "IN ALIGNMENT" : "IN EXPLORATION"}</span>
      </div>
      <div className="sculpture-stage" onPointerMove={followPointer} onPointerLeave={resetPointer}>
        <div className="sculpture-pointer" ref={pointerLayer}>
          <div className="sculpture-float">
            <svg className="sculpture" viewBox="0 0 720 650" aria-hidden="true" focusable="false">
              <defs>
                <radialGradient id={`${id}-halo`}>
                  <stop offset="0" stopColor="#a4ff68" stopOpacity="0.19" />
                  <stop offset="0.58" stopColor="#84bc58" stopOpacity="0.06" />
                  <stop offset="1" stopColor="#84bc58" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${id}-ray`} x1="0" x2="1" y1="1" y2="0">
                  <stop stopColor="#bfed7a" stopOpacity="0" />
                  <stop offset="0.35" stopColor="#d6ff8c" stopOpacity="0.8" />
                  <stop offset="0.65" stopColor="#e9ffc1" />
                  <stop offset="1" stopColor="#bfed7a" stopOpacity="0" />
                </linearGradient>
                <radialGradient id={`${id}-ground`}>
                  <stop stopColor="#afff72" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#afff72" stopOpacity="0" />
                </radialGradient>
                <filter id={`${id}-bloom`} x="-50%" y="-100%" width="200%" height="300%">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>
              <ellipse cx="360" cy="326" rx="345" ry="303" fill={`url(#${id}-halo)`} />
              <ellipse cx="368" cy="577" rx="209" ry="32" fill={`url(#${id}-ground)`} />
              <g fill="none" stroke="#81917a" strokeWidth="0.6" opacity="0.23">
                <ellipse cx="360" cy="332" rx="320" ry="141" transform="rotate(-26 360 332)" />
                <ellipse cx="360" cy="332" rx="296" ry="262" strokeDasharray="2 10" />
                <path d="M360 34v26M360 595v20M40 325h22M658 325h22" />
              </g>
              <g fill="none" stroke={`url(#${id}-ray)`}>
                <path
                  className="light-trail"
                  d="M-10 453C155 435 242 178 414 258S582 204 730 154"
                  strokeWidth="1.2"
                />
                <path
                  d="M-10 459C155 441 244 187 414 266S582 212 730 160"
                  strokeWidth="0.5"
                  opacity="0.45"
                />
                <path
                  d="M-10 453C155 435 242 178 414 258S582 204 730 154"
                  strokeWidth="4"
                  opacity="0.24"
                  filter={`url(#${id}-bloom)`}
                />
              </g>
              <g className="sculpture-mesh" strokeWidth="0.4" strokeLinejoin="round">
                {faces.map((face) => (
                  <path
                    key={face.id}
                    data-face={face.id}
                    d={face.path}
                    transform={face.transform}
                    fill={face.fill}
                    stroke={face.fill}
                  />
                ))}
              </g>
              <g fill="none" stroke={`url(#${id}-ray)`}>
                <path d="M54 549C201 630 623 348 678 227" strokeWidth="0.9" opacity="0.65" />
                <path
                  className="light-trail trail-two"
                  d="M54 549C201 630 623 348 678 227"
                  strokeWidth="1.8"
                />
              </g>
              <g fill="#e8ffc0">
                <circle cx="123" cy="500" r="2.2" />
                <circle cx="610" cy="216" r="2.2" />
                <circle cx="537" cy="492" r="1.5" />
              </g>
            </svg>
          </div>
        </div>
        <span className="study-annotation annotation-left" aria-hidden="true">
          56 ELEMENTS
          <br />
          ONE INTENTION
        </span>
        <span className="study-annotation annotation-right" aria-hidden="true">
          FORM FOLLOWS
          <br />
          ALIGNMENT
        </span>
      </div>
      <div className="study-controls">
        <div className="alignment-switch" role="group" aria-label="Sculpture alignment">
          <button type="button" aria-pressed={!aligned} onClick={() => setAligned(false)}>
            <span className="scatter-symbol" aria-hidden="true" /> Scatter
          </button>
          <button type="button" aria-pressed={aligned} onClick={() => setAligned(true)}>
            <span className="align-symbol" aria-hidden="true" /> Align
          </button>
        </div>
        <button
          className="motion-button"
          type="button"
          aria-label={
            reducedMotion
              ? "Sculpture motion disabled by reduced-motion preference"
              : paused
                ? "Play sculpture motion"
                : "Pause sculpture motion"
          }
          disabled={reducedMotion}
          onClick={() => {
            resetPointer();
            setPaused((value) => !value);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {paused || reducedMotion ? <path d="m5 3 7 5-7 5Z" /> : <path d="M5 3v10M11 3v10" />}
          </svg>
        </button>
      </div>
      <figcaption>
        <span>
          {reducedMotion
            ? "Reduced motion respected."
            : paused
              ? "Motion paused. Click to align."
              : "Move to explore. Click to align."}
        </span>
        Interactive concept, not an agent run.
      </figcaption>
    </figure>
  );
});
