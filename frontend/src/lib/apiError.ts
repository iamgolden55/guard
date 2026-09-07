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
    data?: {
      message?: string;
      detail?: string;
      error?: string;
      code?: string;
    };
  };
};

/** The server's own message, or `fallback` if it did not give one. */
export function extractApiError(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape | undefined;
  return (
    e?.response?.data?.message ??
    e?.response?.data?.detail ??
    e?.response?.data?.error ??
    fallback
  );
}

/** The machine-readable reason, where the endpoint provides one. */
export function apiErrorCode(err: unknown): string | undefined {
  return (err as ApiErrorShape | undefined)?.response?.data?.code;
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
