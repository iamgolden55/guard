// ConnectDeputyForm — Deputy uses an API key + endpoint URL, not OAuth.
// Saves both via PUT /deputy/config/, then triggers an initial status
// refresh.
import { useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Input } from "../../../design-system/primitives/Input";
import { tokens } from "../../../design-system/tokens";

export interface ConnectDeputyFormProps {
  /** Pre-fill values when editing an existing config */
  initialEndpoint?: string;
  /** Whether a config already exists (changes the CTA copy) */
  isUpdate: boolean;
  onSubmit: (data: {
    apiEndpoint: string;
    apiKey: string;
    isActive: boolean;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const FIELD_LABEL: React.CSSProperties = {
  display: "block",
  fontFamily: tokens.font.body,
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: tokens.color.ink500,
  marginBottom: 6,
};

export function ConnectDeputyForm({
  initialEndpoint,
  isUpdate,
  onSubmit,
  isSubmitting,
}: ConnectDeputyFormProps) {
  const [endpoint, setEndpoint] = useState(
    initialEndpoint ?? "https://yourcompany.deputy.com",
  );
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!endpoint.trim() || !apiKey.trim()) {
      setError("Both the endpoint URL and API key are required.");
      return;
    }
    try {
      await onSubmit({
        apiEndpoint: endpoint.trim(),
        apiKey: apiKey.trim(),
        isActive: true,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't save Deputy credentials. Check the URL and key.",
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label htmlFor="deputy-endpoint" style={FIELD_LABEL}>
          Deputy endpoint
        </label>
        <Input
          id="deputy-endpoint"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://yourcompany.deputy.com"
        />
        <div
          style={{
            fontSize: 11.5,
            color: tokens.color.ink500,
            marginTop: 6,
          }}
        >
          The base URL of your Deputy account. Find it in the Deputy admin
          panel under Setup → API.
        </div>
      </div>

      <div>
        <label htmlFor="deputy-key" style={FIELD_LABEL}>
          API key
        </label>
        <Input
          id="deputy-key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isUpdate ? "Leave blank to keep existing key" : "deputy-live-…"}
          type="password"
          autoComplete="off"
        />
        <div
          style={{
            fontSize: 11.5,
            color: tokens.color.ink500,
            marginTop: 6,
          }}
        >
          Generate a permanent token in Deputy under Setup → Integrations →
          API. Stored encrypted.
        </div>
      </div>

      {error && (
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.dangerInk,
            background: tokens.color.dangerSoft,
            border: `1px solid ${tokens.color.danger}40`,
            borderRadius: tokens.radius.md,
            padding: "8px 12px",
          }}
        >
          {error}
        </div>
      )}

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? "Saving…"
          : isUpdate
            ? "Update credentials"
            : "Save and connect"}
      </Button>
    </div>
  );
}
