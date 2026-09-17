// Viewer for an officer's SIA licence card.
//
// The card is an identity document, so it is fetched through the authenticated
// API client as a blob and held as an object URL only while this modal is open.
// A blob: URL runs with this app's origin — where the session tokens live — so
// only the three types the API accepts are ever rendered.
import { type CSSProperties, useEffect, useState } from "react";
import { Button } from "../../../../design-system/primitives/Button";
import { Modal } from "../../../../design-system/primitives/Modal";
import { tokens } from "../../../../design-system/tokens";
import { extractApiError } from "../../../../lib/apiError";
import type { SIALicenseRecord } from "../../hooks/useStaffData";

const PREVIEWABLE = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["application/pdf", "pdf"],
]);

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; url: string; type: string; extension: string }
  | { kind: "error"; message: string; missing: boolean };

const linkButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 14px",
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.ink200}`,
  background: "white",
  color: tokens.color.ink900,
  fontFamily: tokens.font.body,
  fontSize: 13.5,
  fontWeight: 600,
  textDecoration: "none",
};

const messageStyle: CSSProperties = {
  padding: "40px 16px",
  textAlign: "center",
  color: tokens.color.ink600,
  fontFamily: tokens.font.body,
  fontSize: 13,
};

export interface SIALicenceDocumentModalProps {
  licence: SIALicenseRecord | null;
  staffName: string;
  onClose: () => void;
  /** Must be a stable reference: the fetch re-runs whenever it changes. */
  onFetch: (licenseId: number) => Promise<Blob>;
  /** Offered when the file is missing, e.g. a card stored before R2. */
  onUpload?: (licence: SIALicenseRecord) => void;
}

export function SIALicenceDocumentModal({
  licence,
  staffName,
  onClose,
  onFetch,
  onUpload,
}: SIALicenceDocumentModalProps) {
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const licenceId = licence?.id ?? null;

  useEffect(() => {
    if (licenceId == null) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setView({ kind: "loading" });

    onFetch(licenceId)
      .then((blob) => {
        if (cancelled) return;
        const type = blob.type.split(";")[0].trim().toLowerCase();
        const extension = PREVIEWABLE.get(type);
        if (!extension) {
          setView({
            kind: "error",
            message: "This file can't be previewed.",
            missing: false,
          });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setView({ kind: "ready", url: objectUrl, type, extension });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        setView({
          kind: "error",
          message: extractApiError(err, "Couldn't load the card. Try again."),
          missing: status === 404,
        });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [licenceId, onFetch]);

  const alt = `SIA licence card for ${staffName}`;

  return (
    <Modal
      open={licence != null}
      onClose={onClose}
      title="SIA licence card"
      description={
        licence ? `${staffName} · ${licence.license_number}` : undefined
      }
      size="lg"
      footer={
        <>
          {view.kind === "ready" && licence && (
            <>
              {/* iOS Safari shows only the first page of an inline PDF. */}
              <a
                href={view.url}
                target="_blank"
                rel="noopener noreferrer"
                style={linkButtonStyle}
              >
                Open in new tab
              </a>
              <a
                href={view.url}
                download={`sia-licence-${licence.id}.${view.extension}`}
                style={linkButtonStyle}
              >
                Download
              </a>
            </>
          )}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {view.kind === "loading" && <div style={messageStyle}>Loading card…</div>}

      {view.kind === "error" && (
        <div style={messageStyle}>
          <div
            style={{
              color: view.missing ? tokens.color.ink800 : tokens.color.dangerInk,
            }}
          >
            {view.message}
          </div>
          {view.missing && onUpload && licence && (
            <div style={{ marginTop: 14 }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onUpload(licence)}
              >
                Upload card
              </Button>
            </div>
          )}
        </div>
      )}

      {view.kind === "ready" &&
        (view.type === "application/pdf" ? (
          // No `sandbox`: Chrome refuses to render a PDF in a sandboxed frame.
          <iframe
            title={alt}
            src={view.url}
            style={{
              display: "block",
              width: "100%",
              height: "70vh",
              border: `1px solid ${tokens.color.ink200}`,
              borderRadius: tokens.radius.md,
            }}
          />
        ) : (
          <img
            src={view.url}
            alt={alt}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "70vh",
              margin: "0 auto",
              objectFit: "contain",
              borderRadius: tokens.radius.md,
            }}
          />
        ))}
    </Modal>
  );
}
