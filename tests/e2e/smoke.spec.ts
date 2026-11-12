import { expect, test } from "@playwright/test";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:18205";

test("real browser validates a synthetic specification through web, API and PostgreSQL", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const readiness = await request.get(`${apiUrl}/actuator/health/readiness`);
  expect(readiness.status()).toBe(200);
  expect(await readiness.json()).toEqual({ status: "UP" });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Many minds. One direction.");
  await expect(page.getByText("PostgreSQL connected")).toBeVisible();
  await expect(page.getByText("Schema version 1")).toBeVisible();
  await page.getByRole("button", { name: "Use a synthetic example" }).click();
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
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: `${process.env.RESULTS_DIR ?? "results"}/dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
});

test("the UI displays a real server-side rejection of excessive criteria", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Specification title").fill("Synthetic invalid input");
  await page
    .getByLabel("Acceptance criteria")
    .fill(Array.from({ length: 11 }, (_, index) => `Synthetic criterion ${index + 1}`).join("\n"));
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

test("the mobile layout remains usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("PostgreSQL connected")).toBeVisible();
  await expect(page.getByLabel("Specification title")).toBeVisible();
  await expect(page.getByRole("button", { name: "Validate specification" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `${process.env.RESULTS_DIR ?? "results"}/mobile.png`,
    fullPage: true,
    animations: "disabled",
  });
});

test("the light sculpture rearranges and pauses without executing anything", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") writes.push(request.url());
  });
  await page.goto("/");
  const study = page.getByRole("figure", { name: "Interactive light sculpture" });
  const pointer = study.locator(".sculpture-pointer");
  const restingTransform = await pointer.evaluate((element) => getComputedStyle(element).transform);
  const stage = await study.locator(".sculpture-stage").boundingBox();
  if (!stage) throw new Error("The light study must have a visible interaction surface.");
  await page.mouse.move(stage.x + stage.width * 0.8, stage.y + stage.height * 0.25);
  await expect
    .poll(() => pointer.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(restingTransform);
  const face = study.locator('[data-face="4-3"]');
  const original = await face.getAttribute("transform");
  if (!original) throw new Error("The sculpture must render real geometry.");

  await study.getByRole("button", { name: "Scatter", exact: true }).click();
  await expect(study).toHaveAttribute("data-alignment", "scattered");
  await expect(face).not.toHaveAttribute("transform", original);
  await study.getByRole("button", { name: "Pause sculpture motion" }).click();
  await expect(study).toHaveAttribute("data-motion", "paused");
  await expect
    .poll(() =>
      study.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  await page.screenshot({
    path: `${process.env.RESULTS_DIR ?? "results"}/sculpture-scattered.png`,
    animations: "disabled",
  });

  await study.getByRole("button", { name: "Align", exact: true }).click();
  await expect(face).toHaveAttribute("transform", original);
  await expect(study.getByRole("button", { name: "Align", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await study.getByRole("button", { name: "Play sculpture motion" }).click();
  await expect(study).toHaveAttribute("data-motion", "playing");
  await page.getByRole("link", { name: "Enter the playground" }).click();
  await expect(study).toHaveAttribute("data-motion", "paused");
  expect(writes).toEqual([]);
});

test("reduced motion is static and keyboard navigation reaches the working form", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const study = page.getByRole("figure", { name: "Interactive light sculpture" });
  await expect(study).toHaveAttribute("data-motion", "paused");
  await expect(
    study.getByRole("button", { name: "Sculpture motion disabled by reduced-motion preference" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to playground" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#playground$/);
  const heading = await page
    .getByRole("heading", { name: "A clear idea. A good place to start." })
    .boundingBox();
  expect(heading?.y).toBeGreaterThanOrEqual(0);
  expect(heading?.y).toBeLessThan(400);
  const scatter = study.getByRole("button", { name: "Scatter", exact: true });
  await scatter.focus();
  await page.keyboard.press("Enter");
  await expect(study).toHaveAttribute("data-alignment", "scattered");
  await expect(study).toHaveAttribute("data-motion", "paused");
});

test("the sculpture, typography and controls fit small phones, tablets and desktop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByText("PostgreSQL connected")).toBeVisible();
    for (const selector of ["h1", "#spec-title", "#spec-criteria", ".study-controls"]) {
      const box = await page.locator(selector).boundingBox();
      if (!box) throw new Error(`${selector} must be rendered at ${viewport.width}px.`);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    const textFits = await page
      .locator("h1")
      .evaluate((element) => element.scrollWidth <= element.clientWidth);
    expect(textFits).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: `${process.env.RESULTS_DIR ?? "results"}/light-study-${viewport.width}.png`,
      animations: "disabled",
    });
  }
});
