import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../../design-system/primitives/Button";
import { Input } from "../../../design-system/primitives/Input";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { InviteStaffPayload } from "../hooks/useStaffData";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email"),
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  password: z
    .string()
    .min(8, "Temporary password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

function extractFieldErrors(err: unknown): Record<string, string> | null {
  const data = (err as { response?: { data?: unknown } } | undefined)?.response?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const first = value.find((v) => typeof v === "string");
      if (typeof first === "string") out[key] = first;
    } else if (typeof value === "string") {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export interface InviteStaffModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: InviteStaffPayload) => Promise<void>;
  isSubmitting: boolean;
}

export function InviteStaffModal({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: InviteStaffModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setSubmitError(null);
    }
  }, [open, reset]);

  const submit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await onSubmit({
        username: values.username,
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        password: values.password,
        role: "staff",
      });
      onClose();
    } catch (err: unknown) {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        // Backend uses snake_case; map first_name/last_name onto the camelCase form keys.
        const apiToFormKey: Record<string, keyof FormValues> = {
          first_name: "firstName",
          last_name: "lastName",
          email: "email",
          username: "username",
          password: "password",
        };
        const unmatched: string[] = [];
        for (const [key, msg] of Object.entries(fieldErrors)) {
          const formKey = apiToFormKey[key];
          if (formKey) {
            setError(formKey, { type: "server", message: msg });
          } else {
            unmatched.push(`${key}: ${msg}`);
          }
        }
        setSubmitError(
          unmatched.length > 0
            ? unmatched.join(" • ")
            : "Please fix the highlighted fields and try again.",
        );
      } else {
        setSubmitError("Couldn't invite staff. Check the details and try again.");
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite staff member"
      description="They'll receive temporary credentials and be added to the active roster."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(submit)}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Sending invite…" : "Send invite"}
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="First name" error={errors.firstName?.message}>
            <Input {...register("firstName")} type="text" autoComplete="given-name" />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <Input {...register("lastName")} type="text" autoComplete="family-name" />
          </Field>
        </div>

        <Field label="Work email" error={errors.email?.message}>
          <Input {...register("email")} type="email" autoComplete="email" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Username" error={errors.username?.message}>
            <Input {...register("username")} type="text" autoComplete="off" />
          </Field>
          <Field
            label="Temporary password"
            hint="They'll be prompted to change this on first sign-in."
            error={errors.password?.message}
          >
            <Input
              {...register("password")}
              type="text"
              autoComplete="new-password"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 600,
          fontSize: 12,
          color: tokens.color.ink700,
        }}
      >
        {label}
      </span>
      {children}
      {hint && !error && (
        <span style={{ fontSize: 11, color: tokens.color.ink500 }}>{hint}</span>
      )}
      {error && (
        <span style={{ fontSize: 12, color: tokens.color.dangerInk }}>{error}</span>
      )}
    </div>
  );
}
