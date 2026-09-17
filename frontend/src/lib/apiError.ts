/**
 * Reading errors the API actually returns.
 *
 * Two pages had their own private copy of `extractApiError`, and neither knew
 * about 409. That mattered once the backend started returning one: an
 * attendance correction against an already-approved or exported invoice is
 * refused rather than silently skipped, and a scheduling write can now lose a
 * race to the shift overlap constraint. Both mean "somebody else got there
 * first, or the thing you are editing has moved on" — which is a refetch and a
 * specific message, not a generic failure toast.
 */

type ApiErrorShape = {
  response?: {
    status?: number;
    data?: unknown;
  };
};

function plainObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (typeof Blob !== "undefined" && data instanceof Blob) return null;
  return data as Record<string, unknown>;
}

function humaniseField(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The first message out of a DRF validation body.
 *
 * A serializer rejection is `{license_number: ["…"]}`, not `{detail}`, so
 * without this every field error read as the caller's generic fallback — the
 * operator was told the save failed but never why.
 */
function firstFieldError(data: unknown): string | undefined {
  if (Array.isArray(data)) {
    return typeof data[0] === "string" ? data[0] : undefined;
  }
  const body = plainObject(data);
  if (!body) return undefined;
  for (const [key, value] of Object.entries(body)) {
    if (key === "code" || !Array.isArray(value)) continue;
    const first = value.find((v): v is string => typeof v === "string");
    if (!first) continue;
    // DRF's stock messages ("This field is required.") don't name the field.
    if (/^This field\b/.test(first) && key !== "non_field_errors") {
      return `${humaniseField(key)}: ${first}`;
    }
    return first;
  }
  return undefined;
}

/** The server's own message, or `fallback` if it did not give one. */
export function extractApiError(err: unknown, fallback: string): string {
  const data = (err as ApiErrorShape | undefined)?.response?.data;
  const body = plainObject(data);
  if (body) {
    for (const key of ["message", "detail", "error"]) {
      const value = body[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return firstFieldError(data) ?? fallback;
}

/** The machine-readable reason, where the endpoint provides one. */
export function apiErrorCode(err: unknown): string | undefined {
  const code = plainObject(
    (err as ApiErrorShape | undefined)?.response?.data,
  )?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Did this fail because the underlying state changed?
 *
 * Distinct from a validation failure: retrying the same request unchanged will
 * fail the same way, so the useful response is to refetch and show the user
 * what is now true.
 */
export function isConflictError(err: unknown): boolean {
  return (err as ApiErrorShape | undefined)?.response?.status === 409;
}

/** A message worth showing for a conflict, preferring the server's own. */
export function conflictMessage(err: unknown, fallback: string): string {
  return extractApiError(err, fallback);
}
