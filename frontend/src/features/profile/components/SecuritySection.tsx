import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, Input, SectionHeader, textStyles } from "../../../design-system";
import { FieldLabel } from "./FieldLabel";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });

type FormValues = z.infer<typeof schema>;

function relativeTime(dateString?: string) {
  if (!dateString) return "an unknown time ago";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "an unknown time ago";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  const year = Math.floor(day / 365);
  if (sec < 60) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  if (month < 12) return `${month} month${month === 1 ? "" : "s"} ago`;
  return `${year} year${year === 1 ? "" : "s"} ago`;
}

export interface SecuritySectionProps {
  passwordLastChanged?: string;
  onChangePassword: (current: string, next: string) => Promise<void>;
  isSaving: boolean;
}

export function SecuritySection({
  passwordLastChanged,
  onChangePassword,
  isSaving,
}: SecuritySectionProps) {
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    await onChangePassword(values.currentPassword, values.newPassword);
    setEditing(false);
    reset();
  };

  return (
    <Card padding={24}>
      <SectionHeader
        title="Password & security"
        subtitle="Keep your account safe with a strong password"
        right={
          !editing ? (
            <Button onClick={() => setEditing(true)} size="sm">
              Change password
            </Button>
          ) : undefined
        }
      />

      {editing ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          noValidate
        >
          <FieldLabel
            label="Current password"
            required
            error={errors.currentPassword?.message}
          >
            <Input
              {...register("currentPassword")}
              type="password"
              autoComplete="current-password"
            />
          </FieldLabel>
          <FieldLabel
            label="New password"
            required
            error={errors.newPassword?.message}
          >
            <Input
              {...register("newPassword")}
              type="password"
              autoComplete="new-password"
            />
          </FieldLabel>
          <FieldLabel
            label="Confirm new password"
            required
            error={errors.confirmPassword?.message}
          >
            <Input
              {...register("confirmPassword")}
              type="password"
              autoComplete="new-password"
            />
          </FieldLabel>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isValid || !isDirty || isSaving}
            >
              {isSaving ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...textStyles.body }}>
            Your password was last changed {relativeTime(passwordLastChanged)}.
          </div>
          <div style={{ ...textStyles.mute }}>
            For security, choose a password with at least 8 characters that mixes upper
            and lowercase letters, numbers, and symbols.
          </div>
        </div>
      )}
    </Card>
  );
}
