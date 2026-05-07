import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { RecruitmentApplication } from "../../../services/recruitmentService";

const schema = z.object({
  notes: z.string().trim().min(3, "Please share a brief reason"),
});

type FormValues = z.infer<typeof schema>;

export interface RejectReasonModalProps {
  open: boolean;
  application: RecruitmentApplication | null;
  onClose: () => void;
  onSubmit: (id: number, notes: string) => Promise<void>;
  isSubmitting: boolean;
}

export function RejectReasonModal({
  open,
  application,
  onClose,
  onSubmit,
  isSubmitting,
}: RejectReasonModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { notes: "" },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setSubmitError(null);
    }
  }, [open, reset]);

  const submit = async (values: FormValues) => {
    if (!application) return;
    setSubmitError(null);
    try {
      await onSubmit(application.id, values.notes.trim());
      onClose();
    } catch {
      setSubmitError("Couldn't reject the application. Please try again.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject application"
      description={
        application
          ? `Provide a reason — ${application.full_name} will be informed.`
          : "Provide a reason for rejection."
      }
      size="md"
      tone="danger"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit(submit)}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Rejecting…" : "Reject application"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(submit)}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
        noValidate
      >
        {submitError && (
          <div
            role="alert"
            style={{
              background: tokens.color.dangerSoft,
              color: tokens.color.dangerInk,
              border: `1px solid ${tokens.color.danger}33`,
              borderRadius: tokens.radius.md,
              padding: "10px 12px",
              fontSize: 13,
              fontFamily: tokens.font.body,
            }}
          >
            {submitError}
          </div>
        )}

        <span
          style={{
            fontFamily: tokens.font.body,
            fontWeight: 600,
            fontSize: 12,
            color: tokens.color.ink700,
          }}
        >
          Reason <span style={{ color: tokens.color.danger }}>*</span>
        </span>
        <textarea
          {...register("notes")}
          rows={4}
          placeholder="Why is this application being rejected?"
          style={{
            width: "100%",
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            padding: "10px 12px",
            fontFamily: tokens.font.body,
            fontSize: 13,
            color: tokens.color.ink900,
            resize: "vertical",
            outline: "none",
            background: "white",
          }}
        />
        {errors.notes && (
          <span
            style={{ fontSize: 12, color: tokens.color.dangerInk }}
          >
            {errors.notes.message}
          </span>
        )}
      </form>
    </Modal>
  );
}
