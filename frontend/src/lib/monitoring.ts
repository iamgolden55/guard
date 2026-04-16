/**
 * Monitoring & Observability setup
 *
 * Initializes Sentry (error tracking) and PostHog (product analytics).
 * Both are opt-in via environment variables — if the DSN/key is empty,
 * the SDK is not loaded.
 */

export async function initMonitoring() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const posthogKey = import.meta.env.VITE_POSTHOG_API_KEY;

  // Sentry — error tracking & performance monitoring
  if (sentryDsn) {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
      ],
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event) {
        const frames = event.exception?.values?.[0]?.stacktrace?.frames;
        if (frames?.some((f) => f.filename?.includes("/_next-live/"))) {
          return null;
        }
        return event;
      },
    });
  }

  // PostHog — product analytics
  if (posthogKey) {
    const posthog = await import("posthog-js");
    posthog.default.init(posthogKey, {
      api_host:
        import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
    });
  }
}
