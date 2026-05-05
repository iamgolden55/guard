// ConnectFinanceFlow — initiates OAuth for an accounting provider.
// On Connect: calls /finance/oauth/initiate/, then redirects the user to the
// returned `oauth_url`. Backend stores `state` server-side; the callback
// route (/admin/finance-integrations/oauth-callback) finishes the handshake
// and routes back to /integrations.
import { useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import financeIntegrationsService from "../../../services/financeIntegrationsService";
import type { CatalogItem } from "../data/catalog";

export interface ConnectFinanceFlowProps {
  item: CatalogItem;
  onError: (message: string) => void;
}

export function ConnectFinanceFlow({ item, onError }: ConnectFinanceFlowProps) {
  const [sandbox, setSandbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConnect = async () => {
    if (!item.providerKey) return;
    setSubmitting(true);
    try {
      const redirectUri = financeIntegrationsService.generateOAuthRedirectUri();
      const { oauth_url } = await financeIntegrationsService.initiateOAuth({
        provider_key: item.providerKey,
        redirect_uri: redirectUri,
        is_sandbox: sandbox,
      });
      // Persist the provider so the callback route can resume the flow.
      sessionStorage.setItem(
        "integrations:pending",
        JSON.stringify({
          providerKey: item.providerKey,
          isSandbox: sandbox,
          startedAt: Date.now(),
        }),
      );
      window.location.href = oauth_url;
    } catch (e) {
      setSubmitting(false);
      onError(
        e instanceof Error
          ? e.message
          : "Couldn't start OAuth. Please try again.",
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <InfoStrip
        title="What happens next"
        body="You'll be redirected to sign in with your accounting provider. After approval, we'll bring you back to this page automatically."
      />

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          cursor: "pointer",
          padding: "10px 12px",
          background: tokens.color.ink50,
          border: `1px solid ${tokens.color.ink100}`,
          borderRadius: tokens.radius.md,
        }}
      >
        <input
          type="checkbox"
          checked={sandbox}
          onChange={(e) => setSandbox(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          <span
            style={{
              display: "block",
              fontFamily: tokens.font.display,
              fontWeight: 600,
              fontSize: 13,
              color: tokens.color.ink900,
            }}
          >
            Use sandbox / test environment
          </span>
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: tokens.color.ink600,
              marginTop: 2,
            }}
          >
            Recommended while testing the integration. No live data is
            modified.
          </span>
        </span>
      </label>

      <Button
        variant="primary"
        onClick={handleConnect}
        disabled={submitting}
        leading={<Icon name="external" size={14} />}
      >
        {submitting ? "Redirecting…" : `Connect ${item.name}`}
      </Button>
    </div>
  );
}

function InfoStrip({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: tokens.color.infoSoft,
        border: `1px solid ${tokens.color.info}30`,
        borderRadius: tokens.radius.lg,
        padding: 14,
        display: "flex",
        gap: 10,
      }}
    >
      <Icon name="info" size={14} />
      <div>
        <div
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 12,
            color: tokens.color.infoInk,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.infoInk,
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}
