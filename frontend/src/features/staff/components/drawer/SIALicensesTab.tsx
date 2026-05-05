import { useEffect, useState } from "react";
import { Button } from "../../../../design-system/primitives/Button";
import { Input } from "../../../../design-system/primitives/Input";
import { Modal } from "../../../../design-system/primitives/Modal";
import { Pill, type PillTone } from "../../../../design-system/primitives/Pill";
import { Icon } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import type { SIALicenseRecord } from "../../hooks/useStaffData";

const LICENSE_TYPE_LABELS: Record<string, string> = {
  ds: "Door Supervision",
  sg: "Security Guarding",
  cctv: "CCTV",
  cp: "Close Protection",
  k9: "Dog Handler",
  vs: "Vehicle Security",
  key: "Key Holding",
};

const LICENSE_TYPE_OPTIONS = Object.entries(LICENSE_TYPE_LABELS);

interface FormState {
  licenseNumber: string;
  licenseType: string;
  issueDate: string;
  expiryDate: string;
}

const EMPTY_FORM: FormState = {
  licenseNumber: "",
  licenseType: "",
  issueDate: "",
  expiryDate: "",
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusFor(expiry: string): { tone: PillTone; label: string } {
  const now = new Date();
  const exp = new Date(expiry);
  const ninety = new Date();
  ninety.setDate(now.getDate() + 90);
  if (Number.isNaN(exp.getTime())) return { tone: "neutral", label: "Unknown" };
  if (exp < now) return { tone: "danger", label: "Expired" };
  if (exp < ninety) return { tone: "warning", label: "Expiring soon" };
  return { tone: "positive", label: "Valid" };
}

const labelStyle = {
  fontFamily: tokens.font.body,
  fontWeight: 600,
  fontSize: 12,
  color: tokens.color.ink700,
  marginBottom: 4,
  display: "block",
};

function validate(form: FormState, isEdit: boolean): string | null {
  if (!isEdit && !form.licenseNumber.trim()) return "Licence number is required.";
  if (!form.licenseType) return "Licence type is required.";
  if (!form.issueDate) return "Issue date is required.";
  if (!form.expiryDate) return "Expiry date is required.";
  if (new Date(form.expiryDate) < new Date(form.issueDate)) {
    return "Expiry date must be on or after the issue date.";
  }
  return null;
}

export interface SIALicensesTabProps {
  licenses: SIALicenseRecord[];
  isLoading: boolean;
  staffProfileId: number | null;
  staffName: string;
  onAdd?: (
    staffProfileId: number,
    data: FormState,
  ) => Promise<void>;
  onUpdate?: (
    licenseId: number,
    staffProfileId: number,
    data: { issue_date: string; expiry_date: string; license_type: string },
  ) => Promise<void>;
  onDelete?: (licenseId: number, staffProfileId: number) => Promise<void>;
  isMutating: boolean;
}

export function SIALicensesTab({
  licenses,
  isLoading,
  staffProfileId,
  staffName,
  onAdd,
  onUpdate,
  onDelete,
  isMutating,
}: SIALicensesTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SIALicenseRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (modalOpen) {
      setForm(
        editing
          ? {
              licenseNumber: editing.license_number,
              licenseType: editing.license_type,
              issueDate: editing.issue_date?.slice(0, 10) ?? "",
              expiryDate: editing.expiry_date?.slice(0, 10) ?? "",
            }
          : EMPTY_FORM,
      );
      setError(null);
    }
  }, [modalOpen, editing]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = async () => {
    const validationError = validate(form, !!editing);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!staffProfileId) return;
    try {
      if (editing) {
        if (!onUpdate) return;
        await onUpdate(editing.id, staffProfileId, {
          issue_date: form.issueDate,
          expiry_date: form.expiryDate,
          license_type: form.licenseType,
        });
      } else {
        if (!onAdd) return;
        await onAdd(staffProfileId, form);
      }
      closeModal();
    } catch {
      setError("Couldn't save licence. Try again.");
    }
  };

  const handleDelete = async (license: SIALicenseRecord) => {
    if (!onDelete || !staffProfileId) return;
    if (
      !window.confirm(
        `Delete the ${LICENSE_TYPE_LABELS[license.license_type] ?? license.license_type} licence for ${staffName}? This cannot be undone.`,
      )
    ) {
      return;
    }
    await onDelete(license.id, staffProfileId);
  };

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
        Loading licences…
      </div>
    );
  }

  const canEdit = !!onAdd && !!onUpdate && !!onDelete && staffProfileId != null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {canEdit && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              disabled={isMutating}
            >
              Add licence
            </Button>
          </div>
        )}

        {licenses.length === 0 ? (
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
              <Icon name="shield" size={16} />
            </div>
            No SIA licences on file for this staff member.
          </div>
        ) : (
          licenses.map((lic) => {
            const status = statusFor(lic.expiry_date);
            const typeLabel =
              LICENSE_TYPE_LABELS[lic.license_type] ?? lic.license_type;
            return (
              <div
                key={lic.id}
                style={{
                  border: `1px solid ${tokens.color.ink200}`,
                  borderRadius: tokens.radius.lg,
                  padding: 14,
                  background: tokens.color.ink50,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: tokens.font.display,
                        fontWeight: 700,
                        fontSize: 14,
                        color: tokens.color.ink900,
                      }}
                    >
                      {typeLabel}
                    </span>
                    <Pill tone={status.tone} dot>
                      {status.label}
                    </Pill>
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(lic);
                          setModalOpen(true);
                        }}
                        disabled={isMutating}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDelete(lic)}
                        disabled={isMutating}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 12,
                    fontFamily: tokens.font.body,
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: tokens.color.ink500,
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.09em",
                      }}
                    >
                      Number
                    </div>
                    <div style={{ color: tokens.color.ink900, marginTop: 2 }}>
                      {lic.license_number}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        color: tokens.color.ink500,
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.09em",
                      }}
                    >
                      Issued
                    </div>
                    <div style={{ color: tokens.color.ink900, marginTop: 2 }}>
                      {formatDate(lic.issue_date)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        color: tokens.color.ink500,
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.09em",
                      }}
                    >
                      Expires
                    </div>
                    <div style={{ color: tokens.color.ink900, marginTop: 2 }}>
                      {formatDate(lic.expiry_date)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit SIA licence" : "Add SIA licence"}
        description={`For ${staffName}.`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={isMutating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={isMutating}
            >
              {isMutating
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Add licence"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={labelStyle}>Licence number</span>
            <Input
              type="text"
              value={form.licenseNumber}
              onChange={(e) =>
                setForm((p) => ({ ...p, licenseNumber: e.target.value }))
              }
              disabled={!!editing}
            />
            {editing && (
              <div
                style={{
                  fontSize: 11,
                  color: tokens.color.ink500,
                  marginTop: 4,
                }}
              >
                Licence number can't be changed for an existing record.
              </div>
            )}
          </div>

          <div>
            <span style={labelStyle}>Licence type</span>
            <select
              value={form.licenseType}
              onChange={(e) =>
                setForm((p) => ({ ...p, licenseType: e.target.value }))
              }
              style={{
                height: 38,
                width: "100%",
                padding: "0 12px",
                border: `1px solid ${tokens.color.ink200}`,
                borderRadius: tokens.radius.md,
                background: "white",
                fontFamily: tokens.font.body,
                fontSize: 13.5,
                color: tokens.color.ink900,
                boxSizing: "border-box",
              }}
            >
              <option value="">Select type…</option>
              {LICENSE_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <span style={labelStyle}>Issue date</span>
              <Input
                type="date"
                value={form.issueDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, issueDate: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Expiry date</span>
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, expiryDate: e.target.value }))
                }
              />
            </div>
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
        </div>
      </Modal>
    </>
  );
}
