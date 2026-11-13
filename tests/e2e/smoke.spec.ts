import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:18205";
const results = process.env.RESULTS_DIR ?? "results";
const GL_PROBLEM = /GL_INVALID|INVALID_(ENUM|VALUE|OPERATION|FRAMEBUFFER_OPERATION)|GL ERROR/i;
// The software renderer used in this suite cannot hold a frame rate, so tests that need
// the animation loop keep it running and tests of the fallback force still frames.
const LIVE = "/?render=live";
const STILL = "/?render=still";

type Sample = { peak: number; lit: number; red: number; grid: number[] };

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || GL_PROBLEM.test(message.text())) {
      problems.push(message.text());
    }
  });
  return problems;
}

async function openReady(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await expect(page.locator(".site")).toHaveAttribute("data-renderer", "webgl2");
  await expect(page.locator(".site")).toHaveAttribute("data-phase", "ready");
}

/**
 * Copies the WebGL canvas in the same frame it was drawn, before the browser clears it,
 * and reduces it to its brightest value, its lit fraction, the share of lit pixels that
 * are red, and a 16x9 brightness grid.
 * `redraw` asks a page showing still frames to draw the current one again first.
 */
async function sampleStage(page: Page, redraw = false): Promise<Sample> {
  return page.evaluate(
    (forceRedraw) =>
      new Promise<Sample>((resolve, reject) => {
        if (forceRedraw) window.dispatchEvent(new Event("resize"));
        requestAnimationFrame(() => {
          const source = document.querySelector<HTMLCanvasElement>("canvas.stage");
          const probe = document.createElement("canvas");
          const context = probe.getContext("2d");
          if (!source || !context || source.width < 16) {
            reject(new Error("The stage canvas is not ready."));
            return;
          }
          probe.width = source.width;
          probe.height = source.height;
          context.drawImage(source, 0, 0);
          const { data, width, height } = context.getImageData(0, 0, probe.width, probe.height);
          const sums = new Array<number>(144).fill(0);
          const counts = new Array<number>(144).fill(0);
          let peak = 0;
          let lit = 0;
          let red = 0;
          for (let y = 0; y < height; y += 1) {
            const row = Math.min(8, Math.floor((y / height) * 9));
            for (let x = 0; x < width; x += 1) {
              const offset = (y * width + x) * 4;
              const r = data[offset] ?? 0;
              const g = data[offset + 1] ?? 0;
              const value = Math.max(r, g, data[offset + 2] ?? 0);
              const cell = row * 16 + Math.min(15, Math.floor((x / width) * 16));
              sums[cell] = (sums[cell] ?? 0) + value;
              counts[cell] = (counts[cell] ?? 0) + 1;
              if (value > peak) peak = value;
              if (value > 56) {
                lit += 1;
                if (r > g * 1.25) red += 1;
              }
            }
          }
          resolve({
            peak,
            lit: lit / (width * height),
            red: red / Math.max(1, lit),
            grid: sums.map((sum, index) => Math.round((sum / (counts[index] ?? 1)) * 10) / 10),
          });
        });
      }),
    redraw,
  );
}

function difference(a: Sample, b: Sample): number {
  return a.grid.reduce((total, value, index) => total + Math.abs(value - (b.grid[index] ?? 0)), 0);
}

/** Mean brightness of a disc of the stage, given in CSS pixels, in a freshly drawn frame. */
async function discBrightness(page: Page, x: number, y: number, radius: number): Promise<number> {
  return page.evaluate(
    ([centerX, centerY, r]) =>
      new Promise<number>((resolve, reject) => {
        requestAnimationFrame(() => {
          const source = document.querySelector<HTMLCanvasElement>("canvas.stage");
          const probe = document.createElement("canvas");
          const context = probe.getContext("2d");
          if (!source || !context || source.width < 16) {
            reject(new Error("The stage canvas is not ready."));
            return;
          }
          probe.width = source.width;
          probe.height = source.height;
          context.drawImage(source, 0, 0);
          const scale = source.width / window.innerWidth;
          const size = Math.max(2, Math.round(r * 2 * scale));
          const { data } = context.getImageData(
            Math.round((centerX - r) * scale),
            Math.round((centerY - r) * scale),
            size,
            size,
          );
          let sum = 0;
          let count = 0;
          for (let py = 0; py < size; py += 1) {
            for (let px = 0; px < size; px += 1) {
              const dx = px - size / 2;
              const dy = py - size / 2;
              if (dx * dx + dy * dy > (size * size) / 4) continue;
              const offset = (py * size + px) * 4;
              sum += Math.max(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0);
              count += 1;
            }
          }
          resolve(sum / Math.max(1, count));
        });
      }),
    [x, y, radius] as const,
  );
}

const activeScene = (page: Page) => page.locator(".site").getAttribute("data-active-scene");
const scrollTop = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const lastWordOpacity = (page: Page) =>
  page
    .locator(".manifesto .w")
    .last()
    .evaluate((word) => Number(getComputedStyle(word).opacity));

async function recordWheelHandling(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.addEventListener("wheel", (event) => {
      document.documentElement.dataset.wheelPrevented = String(event.defaultPrevented);
    });
  });
}

async function pinnedSection(page: Page): Promise<{ top: number; distance: number }> {
  return page.evaluate(() => {
    const section = document.querySelector<HTMLElement>("[data-pin]");
    if (!section) throw new Error("The pinned section is missing.");
    return {
      top: Math.round(section.getBoundingClientRect().top + window.scrollY),
      distance: Math.round(section.offsetHeight - window.innerHeight),
    };
  });
}

test("real browser validates a synthetic specification through web, API and PostgreSQL", async ({
  page,
  request,
}) => {
  const problems = collectProblems(page);
  const readiness = await request.get(`${apiUrl}/actuator/health/readiness`);
  expect(readiness.status()).toBe(200);
  expect(await readiness.json()).toEqual({ status: "UP" });

  await openReady(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Many minds. One direction.");
  await expect(page.getByText("PostgreSQL connected")).toBeVisible();
  await expect(page.getByText("Schema version 1")).toBeVisible();
  await page.getByRole("button", { name: "Use a synthetic example" }).click();
  await expect(page.locator(".readout-list li")).toHaveCount(2);
  const validation = page.waitForResponse("**/api/v1/intake/validate");
  await page.getByRole("button", { name: "Validate specification" }).click();
  const response = await validation;
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    valid: true,
    mode: "validation-only",
    criterionCount: 2,
  });
  await expect(page.getByRole("status")).toContainText("Validated 2 acceptance criteria.");
  await expect(page.getByRole("status")).toContainText("Nothing was saved or executed.");
  expect(problems).toEqual([]);
  await page.screenshot({ path: `${results}/validated.png`, animations: "disabled" });
});

test("the UI displays a real server-side rejection of excessive criteria", async ({ page }) => {
  await openReady(page);
  await page.getByLabel("Specification title").fill("Synthetic invalid input");
  await page
    .getByLabel("Acceptance criteria")
    .fill(Array.from({ length: 11 }, (_, index) => `Synthetic criterion ${index + 1}`).join("\n"));
  await expect(page.locator(".readout-more")).toContainText("+1 more than the limit of 10");
  await page.getByRole("button", { name: "Validate specification" }).click();
  await expect(page.getByRole("alert")).toContainText("Validation did not pass.");
  await expect(page.getByRole("alert")).toContainText("acceptanceCriteria");
  await expect(page.getByText("Nothing was saved or executed.")).toHaveCount(0);
});

test("malformed, unknown and wrongly typed JSON receive sanitized errors", async ({ request }) => {
  for (const data of [
    "{",
    { title: "Synthetic", acceptanceCriteria: ["x"], unexpected: "DO-NOT-ECHO" },
    { title: 123, acceptanceCriteria: ["x"] },
    { title: "Synthetic", acceptanceCriteria: [true] },
  ]) {
    const response = await request.post("/api/v1/intake/validate", {
      data,
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
    expect(response.headers()["content-type"]).toContain("application/problem+json");
    const body = await response.json();
    expect(body.title).toBe("Invalid JSON request");
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(body)).not.toContain("DO-NOT-ECHO");
    expect(body).not.toHaveProperty("trace");
  }
});

test("a network failure is visible and retry reconnects to the real API", async ({ page }) => {
  await page.route("**/api/v1/system", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Cannot load stack status.");
  await expect(page.getByText("PostgreSQL connected")).toHaveCount(0);
  await page.unroute("**/api/v1/system");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(page.getByText("PostgreSQL connected")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("browser headers and absent future routes preserve Phase 1 boundaries", async ({
  request,
}) => {
  const root = await request.get("/");
  expect(root.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(root.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(root.headers()["x-content-type-options"]).toBe("nosniff");
  expect(root.headers()["referrer-policy"]).toBe("no-referrer");
  for (const path of ["/projects", "/plans", "/tasks/synthetic/run", "/merges"]) {
    expect((await request.post(`${apiUrl}${path}`, { data: {} })).status()).toBe(404);
  }
  expect((await request.get(`${apiUrl}/actuator/env`)).status()).toBe(404);
  const cors = await request.fetch(`${apiUrl}/api/v1/intake/validate`, {
    method: "OPTIONS",
    headers: { Origin: "https://untrusted.invalid", "Access-Control-Request-Method": "POST" },
  });
  expect(cors.status()).toBe(403);
  expect(cors.headers()).not.toHaveProperty("access-control-allow-origin");
});

test("the live scene is drawn in real time and the page answers the pointer", async ({ page }) => {
  const problems = collectProblems(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await openReady(page, LIVE);
  const site = page.locator(".site");
  await expect(site).toHaveAttribute("data-loop", "live");
  await expect(page.getByText(/^Realtime \/ [\d,]+ particles \/ WebGL2$/i)).toBeVisible();
  await expect(page.getByText("Move your pointer. Scroll to transform.")).toBeVisible();
  await expect(page.locator(".loader")).toHaveCount(0);

  // The intro burst has spread the particles into the swarm: real pixels are lit.
  await expect
    .poll(async () => (await sampleStage(page)).lit, { timeout: 60_000 })
    .toBeGreaterThan(0.02);
  expect((await sampleStage(page)).peak).toBeGreaterThan(170);

  const button = page.getByRole("link", { name: "Enter the playground" });
  const box = await button.boundingBox();
  if (!box) throw new Error("The hero button must be rendered.");
  const pointer = { x: box.x + box.width * 0.8, y: box.y + box.height * 0.3 };
  await page.mouse.move(pointer.x, pointer.y, { steps: 4 });
  await expect(site).toHaveAttribute("data-cursor", "action");
  await expect
    .poll(() => button.evaluate((element) => element.style.getPropertyValue("--mx")))
    .toMatch(/^-?\d+(\.\d)?px$/);
  await expect
    .poll(async () => {
      const ring = await page.locator("[data-cursor-ring]").boundingBox();
      return ring ? Math.abs(ring.x + ring.width / 2 - pointer.x) : 999;
    })
    .toBeLessThan(6);

  await page.mouse.move(40, 300, { steps: 4 });
  await expect(site).toHaveAttribute("data-cursor", "idle");
  await expect
    .poll(() => button.evaluate((element) => element.style.getPropertyValue("--mx")))
    .toBe("");

  // The swarm opens around the pointer and closes again when the pointer leaves.
  // Its centre is used because it is always dense, whatever the spiral's rotation.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("The test needs a fixed viewport.");
  const core = { x: viewport.width * 0.65, y: viewport.height * 0.37 };
  const coreBrightness = () => discBrightness(page, core.x, core.y, 34);
  await page.mouse.move(30, viewport.height - 30);
  await page.waitForTimeout(8000);
  const rest = await coreBrightness();
  expect(rest).toBeGreaterThan(150);
  await page.mouse.move(core.x, core.y, { steps: 14 });
  await expect.poll(coreBrightness).toBeLessThan(rest * 0.7);
  await page.screenshot({ path: `${results}/scene-1-pointer.png`, animations: "disabled" });
  await page.mouse.move(30, viewport.height - 30, { steps: 4 });
  await expect.poll(coreBrightness).toBeGreaterThan(rest * 0.9);

  expect(writes).toEqual([]);
  expect(problems).toEqual([]);
  await page.screenshot({ path: `${results}/scene-1-swarm.png`, animations: "disabled" });
});

test("live scrolling glides, lights the manifesto, morphs the scene and ripples", async ({
  page,
}) => {
  const problems = collectProblems(page);
  await openReady(page, LIVE);
  await expect
    .poll(async () => (await sampleStage(page)).lit, { timeout: 60_000 })
    .toBeGreaterThan(0.02);
  const swarm = await sampleStage(page);
  expect(await activeScene(page)).toBe("0");

  // The wheel is taken over by the inertial scroller and lands exactly on its target.
  await recordWheelHandling(page);
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => scrollTop(page)).toBe(300);
  await expect(page.locator("html")).toHaveAttribute("data-wheel-prevented", "true");

  // The pinned manifesto is dim at the start of the section and fully lit at the end.
  await page.getByRole("link", { name: "The idea", exact: true }).click();
  await expect(page).toHaveURL(/#idea$/);
  const pin = await pinnedSection(page);
  expect(pin.distance).toBeGreaterThan(600);
  await expect.poll(() => scrollTop(page)).toBe(pin.top);
  await expect.poll(() => activeScene(page)).toBe("1");
  await expect.poll(() => lastWordOpacity(page)).toBeLessThan(0.3);
  await page.mouse.wheel(0, pin.distance);
  await expect.poll(() => scrollTop(page)).toBe(pin.top + pin.distance);
  await expect.poll(() => lastWordOpacity(page)).toBe(1);
  await expect(page.getByText("Today, we're building the foundation.")).toHaveCSS("opacity", "1");
  await page.waitForTimeout(4000);
  const graph = await sampleStage(page);
  await page.screenshot({ path: `${results}/scene-2-graph.png`, animations: "disabled" });

  await page.getByRole("link", { name: "Playground", exact: true }).click();
  await expect(page).toHaveURL(/#playground$/);
  await expect.poll(() => activeScene(page)).toBe("2");
  await expect(
    page.getByRole("heading", { name: "A clear idea. A good place to start." }),
  ).toBeInViewport();
  await page.waitForTimeout(4000);
  const field = await sampleStage(page);
  await page.screenshot({ path: `${results}/scene-3-field.png`, animations: "disabled" });

  // A successful validation sends a ripple of light across the field.
  await page.getByRole("button", { name: "Use a synthetic example" }).click();
  await page.getByRole("button", { name: "Validate specification" }).click();
  await expect
    .poll(async () => (await sampleStage(page)).lit / field.lit, {
      intervals: [0],
      timeout: 40_000,
    })
    .toBeGreaterThan(1.3);
  await expect(page.getByRole("status")).toContainText("Validated 2 acceptance criteria.");

  await page.getByRole("link", { name: "Scene 4: Sprint" }).click();
  await expect(page).toHaveURL(/#roadmap$/);
  await expect.poll(() => activeScene(page)).toBe("3");
  await page.waitForTimeout(4000);
  const sprint = await sampleStage(page);
  await page.screenshot({ path: `${results}/scene-4-sprint.png`, animations: "disabled" });

  // Each scene is a visibly different picture, not the same one behind new text.
  for (const [name, a, b] of [
    ["swarm to graph", swarm, graph],
    ["graph to field", graph, field],
    ["field to sprint", field, sprint],
  ] as const) {
    expect(difference(a, b), name).toBeGreaterThan(250);
  }
  for (const sample of [graph, field, sprint]) expect(sample.peak).toBeGreaterThan(120);
  expect(problems).toEqual([]);
});

test("a renderer too slow to animate shows still frames and scrolls natively", async ({ page }) => {
  const problems = collectProblems(page);
  await openReady(page, STILL);
  const site = page.locator(".site");
  await expect(site).toHaveAttribute("data-loop", "still");
  await expect(site).toHaveAttribute("data-motion", "on");
  await expect(page.getByText(/^Still frames \/ [\d,]+ particles \/ WebGL2$/i)).toBeVisible();
  await expect(page.getByText("Scroll to change the scene.")).toBeVisible();
  await expect(page.getByText("PostgreSQL connected")).toBeVisible();
  const swarm = await sampleStage(page, true);
  expect(swarm.peak).toBeGreaterThan(170);
  expect(swarm.lit).toBeGreaterThan(0.02);

  // The browser scrolls; the page does not take the wheel or the pointer.
  await recordWheelHandling(page);
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 200);
  await expect(page.locator("html")).toHaveAttribute("data-wheel-prevented", "false");
  await expect.poll(() => scrollTop(page)).toBe(200);
  await expect(site).not.toHaveAttribute("data-cursor", /.+/);

  // The pinned manifesto still follows the scroll position.
  const pin = await pinnedSection(page);
  await page.evaluate((top) => window.scrollTo(0, top), pin.top);
  await expect.poll(() => lastWordOpacity(page)).toBeLessThan(0.3);
  await page.evaluate((top) => window.scrollTo(0, top), pin.top + pin.distance);
  await expect.poll(() => lastWordOpacity(page)).toBe(1);
  await expect.poll(() => activeScene(page)).toBe("1");
  const graph = await sampleStage(page, true);

  // Anchors jump natively and every section gets its own still frame.
  await page.getByRole("link", { name: "Playground", exact: true }).click();
  await expect(page).toHaveURL(/#playground$/);
  await expect(
    page.getByRole("heading", { name: "A clear idea. A good place to start." }),
  ).toBeInViewport();
  await expect.poll(() => activeScene(page)).toBe("2");
  const field = await sampleStage(page, true);
  await page.getByRole("link", { name: "What's next", exact: true }).click();
  await expect(page).toHaveURL(/#roadmap$/);
  await expect.poll(() => activeScene(page)).toBe("3");
  const sprint = await sampleStage(page, true);
  expect(difference(swarm, graph)).toBeGreaterThan(250);
  expect(difference(graph, field)).toBeGreaterThan(250);
  expect(difference(field, sprint)).toBeGreaterThan(250);
  expect(problems).toEqual([]);
});

test("still frames dim while the stack is unreachable and turn red while a rejection shows", async ({
  page,
}) => {
  await openReady(page, STILL);
  const site = page.locator(".site");
  const lit = async () => (await sampleStage(page, true)).lit;
  const red = async () => (await sampleStage(page, true)).red;
  await expect(page.getByText("PostgreSQL connected")).toBeVisible();
  await page.getByRole("button", { name: "Refresh status" }).scrollIntoViewIfNeeded();
  await expect(site).toHaveAttribute("data-active-scene", "2");
  const healthy = await sampleStage(page, true);
  expect(healthy.lit).toBeGreaterThan(0.02);
  expect(healthy.red).toBeLessThan(0.2);

  await page.route("**/api/v1/system", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot load stack status.");
  await expect.poll(lit).toBeLessThan(healthy.lit * 0.5);
  await page.unroute("**/api/v1/system");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(page.getByText("PostgreSQL connected")).toBeVisible();
  await expect.poll(lit).toBeGreaterThan(healthy.lit * 0.8);

  await page.getByLabel("Specification title").fill("Synthetic invalid input");
  await page
    .getByLabel("Acceptance criteria")
    .fill(Array.from({ length: 11 }, (_, index) => `Synthetic criterion ${index + 1}`).join("\n"));
  await page.getByRole("button", { name: "Validate specification" }).click();
  await expect(page.getByRole("alert")).toContainText("Validation did not pass.");
  await expect.poll(red).toBeGreaterThan(0.5);
  await page.screenshot({ path: `${results}/rejected.png`, animations: "disabled" });

  // Editing the specification clears the notice and the tint with it.
  await page.getByLabel("Specification title").fill("Synthetic corrected input");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect.poll(red).toBeLessThan(0.2);
});

test("reduced motion shows whole still scenes and nothing animates", async ({ page }) => {
  const problems = collectProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReady(page);
  const site = page.locator(".site");
  await expect(site).toHaveAttribute("data-motion", "off");
  await expect(site).toHaveAttribute("data-loop", "still");
  await expect(page.locator(".loader")).toHaveCount(0);
  await expect(page.getByText(/^Still frames \/ [\d,]+ particles \/ WebGL2$/i)).toBeVisible();
  await expect(page.getByText("PostgreSQL connected")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  expect(await lastWordOpacity(page)).toBe(1);
  await expect(page.locator("[data-reveal]").first()).toHaveCSS("opacity", "1");

  // The same position always produces the same lit picture.
  const first = await sampleStage(page, true);
  await page.waitForTimeout(400);
  expect(first.peak).toBeGreaterThan(170);
  expect(first.lit).toBeGreaterThan(0.02);
  expect((await sampleStage(page, true)).grid).toEqual(first.grid);

  // Scrolling inside a section is native and does not move the scene at all.
  await recordWheelHandling(page);
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 240);
  await expect(page.locator("html")).toHaveAttribute("data-wheel-prevented", "false");
  await expect.poll(() => scrollTop(page)).toBe(240);
  expect((await sampleStage(page, true)).grid).toEqual(first.grid);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to playground" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#playground$/);
  await expect(
    page.getByRole("heading", { name: "A clear idea. A good place to start." }),
  ).toBeInViewport();
  await expect(site).toHaveAttribute("data-active-scene", "2");
  expect(difference(first, await sampleStage(page, true))).toBeGreaterThan(250);
  await expect(site).not.toHaveAttribute("data-cursor", /.+/);
  expect(problems).toEqual([]);
});

test("without WebGL2 the page says so, shows its static backdrop and still works", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(
      this: HTMLCanvasElement,
      ...parameters: Parameters<typeof original>
    ) {
      return parameters[0] === "webgl2" ? null : original.apply(this, parameters);
    } as typeof original;
  });
  await page.goto("/");
  const site = page.locator(".site");
  await expect(site).toHaveAttribute("data-renderer", "static");
  await expect(site).toHaveAttribute("data-phase", "ready");
  await expect(page.getByText("Static backdrop / WebGL2 unavailable")).toBeVisible();
  await expect(page.locator(".stage-still")).toBeVisible();
  await expect(page.locator("canvas.stage")).toBeHidden();
  expect(warnings.some((text) => text.includes("WebGL2 is not available"))).toBe(true);

  await page.getByRole("button", { name: "Use a synthetic example" }).click();
  await page.getByRole("button", { name: "Validate specification" }).click();
  await expect(page.getByRole("status")).toContainText("Validated 2 acceptance criteria.");
  await page.screenshot({ path: `${results}/static-backdrop.png`, animations: "disabled" });
});

test("the headline, scene and working form fit phones, tablets and desktops", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await openReady(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByText("PostgreSQL connected")).toBeVisible();

    // Both headline lines stay on one line each and inside the screen.
    const lines = await page.locator(".hero-title .line").evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          rows: box.height / Number.parseFloat(getComputedStyle(element).fontSize),
          left: box.left,
          right: box.right,
        };
      }),
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.rows, `headline wraps at ${viewport.width}px`).toBeLessThan(1.5);
      expect(line.left).toBeGreaterThanOrEqual(0);
      expect(line.right).toBeLessThanOrEqual(viewport.width);
    }
    for (const selector of ["#spec-title", "#spec-criteria", "form .button", ".readout"]) {
      const box = await page.locator(selector).boundingBox();
      if (!box) throw new Error(`${selector} must be rendered at ${viewport.width}px.`);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect((await sampleStage(page, true)).peak).toBeGreaterThan(120);
    await page.screenshot({
      path: `${results}/hero-${viewport.width}.png`,
      animations: "disabled",
    });
    await page.locator("#spec-title").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${results}/playground-${viewport.width}.png`,
      animations: "disabled",
    });
  }
});
