import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../../design-system/primitives/Button";
import { Input } from "../../../design-system/primitives/Input";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import { calculateWorkingDays } from "../hooks/useLeaveData";
import type { LeaveRequestFormData, LeaveType } from "../../../types/leave";

const schema = z
  .object({
    leave_type_id: z
      .string()
      .min(1, "Choose a leave type"),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    reason: z.string().trim().min(3, "Please share a brief reason"),
  })
  .refine((v) => new Date(v.end_date) >= new Date(v.start_date), {
    path: ["end_date"],
    message: "End date must be on or after the start date",
  });

type FormValues = z.infer<typeof schema>;

export interface RequestLeaveModalProps {
  open: boolean;
  onClose: () => void;
  leaveTypes: LeaveType[];
  onSubmit: (payload: LeaveRequestFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function RequestLeaveModal({
  open,
  onClose,
  leaveTypes,
  onSubmit,
  isSubmitting,
}: RequestLeaveModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      leave_type_id: "",
      start_date: "",
      end_date: "",
      reason: "",
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setSubmitError(null);
    }
  }, [open, reset]);

  const startDate = watch("start_date");
  const endDate = watch("end_date");
  const leaveTypeId = watch("leave_type_id");

  const workingDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return calculateWorkingDays(new Date(startDate), new Date(endDate));
  }, [startDate, endDate]);

  const selectedType = useMemo(
    () => leaveTypes.find((t) => String(t.id) === leaveTypeId),
    [leaveTypes, leaveTypeId],
  );

  const submit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await onSubmit({
        leave_type_id: Number(values.leave_type_id),
        start_date: values.start_date,
        end_date: values.end_date,
        days_requested: workingDays,
        reason: values.reason,
      });
      onClose();
    } catch {
      setSubmitError("Couldn't submit your request. Please try again.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request leave"
      description="Tell your manager when you'd like time off and they'll review it."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(submit)}
            disabled={!isValid || workingDays <= 0 || isSubmitting}
          >
            {isSubmitting ? "Submitting…" : "Submit request"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(submit)}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
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

        <Field label="Leave type" required error={errors.leave_type_id?.message}>
          <select
            {...register("leave_type_id")}
            style={selectStyle}
          >
            <option value="">Select a leave type…</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selectedType && selectedType.min_notice_days > 0 && (
            <span style={{ fontSize: 11, color: tokens.color.ink500 }}>
              Requires at least {selectedType.min_notice_days} days notice.
            </span>
          )}
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Start date" required error={errors.start_date?.message}>
            <Input {...register("start_date")} type="date" />
          </Field>
          <Field label="End date" required error={errors.end_date?.message}>
            <Input
              {...register("end_date")}
              type="date"
              min={startDate || undefined}
            />
          </Field>
        </div>

        {workingDays > 0 && (
          <div
            style={{
              background: tokens.color.infoSoft,
              border: `1px solid ${tokens.color.info}33`,
              borderRadius: tokens.radius.md,
              padding: "10px 12px",
              fontSize: 12.5,
              color: tokens.color.infoInk,
              fontFamily: tokens.font.body,
            }}
          >
            That's <strong>{workingDays} working day{workingDays === 1 ? "" : "s"}</strong>{" "}
            (weekends excluded). Bank holidays will be subtracted by your manager during
            review.
          </div>
        )}

        <Field label="Reason" required error={errors.reason?.message}>
          <textarea
            {...register("reason")}
            rows={3}
            placeholder="Briefly tell your manager why you're requesting this time off…"
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
        </Field>
      </form>
    </Modal>
  );
}

const selectStyle: React.CSSProperties = {
  height: 38,
  width: "100%",
  padding: "0 12px",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: tokens.radius.md,
  background: "white",
  fontFamily: tokens.font.body,
  fontSize: 13.5,
  color: tokens.color.ink900,
};

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 600,
          fontSize: 12,
          color: tokens.color.ink700,
        }}
      >
        {label}
        {required && <span style={{ color: tokens.color.danger, marginLeft: 4 }}>*</span>}
      </span>
      {children}
      {error && (
        <span style={{ fontSize: 12, color: tokens.color.dangerInk }}>{error}</span>
      )}
    </div>
  );
}
