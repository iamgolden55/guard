import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card, Icon, Input, textStyles, tokens } from "../../design-system";

const schema = z.object({
  username: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

interface LocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const { login, authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasRedirectedRef = useRef(false);

  const fromPathname = (location.state as LocationState | null)?.from?.pathname;
  const from = fromPathname && fromPathname !== "/login" ? fromPathname : "/dashboard";

  // Surface ?expired=true once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "true") {
      setSubmitError("Your session has expired. Please log in again.");
      params.delete("expired");
      const cleanUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  // Redirect after successful auth (onboarding-aware).
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (
      authState.isAuthenticated &&
      !authState.isLoading &&
      !authState.onboardingLoading
    ) {
      hasRedirectedRef.current = true;
      if (authState.onboarding.isCompleted === false) {
        const step = authState.onboarding.currentStep || 1;
        navigate(`/onboarding/step/${step}`);
      } else {
        navigate(from);
      }
    }
  }, [
    authState.isAuthenticated,
    authState.isLoading,
    authState.onboardingLoading,
    authState.onboarding.isCompleted,
    authState.onboarding.currentStep,
    from,
    navigate,
  ]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await login(values.username, values.password);
    } catch {
      setSubmitError("Login failed. Please check your credentials and try again.");
    }
  };

  const errorMessage = submitError || authState.error;

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: tokens.color.ink50 }}
    >
      <Card padding={32} elevation="md" style={{ width: "min(100%, 420px)" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
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
          <h1 style={{ ...textStyles.h2, marginTop: 16, marginBottom: 4 }}>Welcome back</h1>
          <p style={{ ...textStyles.mute, fontSize: 13 }}>Sign in to your Mead Security account</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          noValidate
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...textStyles.label }}>Email or username</span>
            <Input
              {...register("username")}
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="alex@meadsecurity.co.uk"
              leading={<Icon name="users" size={16} style={{ color: tokens.color.ink500 }} />}
            />
            {errors.username && (
              <span style={{ ...textStyles.mute, color: tokens.color.dangerInk, fontSize: 12 }}>
                {errors.username.message}
              </span>
            )}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...textStyles.label }}>Password</span>
            <Input
              {...register("password")}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              leading={<Icon name="shield" size={16} style={{ color: tokens.color.ink500 }} />}
            />
            {errors.password && (
              <span style={{ ...textStyles.mute, color: tokens.color.dangerInk, fontSize: 12 }}>
                {errors.password.message}
              </span>
            )}
          </label>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting || authState.isLoading}
            style={{ marginTop: 8, width: "100%" }}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
