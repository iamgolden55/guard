/**
 * Monitoring stub.
 *
 * The legacy frontend wired Sentry + PostHog here. The rewrite intentionally
 * drops both deps for now to keep the bundle lean during the rebuild; they
 * are re-enabled in a follow-up PR after Phase 9 cutover.
 *
 * The export surface is preserved so any code that imports `initMonitoring`
 * keeps compiling. To restore: install @sentry/react + posthog-js and replace
 * the bodies below with the legacy implementation.
 */

export async function initMonitoring(): Promise<void> {
  // no-op
}

export function captureException(_error: unknown): void {
  // no-op
}

export function captureMessage(_message: string): void {
  // no-op
}
