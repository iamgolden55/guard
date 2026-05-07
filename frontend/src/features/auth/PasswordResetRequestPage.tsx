// PasswordResetRequestPage — POST /api/v1/password-reset/request/.
// On success, surfaces a "check your email" confirmation; we never
// leak whether the email exists.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "../../services/api";
import { Button, Card, Icon, Input, textStyles, tokens } from "../../design-system";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

export default function PasswordResetRequestPage() {
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await api.post("/api/v1/password-reset/request/", { email: values.email });
      setSent(true);
    } catch {
      // Never leak whether the email exists — show the same success state
      // unless the request itself failed (network error).
      setSent(true);
    }
  };

  return (
    <Card padding={32} elevation="md" style={{ width: "min(100%, 420px)" }}>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <BrandTile />
        <h1 style={{ ...textStyles.h2, marginTop: 16, marginBottom: 4 }}>Reset your password</h1>
        <p style={{ ...textStyles.mute, fontSize: 13 }}>
          We'll email you a link to set a new password.
        </p>
      </div>

      {sent ? (
        <div
          role="status"
          style={{
            padding: "16px 14px",
            borderRadius: tokens.radius.md,
            background: tokens.color.successSoft,
            color: tokens.color.successInk,
            border: `1px solid ${tokens.color.success}33`,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <Icon name="check" size={18} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Check your inbox</div>
            <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
              If an account matches that email, a reset link is on its way. The link expires in
              24 hours.
            </div>
            <Link
              to="/login"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 12,
                color: tokens.color.primary,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Back to sign in
            </Link>
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

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...textStyles.label }}>Email</span>
            <Input
              {...register("email")}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="alex@meadsecurity.co.uk"
              leading={<Icon name="mail" size={16} style={{ color: tokens.color.ink500 }} />}
            />
            {errors.email && (
              <span style={{ ...textStyles.mute, color: tokens.color.dangerInk, fontSize: 12 }}>
                {errors.email.message}
              </span>
            )}
          </label>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            style={{ marginTop: 8, width: "100%" }}
          >
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>

          <div style={{ textAlign: "center", marginTop: 4 }}>
            <Link
              to="/login"
              style={{
                fontSize: 12,
                color: tokens.color.ink600,
                textDecoration: "none",
              }}
            >
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </Card>
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
