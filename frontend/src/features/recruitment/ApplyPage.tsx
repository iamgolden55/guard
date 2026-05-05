// Public recruitment application form. Mounted at /apply/:companySlug —
// outside AuthGuard so anonymous candidates can submit. Uses the public
// endpoints already wired in recruitmentService:
//   GET  /api/v1/company-recruitment/info/{slug}/
//   GET  /api/v1/company-recruitment/employment-types/{slug}/
//   POST /api/v1/company-recruitment/apply/{slug}/
import { useEffect, useMemo, useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams } from "react-router-dom";
import {
  Button,
  Card,
  Input,
  Pill,
  SectionHeader,
  textStyles,
  tokens,
} from "../../design-system";
import { Icon } from "../../design-system/Icon";
import {
  recruitmentService,
  type RecruitmentApplicationRequest,
} from "../../services/recruitmentService";

// Mobile overrides — the rest of the page uses inline styles (consistent with
// the rewrite), so we inject one tiny stylesheet to collapse 2-col grids to a
// single column under 600px and shrink the heading.
const MOBILE_CSS = `
@media (max-width: 600px) {
  .apply-grid-2 { grid-template-columns: 1fr !important; }
  .apply-shell-header { padding: 22px 18px 32px !important; }
  .apply-shell-main { padding: 0 16px 56px !important; }
  .apply-shell-h1 { font-size: 22px !important; }
  .apply-shell-section { padding: 16px !important; }
}
`;

// ── Schema ────────────────────────────────────────────────────────────────

const LICENCE_TYPES = [
  { value: "door_supervisor", label: "Door Supervisor" },
  { value: "security_guard", label: "Security Guard" },
  { value: "cctv", label: "CCTV" },
  { value: "close_protection", label: "Close Protection" },
] as const;

const CERTIFICATIONS = [
  { value: "first_aid", label: "First Aid" },
  { value: "fire_marshal", label: "Fire Marshal" },
  { value: "conflict_management", label: "Conflict Management" },
  { value: "customer_service", label: "Customer Service Training" },
  { value: "other", label: "Other (please specify)" },
] as const;

const schema = z
  .object({
    // Personal
    full_name: z.string().trim().min(1, "Full name is required"),
    date_of_birth: z.string().min(1, "Date of birth is required"),
    email: z.string().email("Enter a valid email"),
    confirmEmail: z.string().email("Confirm your email"),
    phone_number: z.string().trim().min(1, "Phone number is required"),
    home_address: z.string().trim().min(1, "Home address is required"),
    postcode: z.string().trim().min(1, "Postcode is required"),

    // SIA
    has_sia_licence: z.boolean(),
    sia_licence_number: z.string().optional(),
    licence_types: z.array(z.string()),
    licence_expiry_date: z.string().optional(),
    licence_suspended_revoked: z.boolean(),
    licence_suspension_details: z.string().optional(),

    // Employment
    employment_type: z.coerce.number().int().positive({
      message: "Select an employment type",
    }),
    hours_per_week: z.coerce.number().min(1, "Must be greater than 0"),
    availability_days: z.boolean(),
    availability_nights: z.boolean(),
    availability_weekends: z.boolean(),
    availability_holidays: z.boolean(),
    willing_to_travel: z.boolean(),
    has_transport: z.boolean(),
    has_commitments: z.boolean(),
    commitments_details: z.string().optional(),

    // Experience
    has_security_experience: z.boolean(),
    security_experience_details: z.string().optional(),
    certifications: z.array(z.string()),
    other_certification_details: z.string().optional(),

    // Eligibility
    eligible_to_work_uk: z.boolean(),
    has_criminal_convictions: z.boolean(),
    criminal_convictions_details: z.string().optional(),
    terms_accepted: z.boolean(),
    digital_signature: z.string().trim().min(1, "Type your full name to sign"),
  })
  .superRefine((v, ctx) => {
    if (v.email !== v.confirmEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmEmail"],
        message: "Emails do not match",
      });
    }
    if (v.has_sia_licence) {
      if (!v.sia_licence_number?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sia_licence_number"],
          message: "Licence number is required",
        });
      }
      if (v.licence_types.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["licence_types"],
          message: "Select at least one licence type",
        });
      }
      if (!v.licence_expiry_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["licence_expiry_date"],
          message: "Expiry date is required",
        });
      }
    }
    if (v.licence_suspended_revoked && !v.licence_suspension_details?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["licence_suspension_details"],
        message: "Provide details about the suspension or revocation",
      });
    }
    if (
      !v.availability_days &&
      !v.availability_nights &&
      !v.availability_weekends &&
      !v.availability_holidays
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["availability_days"],
        message: "Select at least one availability option",
      });
    }
    if (v.has_commitments && !v.commitments_details?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commitments_details"],
        message: "Tell us about your commitments",
      });
    }
    if (v.has_security_experience && !v.security_experience_details?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["security_experience_details"],
        message: "Tell us about your experience",
      });
    }
    if (
      v.certifications.includes("other") &&
      !v.other_certification_details?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["other_certification_details"],
        message: "Specify your other certifications",
      });
    }
    if (v.has_criminal_convictions && !v.criminal_convictions_details?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criminal_convictions_details"],
        message: "Provide details about your convictions",
      });
    }
    if (!v.eligible_to_work_uk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eligible_to_work_uk"],
        message: "You must be eligible to work in the UK",
      });
    }
    if (!v.terms_accepted) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terms_accepted"],
        message: "You must accept the terms",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  full_name: "",
  date_of_birth: "",
  email: "",
  confirmEmail: "",
  phone_number: "",
  home_address: "",
  postcode: "",
  has_sia_licence: false,
  sia_licence_number: "",
  licence_types: [],
  licence_expiry_date: "",
  licence_suspended_revoked: false,
  licence_suspension_details: "",
  employment_type: 0,
  hours_per_week: 0,
  availability_days: false,
  availability_nights: false,
  availability_weekends: false,
  availability_holidays: false,
  willing_to_travel: false,
  has_transport: false,
  has_commitments: false,
  commitments_details: "",
  has_security_experience: false,
  security_experience_details: "",
  certifications: [],
  other_certification_details: "",
  eligible_to_work_uk: false,
  has_criminal_convictions: false,
  criminal_convictions_details: "",
  terms_accepted: false,
  digital_signature: "",
};

// ── Building blocks ───────────────────────────────────────────────────────

function FieldLabel({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 600,
          fontSize: 12.5,
          color: tokens.color.ink700,
        }}
      >
        {label}
        {required && (
          <span style={{ color: tokens.color.danger, marginLeft: 4 }}>*</span>
        )}
      </span>
      {children}
      {hint && !error && (
        <span style={{ fontSize: 11.5, color: tokens.color.ink500 }}>{hint}</span>
      )}
      {error && (
        <span style={{ fontSize: 12, color: tokens.color.dangerInk }}>{error}</span>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: tokens.radius.md,
        border: `1px solid ${checked ? tokens.color.ink300 : tokens.color.ink200}`,
        background: checked ? tokens.color.ink50 : "white",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: tokens.font.body,
        fontSize: 13,
        color: tokens.color.ink900,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ width: 16, height: 16, accentColor: tokens.color.ink900 }}
      />
      {label}
    </label>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 80,
  padding: "10px 12px",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: tokens.radius.md,
  background: "white",
  fontFamily: tokens.font.body,
  fontSize: 13.5,
  color: tokens.color.ink900,
  resize: "vertical",
  boxSizing: "border-box",
};

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
  boxSizing: "border-box",
};

// ── Main component ────────────────────────────────────────────────────────

interface CompanyInfo {
  name: string;
  description?: string;
  contact_email?: string;
}

interface EmploymentTypeOption {
  id: number;
  name: string;
  description?: string;
}

export default function ApplyPage() {
  const { companySlug } = useParams<{ companySlug: string }>();

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeOption[]>(
    [],
  );
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    mode: "onTouched",
    defaultValues: DEFAULTS,
  });

  const has_sia_licence = watch("has_sia_licence");
  const licence_suspended_revoked = watch("licence_suspended_revoked");
  const licence_types = watch("licence_types");
  const has_commitments = watch("has_commitments");
  const has_security_experience = watch("has_security_experience");
  const certifications = watch("certifications");
  const has_criminal_convictions = watch("has_criminal_convictions");
  const terms_accepted = watch("terms_accepted");
  const eligible_to_work_uk = watch("eligible_to_work_uk");

  // Load company info + employment types
  useEffect(() => {
    if (!companySlug) {
      setMetaError("This application link is incomplete.");
      setLoadingMeta(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [info, types] = await Promise.all([
          recruitmentService.getCompanyInfo(companySlug),
          recruitmentService.getCompanyEmploymentTypes(companySlug),
        ]);
        if (cancelled) return;
        setCompanyInfo(info as CompanyInfo);
        setEmploymentTypes(types as EmploymentTypeOption[]);
      } catch (err: unknown) {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        setMetaError(
          status === 404
            ? "This company isn't accepting applications, or the link is wrong."
            : "We couldn't load this application form. Please try again.",
        );
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  const onSubmit = async (values: FormValues) => {
    if (!companySlug) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload: RecruitmentApplicationRequest = {
        full_name: values.full_name,
        date_of_birth: values.date_of_birth,
        email: values.email,
        phone_number: values.phone_number,
        home_address: values.home_address,
        postcode: values.postcode,
        has_sia_licence: values.has_sia_licence,
        sia_licence_number: values.has_sia_licence
          ? values.sia_licence_number
          : undefined,
        licence_types: values.has_sia_licence ? values.licence_types : [],
        licence_expiry_date: values.has_sia_licence
          ? values.licence_expiry_date
          : undefined,
        licence_suspended_revoked: values.licence_suspended_revoked,
        licence_suspension_details: values.licence_suspended_revoked
          ? values.licence_suspension_details
          : undefined,
        employment_type: values.employment_type,
        hours_per_week: values.hours_per_week,
        availability_days: values.availability_days,
        availability_nights: values.availability_nights,
        availability_weekends: values.availability_weekends,
        availability_holidays: values.availability_holidays,
        willing_to_travel: values.willing_to_travel,
        has_transport: values.has_transport,
        has_commitments: values.has_commitments,
        commitments_details: values.has_commitments
          ? values.commitments_details
          : undefined,
        has_security_experience: values.has_security_experience,
        security_experience_details: values.has_security_experience
          ? values.security_experience_details
          : undefined,
        certifications: values.certifications,
        other_certification_details: values.certifications.includes("other")
          ? values.other_certification_details
          : undefined,
        eligible_to_work_uk: values.eligible_to_work_uk,
        has_criminal_convictions: values.has_criminal_convictions,
        criminal_convictions_details: values.has_criminal_convictions
          ? values.criminal_convictions_details
          : undefined,
        digital_signature: values.digital_signature,
      };
      await recruitmentService.submitCompanyApplication(companySlug, payload);
      setSubmittedEmail(values.email);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      if (typeof data === "string") {
        setSubmitError(data);
      } else if (data && typeof data === "object") {
        const detail = (data as { detail?: string; error?: string }).detail;
        const errorField = (data as { error?: string }).error;
        if (detail) setSubmitError(detail);
        else if (errorField) setSubmitError(errorField);
        else {
          const msgs = Object.entries(data as Record<string, unknown>)
            .map(([k, v]) => {
              const arr = Array.isArray(v) ? v.join(", ") : String(v);
              return `${k}: ${arr}`;
            })
            .join("; ");
          setSubmitError(msgs || "We couldn't submit your application.");
        }
      } else {
        setSubmitError("We couldn't submit your application. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = (errs: FieldErrors<FormValues>) => {
    // Surface a top-level message so users see something on first failed submit.
    const firstField = Object.keys(errs)[0];
    setSubmitError(
      firstField
        ? "Please correct the highlighted fields before submitting."
        : null,
    );
    // Scroll to first invalid field.
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-field="${firstField}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const toggleArrayValue = (
    field: "licence_types" | "certifications",
    value: string,
    next: boolean,
  ) => {
    const curr = field === "licence_types" ? licence_types : certifications;
    const updated = next
      ? Array.from(new Set([...curr, value]))
      : curr.filter((v) => v !== value);
    setValue(field, updated, { shouldValidate: true, shouldDirty: true });
  };

  // ── States: loading / not-found / success ───────────────────────────────
  if (loadingMeta) {
    return (
      <Shell>
        <Card padding={32}>
          <div style={{ ...textStyles.body, textAlign: "center" }}>
            Loading application form…
          </div>
        </Card>
      </Shell>
    );
  }

  if (metaError) {
    return (
      <Shell>
        <Card padding={32}>
          <SectionHeader
            title="We couldn't open this form"
            subtitle={metaError}
          />
        </Card>
      </Shell>
    );
  }

  if (submittedEmail) {
    return (
      <Shell company={companyInfo}>
        <Card padding={32}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: tokens.color.successSoft,
                color: tokens.color.successInk,
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icon name="check" size={26} />
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: tokens.font.display,
                fontSize: 22,
                fontWeight: 700,
                color: tokens.color.ink900,
              }}
            >
              Application submitted
            </h2>
            <p
              style={{
                ...textStyles.body,
                margin: 0,
                maxWidth: 480,
              }}
            >
              Thanks for applying to {companyInfo?.name ?? "us"}. We sent a
              confirmation to <strong>{submittedEmail}</strong>. The recruitment
              team will be in touch within 5–7 business days.
            </p>
            {companyInfo?.contact_email && (
              <p style={{ ...textStyles.mute, margin: 0 }}>
                Questions? Reach us at{" "}
                <a
                  href={`mailto:${companyInfo.contact_email}`}
                  style={{ color: tokens.color.ink800 }}
                >
                  {companyInfo.contact_email}
                </a>
              </p>
            )}
          </div>
        </Card>
      </Shell>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <Shell company={companyInfo}>
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        {/* Personal */}
        <Card padding={24}>
          <SectionHeader
            title="Personal details"
            subtitle="Tell us how to reach you."
          />
          <div
            className="apply-grid-2"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <div data-field="full_name" style={{ gridColumn: "1 / -1" }}>
              <FieldLabel label="Full name" required error={errors.full_name?.message}>
                <Input {...register("full_name")} />
              </FieldLabel>
            </div>
            <div data-field="date_of_birth">
              <FieldLabel
                label="Date of birth"
                required
                error={errors.date_of_birth?.message}
              >
                <Input type="date" {...register("date_of_birth")} />
              </FieldLabel>
            </div>
            <div data-field="phone_number">
              <FieldLabel
                label="Phone number"
                required
                error={errors.phone_number?.message}
              >
                <Input type="tel" {...register("phone_number")} />
              </FieldLabel>
            </div>
            <div data-field="email">
              <FieldLabel label="Email" required error={errors.email?.message}>
                <Input type="email" {...register("email")} />
              </FieldLabel>
            </div>
            <div data-field="confirmEmail">
              <FieldLabel
                label="Confirm email"
                required
                error={errors.confirmEmail?.message}
              >
                <Input type="email" {...register("confirmEmail")} />
              </FieldLabel>
            </div>
            <div data-field="home_address" style={{ gridColumn: "1 / -1" }}>
              <FieldLabel
                label="Home address"
                required
                error={errors.home_address?.message}
              >
                <textarea {...register("home_address")} style={textareaStyle} />
              </FieldLabel>
            </div>
            <div data-field="postcode">
              <FieldLabel label="Postcode" required error={errors.postcode?.message}>
                <Input {...register("postcode")} />
              </FieldLabel>
            </div>
          </div>
        </Card>

        {/* SIA Licence */}
        <Card padding={24}>
          <SectionHeader
            title="SIA licence"
            subtitle="If you hold a current SIA licence, share the details."
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Toggle
              checked={has_sia_licence}
              onChange={(v) => setValue("has_sia_licence", v)}
              label="I hold a current SIA licence"
            />

            {has_sia_licence && (
              <div
                className="apply-grid-2"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                <div data-field="sia_licence_number">
                  <FieldLabel
                    label="Licence number"
                    required
                    error={errors.sia_licence_number?.message}
                  >
                    <Input {...register("sia_licence_number")} />
                  </FieldLabel>
                </div>
                <div data-field="licence_expiry_date">
                  <FieldLabel
                    label="Expiry date"
                    required
                    error={errors.licence_expiry_date?.message}
                  >
                    <Input type="date" {...register("licence_expiry_date")} />
                  </FieldLabel>
                </div>
                <div data-field="licence_types" style={{ gridColumn: "1 / -1" }}>
                  <FieldLabel
                    label="Licence type(s)"
                    required
                    error={errors.licence_types?.message}
                    hint="Tick all that apply."
                  >
                    <div
                      className="apply-grid-2"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 8,
                      }}
                    >
                      {LICENCE_TYPES.map((t) => (
                        <Toggle
                          key={t.value}
                          checked={licence_types.includes(t.value)}
                          onChange={(checked) =>
                            toggleArrayValue("licence_types", t.value, checked)
                          }
                          label={t.label}
                        />
                      ))}
                    </div>
                  </FieldLabel>
                </div>
              </div>
            )}

            <Toggle
              checked={licence_suspended_revoked}
              onChange={(v) => setValue("licence_suspended_revoked", v)}
              label="A licence has previously been suspended or revoked"
            />
            {licence_suspended_revoked && (
              <div data-field="licence_suspension_details">
                <FieldLabel
                  label="Details"
                  required
                  error={errors.licence_suspension_details?.message}
                >
                  <textarea
                    {...register("licence_suspension_details")}
                    style={textareaStyle}
                  />
                </FieldLabel>
              </div>
            )}
          </div>
        </Card>

        {/* Employment Preferences */}
        <Card padding={24}>
          <SectionHeader
            title="Employment preferences"
            subtitle="The kind of work you're looking for."
          />
          <div
            className="apply-grid-2"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <div data-field="employment_type" style={{ gridColumn: "1 / -1" }}>
              <FieldLabel
                label="Employment type"
                required
                error={errors.employment_type?.message}
              >
                <select {...register("employment_type")} style={selectStyle}>
                  <option value="0">Select…</option>
                  {employmentTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <div data-field="hours_per_week">
              <FieldLabel
                label="Hours per week"
                required
                error={errors.hours_per_week?.message}
              >
                <Input
                  type="number"
                  min={1}
                  step={1}
                  {...register("hours_per_week")}
                />
              </FieldLabel>
            </div>
            <div
              data-field="availability_days"
              style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}
            >
              <FieldLabel
                label="Availability"
                required
                error={errors.availability_days?.message}
                hint="Pick all that apply."
              >
                <div
                  className="apply-grid-2"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 8,
                  }}
                >
                  {(
                    [
                      ["availability_days", "Days"],
                      ["availability_nights", "Nights"],
                      ["availability_weekends", "Weekends"],
                      ["availability_holidays", "Bank holidays"],
                    ] as const
                  ).map(([field, label]) => (
                    <Toggle
                      key={field}
                      checked={!!watch(field)}
                      onChange={(v) => setValue(field, v)}
                      label={label}
                    />
                  ))}
                </div>
              </FieldLabel>
            </div>
            <div className="apply-grid-2" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <Toggle
                checked={!!watch("willing_to_travel")}
                onChange={(v) => setValue("willing_to_travel", v)}
                label="Willing to travel"
              />
              <Toggle
                checked={!!watch("has_transport")}
                onChange={(v) => setValue("has_transport", v)}
                label="I have my own transport"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Toggle
                checked={has_commitments}
                onChange={(v) => setValue("has_commitments", v)}
                label="I have commitments that may affect my availability"
              />
            </div>
            {has_commitments && (
              <div data-field="commitments_details" style={{ gridColumn: "1 / -1" }}>
                <FieldLabel
                  label="Commitments — please describe"
                  required
                  error={errors.commitments_details?.message}
                >
                  <textarea
                    {...register("commitments_details")}
                    style={textareaStyle}
                  />
                </FieldLabel>
              </div>
            )}
          </div>
        </Card>

        {/* Experience & Skills */}
        <Card padding={24}>
          <SectionHeader
            title="Experience & skills"
            subtitle="Optional, but helps us match you to the right role."
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Toggle
              checked={has_security_experience}
              onChange={(v) => setValue("has_security_experience", v)}
              label="I have prior security experience"
            />
            {has_security_experience && (
              <div data-field="security_experience_details">
                <FieldLabel
                  label="Tell us about it"
                  required
                  error={errors.security_experience_details?.message}
                >
                  <textarea
                    {...register("security_experience_details")}
                    style={textareaStyle}
                  />
                </FieldLabel>
              </div>
            )}

            <FieldLabel label="Certifications" hint="Tick any you hold.">
              <div
                className="apply-grid-2"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 8,
                }}
              >
                {CERTIFICATIONS.map((c) => (
                  <Toggle
                    key={c.value}
                    checked={certifications.includes(c.value)}
                    onChange={(checked) =>
                      toggleArrayValue("certifications", c.value, checked)
                    }
                    label={c.label}
                  />
                ))}
              </div>
            </FieldLabel>

            {certifications.includes("other") && (
              <div data-field="other_certification_details">
                <FieldLabel
                  label="Other certifications"
                  required
                  error={errors.other_certification_details?.message}
                >
                  <Input {...register("other_certification_details")} />
                </FieldLabel>
              </div>
            )}
          </div>
        </Card>

        {/* Eligibility & Legal */}
        <Card padding={24}>
          <SectionHeader
            title="Eligibility & legal"
            subtitle="Required for security work in the UK."
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div data-field="eligible_to_work_uk">
              <Toggle
                checked={eligible_to_work_uk}
                onChange={(v) => setValue("eligible_to_work_uk", v)}
                label="I am legally eligible to work in the UK"
              />
              {errors.eligible_to_work_uk && (
                <span
                  style={{
                    fontSize: 12,
                    color: tokens.color.dangerInk,
                    marginTop: 4,
                    display: "block",
                  }}
                >
                  {errors.eligible_to_work_uk.message}
                </span>
              )}
            </div>
            <Toggle
              checked={has_criminal_convictions}
              onChange={(v) => setValue("has_criminal_convictions", v)}
              label="I have unspent criminal convictions"
            />
            {has_criminal_convictions && (
              <div data-field="criminal_convictions_details">
                <FieldLabel
                  label="Please provide details"
                  required
                  error={errors.criminal_convictions_details?.message}
                >
                  <textarea
                    {...register("criminal_convictions_details")}
                    style={textareaStyle}
                  />
                </FieldLabel>
              </div>
            )}
          </div>
        </Card>

        {/* Sign & submit */}
        <Card padding={24}>
          <SectionHeader
            title="Confirm & submit"
            subtitle="Type your full name to sign — this is your digital signature."
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div data-field="terms_accepted">
              <Toggle
                checked={terms_accepted}
                onChange={(v) => setValue("terms_accepted", v)}
                label="I confirm the information I have provided is true and complete, and I consent to it being used to assess my application."
              />
              {errors.terms_accepted && (
                <span
                  style={{
                    fontSize: 12,
                    color: tokens.color.dangerInk,
                    marginTop: 4,
                    display: "block",
                  }}
                >
                  {errors.terms_accepted.message}
                </span>
              )}
            </div>
            <div data-field="digital_signature">
              <FieldLabel
                label="Digital signature"
                required
                error={errors.digital_signature?.message}
                hint="Type your full name as it appears on official documents."
              >
                <Input {...register("digital_signature")} />
              </FieldLabel>
            </div>
            {submitError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: tokens.radius.md,
                  background: tokens.color.dangerSoft,
                  color: tokens.color.dangerInk,
                  fontFamily: tokens.font.body,
                  fontSize: 13,
                }}
              >
                {submitError}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </Shell>
  );
}

// ── Shell (header + centered column) ──────────────────────────────────────

function Shell({
  children,
  company,
}: {
  children: React.ReactNode;
  company?: CompanyInfo | null;
}) {
  const accent = useMemo(
    () => ({
      // Soft branded gradient as a top band — neutral-leaning so it works for any tenant.
      band: `linear-gradient(135deg, ${tokens.color.ink900}, ${tokens.color.ink700})`,
    }),
    [],
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.color.ink50,
        fontFamily: tokens.font.body,
        color: tokens.color.ink900,
      }}
    >
      <style>{MOBILE_CSS}</style>
      <header
        className="apply-shell-header"
        style={{
          background: accent.band,
          color: "white",
          padding: "28px 24px 36px",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: 0.85,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            <Icon name="shield" size={14} />
            Recruitment application
          </div>
          <h1
            className="apply-shell-h1"
            style={{
              margin: 0,
              fontFamily: tokens.font.display,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {company?.name ?? "Apply to join the team"}
          </h1>
          {company?.description && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 14,
                opacity: 0.85,
                maxWidth: 560,
              }}
            >
              {company.description}
            </p>
          )}
          {company && (
            <div style={{ marginTop: 12 }}>
              <Pill tone="info">Public application</Pill>
            </div>
          )}
        </div>
      </header>
      <main
        className="apply-shell-main"
        style={{
          maxWidth: 760,
          margin: "-20px auto 0",
          padding: "0 24px 64px",
          position: "relative",
        }}
      >
        {children}
      </main>
    </div>
  );
}
