// DisconnectModal — confirmation before tearing down a connection.
// Used for both finance providers and Deputy.
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";

export interface DisconnectModalProps {
  open: boolean;
  providerName: string;
  warning?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

export function DisconnectModal({
  open,
  providerName,
  warning,
  onClose,
  onConfirm,
  isSubmitting,
}: DisconnectModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Disconnect ${providerName}?`}
      description="No data is deleted on either side, but syncs will stop until you reconnect."
      size="sm"
      tone="danger"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await onConfirm();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Disconnecting…" : "Disconnect"}
          </Button>
        </>
      }
    >
      {warning && (
        <div
          style={{
            background: tokens.color.warnSoft,
            border: `1px solid ${tokens.color.warn}40`,
            borderRadius: tokens.radius.md,
            padding: "10px 12px",
            fontSize: 12.5,
            color: tokens.color.warnInk,
          }}
        >
          {warning}
        </div>
      )}
    </Modal>
  );
}
