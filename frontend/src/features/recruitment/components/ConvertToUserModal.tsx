import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { RecruitmentApplication } from "../../../services/recruitmentService";

export interface ConvertToUserModalProps {
  open: boolean;
  application: RecruitmentApplication | null;
  onClose: () => void;
  onConfirm: (id: number) => Promise<void>;
  isSubmitting: boolean;
}

export function ConvertToUserModal({
  open,
  application,
  onClose,
  onConfirm,
  isSubmitting,
}: ConvertToUserModalProps) {
  const handleConfirm = async () => {
    if (!application) return;
    await onConfirm(application.id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert to staff user"
      description={
        application
          ? `Create a staff user account for ${application.full_name}.`
          : "Create a staff user account."
      }
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isSubmitting || !application}
          >
            {isSubmitting ? "Creating account…" : "Convert to user"}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontFamily: tokens.font.body,
          fontSize: 13.5,
          color: tokens.color.ink800,
        }}
      >
        <p style={{ margin: 0 }}>
          This creates a new staff user account from this application. Once
          created, the new user can log in and the application is permanently
          linked to their account.
        </p>
        {application && (
          <div
            style={{
              background: tokens.color.ink50,
              border: `1px solid ${tokens.color.ink200}`,
              borderRadius: tokens.radius.md,
              padding: "10px 12px",
              fontSize: 12.5,
            }}
          >
            <div style={{ fontWeight: 600, color: tokens.color.ink900 }}>
              {application.full_name}
            </div>
            <div style={{ color: tokens.color.ink600, marginTop: 2 }}>
              {application.email}
            </div>
          </div>
        )}
        <p style={{ margin: 0, color: tokens.color.ink500, fontSize: 12 }}>
          This action cannot be undone from the UI.
        </p>
      </div>
    </Modal>
  );
}
