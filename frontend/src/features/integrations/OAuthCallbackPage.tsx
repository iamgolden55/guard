// OAuthCallbackPage — completes the finance integration OAuth handshake.
//
// Flow:
//   1. Provider redirects here with `?code=<auth_code>&state=<csrf>`.
//   2. We pull `providerKey` + `isSandbox` out of sessionStorage (set by
//      ConnectFinanceFlow before redirect).
//   3. POST /finance/oauth/callback/ with the code and state. Backend
//      exchanges for tokens and creates a `ProviderConnection`.
//   4. Navigate back to /integrations with a success toast hint.
//
// The legacy redirect URI `/admin/finance-integrations/oauth-callback` is
// preserved so the backend's whitelisted redirect URIs keep working — we
// just route the path to this new component.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../../design-system/primitives/Card";
import { Button } from "../../design-system/primitives/Button";
import { Icon } from "../../design-system/Icon";
import { tokens } from "../../design-system/tokens";
import financeIntegrationsService from "../../services/financeIntegrationsService";

interface PendingOAuth {
  providerKey: string;
  isSandbox: boolean;
  startedAt: number;
}

function readPending(): PendingOAuth | null {
  const raw = sessionStorage.getItem("integrations:pending");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingOAuth;
    if (!parsed.providerKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const errParam = params.get("error");

    if (errParam) {
      setStatus("error");
      setError(`${errParam}${params.get("error_description") ? `: ${params.get("error_description")}` : ""}`);
      sessionStorage.removeItem("integrations:pending");
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setError("Missing authorization code from provider.");
      return;
    }

    const pending = readPending();
    if (!pending) {
      setStatus("error");
      setError(
        "We lost track of which provider you were connecting. Try the connect flow again from the catalog.",
      );
      return;
    }

    const redirectUri = financeIntegrationsService.generateOAuthRedirectUri();

    financeIntegrationsService
      .completeOAuth({
        provider_key: pending.providerKey,
        code,
        state,
        redirect_uri: redirectUri,
        is_sandbox: pending.isSandbox,
      })
      .then(() => {
        sessionStorage.removeItem("integrations:pending");
        setStatus("ok");
        // Brief pause so the user sees the success state before redirecting.
        const t = window.setTimeout(() => {
          navigate("/integrations?connected=1", { replace: true });
        }, 900);
        return () => window.clearTimeout(t);
      })
      .catch((e: unknown) => {
        sessionStorage.removeItem("integrations:pending");
        setStatus("error");
        setError(
          e instanceof Error
            ? e.message
            : "OAuth handshake failed. Please try again.",
        );
      });
  }, [params, navigate]);

  return (
    <main
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: 28,
        background: tokens.color.ink50,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Card padding={32} style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        {status === "working" && (
          <>
            <Spinner />
            <Title>Finishing connection…</Title>
            <Body>
              We're swapping your authorization code for an access token. This
              normally takes a couple of seconds.
            </Body>
          </>
        )}
        {status === "ok" && (
          <>
            <SuccessGlyph />
            <Title>Connected</Title>
            <Body>Redirecting you back to Integrations…</Body>
          </>
        )}
        {status === "error" && (
          <>
            <ErrorGlyph />
            <Title>Couldn't complete the connection</Title>
            <Body>{error}</Body>
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => navigate("/integrations")}>
                Back to Integrations
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: tokens.font.display,
        fontWeight: 700,
        fontSize: 18,
        color: tokens.color.ink900,
        marginTop: 14,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: tokens.font.body,
        fontSize: 13,
        color: tokens.color.ink600,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        margin: "0 auto",
        borderRadius: 22,
        border: `3px solid ${tokens.color.ink200}`,
        borderTopColor: tokens.color.ink800,
        animation: "spin 0.9s linear infinite",
      }}
    >
      <style>
        {"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}
      </style>
    </div>
  );
}

function SuccessGlyph() {
  return (
    <div
      style={{
        width: 52,
        height: 52,
        margin: "0 auto",
        borderRadius: 26,
        background: tokens.color.successSoft,
        color: tokens.color.successInk,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Icon name="check" size={24} />
    </div>
  );
}

function ErrorGlyph() {
  return (
    <div
      style={{
        width: 52,
        height: 52,
        margin: "0 auto",
        borderRadius: 26,
        background: tokens.color.dangerSoft,
        color: tokens.color.dangerInk,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Icon name="shield-x" size={24} />
    </div>
  );
}
