import { afterEach, describe, expect, it, vi } from "vitest";
import { getSystemStatus, validateSpecification } from "./client";

afterEach(() => vi.unstubAllGlobals());

function mockResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("HTTP boundary", () => {
  it("rejects healthy-looking responses without the expected database contract", async () => {
    mockResponse({ status: "ready", schemaVersion: 1 });
    await expect(getSystemStatus()).rejects.toThrow("No healthy state was assumed");
  });

  it("forwards validation input and accepts only a validation-only result", async () => {
    const fetchMock = mockResponse({ valid: true, mode: "validation-only", criterionCount: 1 });
    const input = { title: "Synthetic", acceptanceCriteria: ["Status is visible"] };
    await expect(validateSpecification(input)).resolves.toEqual({
      valid: true,
      mode: "validation-only",
      criterionCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/intake/validate",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });

  it("surfaces backend field errors rather than returning success", async () => {
    mockResponse(
      {
        detail: "Correct the highlighted request fields.",
        errors: [{ field: "acceptanceCriteria", message: "size must be between 0 and 10" }],
      },
      400,
    );
    await expect(
      validateSpecification({ title: "Synthetic", acceptanceCriteria: [] }),
    ).rejects.toThrow("acceptanceCriteria: size must be between 0 and 10");
  });

  it("rejects HTML proxy failures with the HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Unavailable</html>", { status: 502 })),
    );
    await expect(getSystemStatus()).rejects.toThrow("unreadable response (HTTP 502)");
  });

  it("does not turn a network error into a ready state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(getSystemStatus()).rejects.toThrow("Failed to fetch");
  });

  it.each([0, 11, 1.5])("rejects invalid criterion counts: %s", async (criterionCount) => {
    mockResponse({ valid: true, mode: "validation-only", criterionCount });
    await expect(
      validateSpecification({ title: "Synthetic", acceptanceCriteria: ["x"] }),
    ).rejects.toThrow("Success was not assumed");
  });
});
