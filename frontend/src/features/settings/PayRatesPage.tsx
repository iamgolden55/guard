import { useEffect, useState } from "react";
import { Card, textStyles, tokens } from "../../design-system";
import { Button } from "../../design-system/primitives/Button";
import { Input } from "../../design-system/primitives/Input";
import { settingsService, type SystemSettings } from "../../services/settingsService";

function extractApiError(err: unknown, fallback: string): string {
  const e = err as
    | { response?: { data?: { message?: string; detail?: string; error?: string } } }
    | undefined;
  return (
    e?.response?.data?.message ??
    e?.response?.data?.detail ??
    e?.response?.data?.error ??
    fallback
  );
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export default function PayRatesPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [defaultRate, setDefaultRate] = useState<string>("");
  const [specialRate, setSpecialRate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    settingsService
      .getSettings()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setDefaultRate(toNumber(s.default_hourly_rate).toFixed(2));
        setSpecialRate(toNumber(s.special_event_pay_rate).toFixed(2));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(extractApiError(err, "Could not load pay-rate settings."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty =
    settings != null &&
    (toNumber(defaultRate) !== toNumber(settings.default_hourly_rate) ||
      toNumber(specialRate) !== toNumber(settings.special_event_pay_rate));

  const validate = (): string | null => {
    const d = toNumber(defaultRate);
    const s = toNumber(specialRate);
    if (d <= 0) return "Standard hourly rate must be greater than 0.";
    if (s <= 0) return "Special-event hourly rate must be greater than 0.";
    if (d > 1000 || s > 1000) return "Rate looks unusually high (>£1,000/hr) — please check.";
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await settingsService.updateSettings({
        default_hourly_rate: toNumber(defaultRate),
        special_event_pay_rate: toNumber(specialRate),
      });
      setSettings(updated);
      setDefaultRate(toNumber(updated.default_hourly_rate).toFixed(2));
      setSpecialRate(toNumber(updated.special_event_pay_rate).toFixed(2));
      setSuccess("Pay rates saved.");
    } catch (err) {
      setError(extractApiError(err, "Could not save pay rates."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 0" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...textStyles.over, color: tokens.color.ink500 }}>
          SETTINGS · ADMIN
        </div>
        <h1 style={{ ...textStyles.h1, marginTop: 4 }}>Pay rates</h1>
        <p style={{ ...textStyles.body, color: tokens.color.ink600, marginTop: 6 }}>
          Default hourly rates used when a shift or venue doesn't set its own.
          Per-venue and per-shift overrides still take precedence.
        </p>
      </div>

      <Card padding={28}>
        {loading ? (
          <div style={{ ...textStyles.body, color: tokens.color.ink500 }}>Loading…</div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                style={{
                  marginBottom: 16,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#fdecea",
                  color: "#8a1c13",
                  border: "1px solid #f5c2bd",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#e8f5ed",
                  color: "#10683a",
                  border: "1px solid #b8e0c5",
                  fontSize: 13,
                }}
              >
                {success}
              </div>
            )}

            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <label
                  htmlFor="default_hourly_rate"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.color.ink800,
                    marginBottom: 6,
                  }}
                >
                  Standard hourly rate (£)
                </label>
                <Input
                  id="default_hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(e.target.value)}
                  disabled={saving}
                  wrapperStyle={{ maxWidth: 220 }}
                />
                <div style={{ fontSize: 12, color: tokens.color.ink500, marginTop: 4 }}>
                  Applied to regular shifts when no override is set.
                </div>
              </div>

              <div>
                <label
                  htmlFor="special_event_pay_rate"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.color.ink800,
                    marginBottom: 6,
                  }}
                >
                  Special-event hourly rate (£)
                </label>
                <Input
                  id="special_event_pay_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={specialRate}
                  onChange={(e) => setSpecialRate(e.target.value)}
                  disabled={saving}
                  wrapperStyle={{ maxWidth: 220 }}
                />
                <div style={{ fontSize: 12, color: tokens.color.ink500, marginTop: 4 }}>
                  Applied to shifts marked as special events.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <Button
                onClick={handleSave}
                disabled={!dirty || saving}
                variant="primary"
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {dirty && !saving && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!settings) return;
                    setDefaultRate(toNumber(settings.default_hourly_rate).toFixed(2));
                    setSpecialRate(toNumber(settings.special_event_pay_rate).toFixed(2));
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Discard
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
