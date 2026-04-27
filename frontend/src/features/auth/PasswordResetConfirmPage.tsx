// PasswordResetConfirmPage — POST /api/v1/password-reset/confirm/ with
// the token from /reset-password/confirm/:token.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "../../services/api";
import { Button, Card, Icon, Input, textStyles, tokens } from "../../design-system";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function PasswordResetConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await api.post("/api/v1/password-reset/confirm/", {
        token,
        password: values.password,
      });
      setDone(true);
      window.setTimeout(() => navigate("/login"), 1500);
    } catch {
      setSubmitError("Reset failed. The link may have expired — request a new one.");
    }
  };

  return (
    <Card padding={32} elevation="md" style={{ width: "min(100%, 420px)" }}>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <BrandTile />
        <h1 style={{ ...textStyles.h2, marginTop: 16, marginBottom: 4 }}>Set a new password</h1>
        <p style={{ ...textStyles.mute, fontSize: 13 }}>Enter your new password below.</p>
      </div>

      {done ? (
        <div
          role="status"
          style={{
            padding: "16px 14px",
            borderRadius: tokens.radius.md,
            background: tokens.color.successSoft,
            color: tokens.color.successInk,
            border: `1px solid ${tokens.color.success}33`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icon name="check" size={18} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Password updated</div>
            <div style={{ fontSize: 12, marginTop: 2 }}>Redirecting to sign-in…</div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
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
              }}
            >
              {submitError}
            </div>
          )}

          <Field label="New password" error={errors.password?.message}>
            <Input
              {...register("password")}
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="At least 8 characters"
              leading={<Icon name="lock" size={16} style={{ color: tokens.color.ink500 }} />}
            />
          </Field>

          <Field label="Confirm new password" error={errors.confirmPassword?.message}>
            <Input
              {...register("confirmPassword")}
              type="password"
              autoComplete="new-password"
              leading={<Icon name="lock" size={16} style={{ color: tokens.color.ink500 }} />}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            style={{ marginTop: 8, width: "100%" }}
          >
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>

          <div style={{ textAlign: "center", marginTop: 4 }}>
            <Link
              to="/login"
              style={{ fontSize: 12, color: tokens.color.ink600, textDecoration: "none" }}
            >
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ ...textStyles.label }}>{label}</span>
      {children}
      {error && (
        <span style={{ ...textStyles.mute, color: tokens.color.dangerInk, fontSize: 12 }}>
          {error}
        </span>
      )}
    </label>
  );
}

function BrandTile() {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 11,
        background: `linear-gradient(135deg, ${tokens.color.primary} 0%, ${tokens.color.primaryDark} 100%)`,
        display: "inline-grid",
        placeItems: "center",
        boxShadow: `0 4px 10px -4px ${tokens.color.primary}66`,
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
      </svg>
    </div>
  );
}
