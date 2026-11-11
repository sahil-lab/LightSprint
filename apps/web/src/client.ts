export type SystemStatus = {
  application: "lightsprint";
  phase: 1;
  status: "ready";
  storage: "postgresql";
  schemaVersion: 1;
  mode: "validation-only";
};

export type SpecificationInput = {
  title: string;
  acceptanceCriteria: string[];
};

export type ValidationResult = {
  valid: true;
  mode: "validation-only";
  criterionCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function problemMessage(payload: unknown, status: number): string {
  if (!isRecord(payload) || typeof payload.detail !== "string") {
    return `The API request failed (HTTP ${status}). Try again shortly.`;
  }
  const fields = Array.isArray(payload.errors)
    ? payload.errors
        .filter(
          (error): error is { field: string; message: string } =>
            isRecord(error) && typeof error.field === "string" && typeof error.message === "string",
        )
        .map((error) => `${error.field}: ${error.message}`)
    : [];
  return [payload.detail, ...fields].join(" ");
}

async function requestJson(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(path, options);
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`The API returned an unreadable response (HTTP ${response.status}).`);
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(problemMessage(payload, response.status));
  }
  return payload;
}

export async function getSystemStatus(signal?: AbortSignal): Promise<SystemStatus> {
  const payload = await requestJson("/api/v1/system", signal ? { signal } : undefined);
  if (
    !isRecord(payload) ||
    payload.application !== "lightsprint" ||
    payload.phase !== 1 ||
    payload.status !== "ready" ||
    payload.storage !== "postgresql" ||
    payload.schemaVersion !== 1 ||
    payload.mode !== "validation-only"
  ) {
    throw new Error("The API returned an unexpected system status. No healthy state was assumed.");
  }
  return {
    application: payload.application,
    phase: payload.phase,
    status: payload.status,
    storage: payload.storage,
    schemaVersion: payload.schemaVersion,
    mode: payload.mode,
  };
}

export async function validateSpecification(input: SpecificationInput): Promise<ValidationResult> {
  const payload = await requestJson("/api/v1/intake/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (
    !isRecord(payload) ||
    payload.valid !== true ||
    payload.mode !== "validation-only" ||
    typeof payload.criterionCount !== "number" ||
    !Number.isInteger(payload.criterionCount) ||
    payload.criterionCount < 1 ||
    payload.criterionCount > 10
  ) {
    throw new Error("The API returned an unexpected validation result. Success was not assumed.");
  }
  return {
    valid: payload.valid,
    mode: payload.mode,
    criterionCount: payload.criterionCount,
  };
}
