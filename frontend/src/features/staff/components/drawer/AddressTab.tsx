import { useEffect, useState } from "react";
import { Button } from "../../../../design-system/primitives/Button";
import { Icon } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import type { StaffAddressRecord } from "../../hooks/useStaffData";

export interface AddressTabProps {
  address: StaffAddressRecord | null;
  isLoading: boolean;
  staffProfileId: number | null;
  onSave?: (
    staffProfileId: number,
    data: Partial<StaffAddressRecord>,
  ) => Promise<void>;
  isSaving: boolean;
}

const FIELDS: { key: keyof StaffAddressRecord; label: string }[] = [
  { key: "street", label: "Street" },
  { key: "city", label: "City" },
  { key: "postal_code", label: "Postal code" },
  { key: "country", label: "Country" },
];

const EMPTY: StaffAddressRecord = {
  street: "",
  city: "",
  postal_code: "",
  country: "",
};

function emptyState(title: string, body: string) {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
        background: tokens.color.ink50,
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.lg,
        color: tokens.color.ink600,
        fontFamily: tokens.font.body,
        fontSize: 13,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          margin: "0 auto 10px",
          borderRadius: 18,
          background: "white",
          display: "grid",
          placeItems: "center",
          color: tokens.color.ink500,
        }}
      >
        <Icon name="map-pin" size={16} />
      </div>
      <div style={{ fontWeight: 600, color: tokens.color.ink800, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ color: tokens.color.ink500 }}>{body}</div>
    </div>
  );
}

const labelStyle = {
  color: tokens.color.ink500,
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.09em",
};

const inputStyle = {
  height: 34,
  width: "100%",
  padding: "0 10px",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: tokens.radius.md,
  background: "white",
  fontFamily: tokens.font.body,
  fontSize: 13,
  color: tokens.color.ink900,
  marginTop: 4,
  boxSizing: "border-box" as const,
};

export function AddressTab({
  address,
  isLoading,
  staffProfileId,
  onSave,
  isSaving,
}: AddressTabProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<StaffAddressRecord>(address ?? EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(address ?? EMPTY);
    setEditing(false);
    setError(null);
  }, [address, staffProfileId]);

  if (isLoading) {
    return (
      <div
        style={{
          padding: "30px 0",
          textAlign: "center",
          color: tokens.color.ink500,
          fontFamily: tokens.font.body,
          fontSize: 13,
        }}
      >
        Loading address…
      </div>
    );
  }

  if (!address && !editing) {
    return emptyState(
      "Address not available",
      "We couldn't load the staff member's address.",
    );
  }

  const isEmpty = FIELDS.every((f) => !(address?.[f.key] ?? "").trim());
  const isDirty =
    address &&
    FIELDS.some((f) => (form[f.key] ?? "") !== (address[f.key] ?? ""));

  const handleSave = async () => {
    if (!onSave || !staffProfileId) return;
    setError(null);
    try {
      const changed: Partial<StaffAddressRecord> = {};
      for (const f of FIELDS) {
        if ((form[f.key] ?? "") !== (address?.[f.key] ?? "")) {
          changed[f.key] = form[f.key];
        }
      }
      await onSave(staffProfileId, changed);
      setEditing(false);
    } catch {
      setError("Couldn't save address. Try again.");
    }
  };

  const handleCancel = () => {
    setForm(address ?? EMPTY);
    setEditing(false);
    setError(null);
  };

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.lg,
            padding: 14,
            background: "white",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            fontFamily: tokens.font.body,
            fontSize: 12.5,
          }}
        >
          {FIELDS.map((f) => (
            <label key={f.key} style={{ display: "block" }}>
              <span style={labelStyle}>{f.label}</span>
              <input
                type="text"
                value={form[f.key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
                disabled={isSaving}
                style={inputStyle}
              />
            </label>
          ))}
        </div>
        {error && (
          <div
            style={{
              fontSize: 12,
              color: tokens.color.dangerInk,
              fontFamily: tokens.font.body,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {isEmpty ? (
        emptyState(
          "No address on file",
          "Click Edit to add one for this staff member.",
        )
      ) : (
        <div
          style={{
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.lg,
            padding: 14,
            background: tokens.color.ink50,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            fontFamily: tokens.font.body,
            fontSize: 12.5,
          }}
        >
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div style={labelStyle}>{f.label}</div>
              <div style={{ color: tokens.color.ink900, marginTop: 2 }}>
                {(address?.[f.key] ?? "").trim() || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
      {onSave && staffProfileId != null && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {isEmpty ? "Add address" : "Edit"}
          </Button>
        </div>
      )}
    </div>
  );
}
