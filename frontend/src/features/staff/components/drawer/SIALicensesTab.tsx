import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Button } from "../../../../design-system/primitives/Button";
import { Input } from "../../../../design-system/primitives/Input";
import { Modal } from "../../../../design-system/primitives/Modal";
import { Pill } from "../../../../design-system/primitives/Pill";
import { Icon } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import { extractApiError } from "../../../../lib/apiError";
import {
  CARD_ACCEPT,
  formatBytes,
  isValidLicenceNumber,
  normaliseLicenceNumber,
  siaStatusFor,
  validateCardFile,
} from "../../data/siaLicences";
import type { SIALicenseRecord } from "../../hooks/useStaffData";
import { SIALicenceDocumentModal } from "./SIALicenceDocumentModal";

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
  /** Photo or PDF of the card. Add only — a card is replaced from its row. */
  file: File | null;
}

const EMPTY_FORM: FormState = {
  licenseNumber: "",
  licenseType: "",
  issueDate: "",
  expiryDate: "",
  file: null,
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

const labelStyle = {
  fontFamily: tokens.font.body,
  fontWeight: 600,
  fontSize: 12,
  color: tokens.color.ink700,
  marginBottom: 4,
  display: "block",
};

// Mirrors SIALicenseSerializer, so the operator hears about a mistake before
// the round-trip rather than after it.
function validate(form: FormState, isEdit: boolean): string | null {
  if (!isEdit) {
    if (!form.licenseNumber.trim()) return "Licence number is required.";
    if (!isValidLicenceNumber(form.licenseNumber)) {
      return "An SIA licence number is 16 digits. Spaces are fine.";
    }
  }
  if (!form.licenseType) return "Licence type is required.";
  if (!form.issueDate) return "Issue date is required.";
  if (!form.expiryDate) return "Expiry date is required.";
  // Both are YYYY-MM-DD from <input type="date">, so they compare as strings.
  if (form.expiryDate <= form.issueDate) {
    return "Expiry date must be after the issue date.";
  }
  if (!isEdit && form.file) return validateCardFile(form.file);
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
  onUploadDocument?: (
    licenseId: number,
    staffProfileId: number,
    file: File,
  ) => Promise<boolean>;
  onVerify?: (licenseId: number, staffProfileId: number) => Promise<void>;
  onFetchDocument?: (licenseId: number) => Promise<Blob>;
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
  onUploadDocument,
  onVerify,
  onFetchDocument,
  isMutating,
}: SIALicensesTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SIALicenseRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SIALicenseRecord | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(
    null,
  );
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);
  const [busyRow, setBusyRow] = useState<{
    id: number;
    action: "upload" | "verify";
  } | null>(null);
  const formFileRef = useRef<HTMLInputElement>(null);
  const rowFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalOpen) {
      setForm(
        editing
          ? {
              licenseNumber: editing.license_number,
              licenseType: editing.license_type,
              issueDate: editing.issue_date?.slice(0, 10) ?? "",
              expiryDate: editing.expiry_date?.slice(0, 10) ?? "",
              file: null,
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
        await onAdd(staffProfileId, {
          ...form,
          licenseNumber: normaliseLicenceNumber(form.licenseNumber),
        });
      }
      closeModal();
    } catch (err) {
      // The modal stays open with everything the operator typed.
      setError(extractApiError(err, "Couldn't save licence. Try again."));
    }
  };

  const handleFormFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    const problem = validateCardFile(file);
    setError(problem);
    if (!problem) setForm((p) => ({ ...p, file }));
  };

  // One hidden input serves every row; the target is remembered on click.
  const startRowUpload = (licenseId: number) => {
    setRowError(null);
    setUploadTargetId(licenseId);
    rowFileRef.current?.click();
  };

  const handleRowFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    // Cleared so picking the same file again still fires onChange.
    e.target.value = "";
    const targetId = uploadTargetId;
    setUploadTargetId(null);
    if (!file || targetId == null || !onUploadDocument || !staffProfileId) return;
    const problem = validateCardFile(file);
    if (problem) {
      setRowError({ id: targetId, message: problem });
      return;
    }
    setBusyRow({ id: targetId, action: "upload" });
    try {
      await onUploadDocument(targetId, staffProfileId, file);
    } finally {
      setBusyRow(null);
    }
  };

  const handleVerify = async (license: SIALicenseRecord) => {
    if (!onVerify || !staffProfileId) return;
    if (
      !license.has_document &&
      !window.confirm(
        `No card is on file for licence ${license.license_number}. Verify it against the SIA register anyway?`,
      )
    ) {
      return;
    }
    setBusyRow({ id: license.id, action: "verify" });
    try {
      await onVerify(license.id, staffProfileId);
    } finally {
      setBusyRow(null);
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
  const canUpload = !!onUploadDocument && staffProfileId != null;
  const canVerify = !!onVerify && staffProfileId != null;

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
            const status = siaStatusFor(lic);
            const busy = busyRow?.id === lic.id ? busyRow.action : null;
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
                    {lic.status === "valid" && lic.verified_at && (
                      <span
                        style={{
                          fontFamily: tokens.font.body,
                          fontSize: 11.5,
                          color: tokens.color.ink500,
                        }}
                      >
                        Verified {formatDate(lic.verified_at)}
                      </span>
                    )}
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

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: `1px solid ${tokens.color.ink200}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: tokens.font.body,
                        fontSize: 12,
                        color: lic.has_document
                          ? tokens.color.ink700
                          : tokens.color.ink500,
                        marginRight: 4,
                      }}
                    >
                      <Icon name="file" size={14} />
                      {lic.has_document ? "Card on file" : "No card on file"}
                    </span>
                    {lic.has_document && onFetchDocument && (
                      <Button
                        size="sm"
                        variant="ghost"
                        leading={<Icon name="eye" size={14} />}
                        onClick={() => setViewing(lic)}
                      >
                        View card
                      </Button>
                    )}
                    {canUpload && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startRowUpload(lic.id)}
                        disabled={isMutating}
                      >
                        {busy === "upload"
                          ? "Uploading…"
                          : lic.has_document
                            ? "Replace card"
                            : "Upload card"}
                      </Button>
                    )}
                  </div>
                  {canVerify && status.canVerify && (
                    <Button
                      size="sm"
                      variant="primary"
                      leading={<Icon name="check" size={14} />}
                      onClick={() => void handleVerify(lic)}
                      disabled={isMutating}
                    >
                      {busy === "verify" ? "Verifying…" : "Verify"}
                    </Button>
                  )}
                </div>

                {rowError?.id === lic.id && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 8,
                      fontFamily: tokens.font.body,
                      fontSize: 12,
                      color: tokens.color.dangerInk,
                    }}
                  >
                    {rowError.message}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <input
        ref={rowFileRef}
        type="file"
        accept={CARD_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => void handleRowFile(e)}
      />

      {onFetchDocument && (
        <SIALicenceDocumentModal
          licence={viewing}
          staffName={staffName}
          onClose={() => setViewing(null)}
          onFetch={onFetchDocument}
          onUpload={
            canUpload
              ? (licence) => {
                  setViewing(null);
                  startRowUpload(licence.id);
                }
              : undefined
          }
        />
      )}

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
              inputMode="numeric"
              placeholder="1234 5678 9012 3456"
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

          {!editing && (
            <div>
              <span style={labelStyle}>
                Licence card{" "}
                <span style={{ fontWeight: 400, color: tokens.color.ink500 }}>
                  (optional)
                </span>
              </span>
              <input
                ref={formFileRef}
                type="file"
                accept={CARD_ACCEPT}
                style={{ display: "none" }}
                onChange={handleFormFile}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <Button
                  size="sm"
                  variant="secondary"
                  leading={<Icon name="file" size={14} />}
                  onClick={() => formFileRef.current?.click()}
                  disabled={isMutating}
                >
                  {form.file ? "Change file" : "Choose file"}
                </Button>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: tokens.font.body,
                    fontSize: 12.5,
                    color: form.file ? tokens.color.ink800 : tokens.color.ink500,
                  }}
                >
                  {form.file
                    ? `${form.file.name} · ${formatBytes(form.file.size)}`
                    : "Photo or PDF of the card, up to 10 MB"}
                </span>
                {form.file && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((p) => ({ ...p, file: null }))}
                    disabled={isMutating}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
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
