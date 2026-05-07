// RegisterPage — sign-up form. Wired to authService.register.
// On success the AuthContext picks up the user and the LoginPage's
// redirect logic kicks in (we navigate to /login after success since
// register doesn't auto-create a session in the backend).
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import authService from "../../services/authService";
import { Button, Card, Icon, Input, textStyles, tokens } from "../../design-system";

const schema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email"),
    username: z.string().min(3, "Choose a username (3+ chars)"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await authService.register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        username: values.username,
        password: values.password,
      });
      setSubmitted(true);
      window.setTimeout(() => navigate("/login"), 1200);
    } catch {
      setSubmitError("Registration failed. The username or email may already exist.");
    }
  };

  return (
    <Card padding={32} elevation="md" style={{ width: "min(100%, 460px)" }}>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <BrandTile />
        <h1 style={{ ...textStyles.h2, marginTop: 16, marginBottom: 4 }}>Create your account</h1>
        <p style={{ ...textStyles.mute, fontSize: 13 }}>
          Join Mead Security · already have an account?{" "}
          <Link
            to="/login"
            style={{ color: tokens.color.primary, fontWeight: 600, textDecoration: "none" }}
          >
            Sign in
          </Link>
        </p>
      </div>

      {submitted ? (
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
            <div style={{ fontSize: 13, fontWeight: 700 }}>Account created</div>
            <div style={{ fontSize: 12, marginTop: 2 }}>Redirecting to sign-in…</div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          noValidate
        >
          {submitError && <ErrorBanner>{submitError}</ErrorBanner>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="First name" error={errors.firstName?.message}>
              <Input {...register("firstName")} type="text" autoComplete="given-name" autoFocus />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <Input {...register("lastName")} type="text" autoComplete="family-name" />
            </Field>
          </div>

          <Field label="Email" error={errors.email?.message}>
            <Input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="alex@meadsecurity.co.uk"
            />
          </Field>

          <Field label="Username" error={errors.username?.message}>
            <Input {...register("username")} type="text" autoComplete="username" />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <Input
              {...register("password")}
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </Field>

          <Field label="Confirm password" error={errors.confirmPassword?.message}>
            <Input
              {...register("confirmPassword")}
              type="password"
              autoComplete="new-password"
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            style={{ marginTop: 8, width: "100%" }}
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
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
        <span
          style={{
            ...textStyles.mute,
            color: tokens.color.dangerInk,
            fontSize: 12,
          }}
        >
          {error}
        </span>
      )}
    </label>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}
