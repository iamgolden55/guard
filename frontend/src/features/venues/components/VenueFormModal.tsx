import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../../design-system/primitives/Button";
import { Input } from "../../../design-system/primitives/Input";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { Venue } from "../../../types/venue";
import { AddressAutocomplete } from "./AddressAutocomplete";
import type { MapboxRetrieved } from "../../../services/mapboxGeocoding";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  description: z.string().trim(),
  address: z.string().trim().min(1, "Street address is required"),
  city: z.string().trim().min(1, "City is required"),
  postal_code: z.string().trim().min(1, "Postal code is required"),
  country: z.string().trim().min(1, "Country is required"),
  latitude: z.string().trim(),
  longitude: z.string().trim(),
  capacity: z
    .string()
    .trim()
    .min(1, "Capacity is required")
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, {
      message: "Capacity must be greater than zero",
    }),
  contact_name: z.string().trim().min(1, "Contact name is required"),
  contact_email: z
    .string()
    .trim()
    .min(1, "Contact email is required")
    .refine((v) => /\S+@\S+\.\S+/.test(v), {
      message: "Enter a valid email",
    }),
  contact_phone: z.string().trim().min(1, "Contact phone is required"),
  requires_fire_safety_checks: z.boolean(),
  requires_capacity_monitoring: z.boolean(),
  requires_toilet_checks: z.boolean(),
  terms_version: z.string().trim(),
  terms_and_conditions: z.string().trim().min(1, "Terms & conditions are required"),
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

function venueToValues(venue: Venue | null): FormValues {
  return {
    name: venue?.name ?? "",
    description: venue?.description ?? "",
    address: venue?.address ?? "",
    city: venue?.city ?? "",
    postal_code: venue?.postal_code ?? "",
    country: venue?.country ?? "United Kingdom",
    latitude: venue?.latitude != null ? String(venue.latitude) : "",
    longitude: venue?.longitude != null ? String(venue.longitude) : "",
    capacity: venue?.capacity != null ? String(venue.capacity) : "",
    contact_name: venue?.contact_name ?? "",
    contact_email: venue?.contact_email ?? "",
    contact_phone: venue?.contact_phone ?? "",
    requires_fire_safety_checks: venue?.requires_fire_safety_checks ?? false,
    requires_capacity_monitoring: venue?.requires_capacity_monitoring ?? false,
    requires_toilet_checks: venue?.requires_toilet_checks ?? false,
    terms_version: venue?.terms_version ?? "",
    terms_and_conditions: venue?.terms_and_conditions ?? "",
  };
}

function valuesToVenue(values: FormValues, existing: Venue | null): Venue {
  const lat = values.latitude.trim();
  const lng = values.longitude.trim();
  const cap = values.capacity.trim();
  return {
    id: existing?.id,
    name: values.name.trim(),
    description: values.description.trim(),
    address: values.address.trim(),
    city: values.city.trim(),
    postal_code: values.postal_code.trim(),
    country: values.country.trim(),
    is_active: existing?.is_active ?? true,
    capacity: cap === "" ? 0 : Number(cap),
    contact_name: values.contact_name.trim(),
    contact_email: values.contact_email.trim(),
    contact_phone: values.contact_phone.trim(),
    requires_fire_safety_checks: values.requires_fire_safety_checks,
    requires_capacity_monitoring: values.requires_capacity_monitoring,
    requires_toilet_checks: values.requires_toilet_checks,
    terms_version: values.terms_version.trim() || undefined,
    terms_and_conditions: values.terms_and_conditions,
    latitude: lat === "" ? undefined : Number(lat),
    longitude: lng === "" ? undefined : Number(lng),
  };
}

export interface VenueFormModalProps {
  open: boolean;
  venue: Venue | null;
  onClose: () => void;
  onSubmit: (venue: Venue) => Promise<void>;
  isSubmitting: boolean;
}

export function VenueFormModal({
  open,
  venue,
  onClose,
  onSubmit,
  isSubmitting,
}: VenueFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEdit = venue != null;

  const defaults = useMemo(() => venueToValues(venue), [venue]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    else setSubmitError(null);
  }, [open, defaults, reset]);

  const fire = watch("requires_fire_safety_checks");
  const capacityCheck = watch("requires_capacity_monitoring");
  const toilet = watch("requires_toilet_checks");

  const handleAddressSelected = (result: MapboxRetrieved) => {
    setValue("address", result.address, { shouldDirty: true, shouldValidate: true });
    if (result.city) {
      setValue("city", result.city, { shouldDirty: true, shouldValidate: true });
    }
    if (result.postcode) {
      setValue("postal_code", result.postcode, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (result.country) {
      setValue("country", result.country, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (Number.isFinite(result.latitude)) {
      setValue("latitude", String(result.latitude), { shouldDirty: true });
    }
    if (Number.isFinite(result.longitude)) {
      setValue("longitude", String(result.longitude), { shouldDirty: true });
    }
  };

  const submit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await onSubmit(valuesToVenue(values, venue));
      onClose();
    } catch (err: unknown) {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        const knownKeys: (keyof FormValues)[] = [
          "name",
          "description",
          "address",
          "city",
          "postal_code",
          "country",
          "latitude",
          "longitude",
          "capacity",
          "contact_name",
          "contact_email",
          "contact_phone",
          "terms_version",
          "terms_and_conditions",
        ];
        const unmatched: string[] = [];
        for (const [key, msg] of Object.entries(fieldErrors)) {
          if ((knownKeys as string[]).includes(key)) {
            setError(key as keyof FormValues, { type: "server", message: msg });
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
        setSubmitError(
          isEdit ? "Couldn't save changes. Please try again." : "Couldn't create the venue. Please try again.",
        );
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit venue" : "New venue"}
      description={
        isEdit
          ? `Update details for ${venue?.name ?? "this venue"}.`
          : "Add a new venue. Fields marked * are required."
      }
      size="lg"
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
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create venue"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(submit)}
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
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

        <Section title="Identity">
          <Field label="Name" required error={errors.name?.message}>
            <Input {...register("name")} placeholder="Venue display name" />
          </Field>
          <Field
            label="Description"
            hint="Short description shown to schedulers."
          >
            <textarea
              {...register("description")}
              rows={2}
              style={textareaStyle}
              placeholder="What is this venue used for?"
            />
          </Field>
        </Section>

        <Section
          title="Address"
          subtitle="Search a postcode or address to auto-fill all fields, or edit them manually."
        >
          <Field label="Find address">
            <AddressAutocomplete onSelect={handleAddressSelected} />
          </Field>
          <Field label="Street address" required error={errors.address?.message}>
            <Input
              {...register("address")}
              placeholder="123 High Street"
              autoComplete="street-address"
            />
          </Field>
          <Grid3>
            <Field label="City" required error={errors.city?.message}>
              <Input
                {...register("city")}
                autoComplete="address-level2"
              />
            </Field>
            <Field
              label="Postal code"
              required
              error={errors.postal_code?.message}
            >
              <Input
                {...register("postal_code")}
                autoComplete="postal-code"
              />
            </Field>
            <Field label="Country" required error={errors.country?.message}>
              <Input
                {...register("country")}
                autoComplete="country-name"
              />
            </Field>
          </Grid3>
        </Section>

        <Section
          title="GPS location"
          subtitle="Used for officer check-in and geofence checks."
        >
          <Grid2>
            <Field
              label="Latitude"
              hint="-90 to 90"
              error={errors.latitude?.message}
            >
              <Input
                {...register("latitude")}
                placeholder="51.5074"
                inputMode="decimal"
              />
            </Field>
            <Field
              label="Longitude"
              hint="-180 to 180"
              error={errors.longitude?.message}
            >
              <Input
                {...register("longitude")}
                placeholder="-0.1278"
                inputMode="decimal"
              />
            </Field>
          </Grid2>
        </Section>

        <Section title="Capacity & contact">
          <Grid2>
            <Field label="Capacity" required error={errors.capacity?.message}>
              <Input
                {...register("capacity")}
                placeholder="200"
                inputMode="numeric"
              />
            </Field>
            <Field label="Contact name" required error={errors.contact_name?.message}>
              <Input {...register("contact_name")} autoComplete="name" />
            </Field>
            <Field label="Contact email" required error={errors.contact_email?.message}>
              <Input
                {...register("contact_email")}
                type="email"
                autoComplete="email"
              />
            </Field>
            <Field label="Contact phone" required error={errors.contact_phone?.message}>
              <Input
                {...register("contact_phone")}
                type="tel"
                autoComplete="tel"
              />
            </Field>
          </Grid2>
        </Section>

        <Section title="Compliance requirements">
          <Toggle
            label="Fire-safety checks"
            description="Officers must complete a fire-safety walkthrough each shift."
            checked={fire}
            onChange={(v) => setValue("requires_fire_safety_checks", v, { shouldDirty: true })}
          />
          <Toggle
            label="Capacity monitoring"
            description="Officers track headcount throughout the shift."
            checked={capacityCheck}
            onChange={(v) => setValue("requires_capacity_monitoring", v, { shouldDirty: true })}
          />
          <Toggle
            label="Toilet checks"
            description="Officers complete periodic toilet checks during the shift."
            checked={toilet}
            onChange={(v) => setValue("requires_toilet_checks", v, { shouldDirty: true })}
          />
        </Section>

        <Section title="Terms & conditions">
          <Field label="Version" hint="Optional.">
            <Input {...register("terms_version")} placeholder="v1.0" />
          </Field>
          <Field
            label="Terms text"
            required
            error={errors.terms_and_conditions?.message}
          >
            <textarea
              {...register("terms_and_conditions")}
              rows={4}
              style={textareaStyle}
              placeholder="Any venue-specific terms officers must accept."
            />
          </Field>
        </Section>
      </form>
    </Modal>
  );
}

const textareaStyle: React.CSSProperties = {
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
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 13,
            color: tokens.color.ink900,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 11.5,
              color: tokens.color.ink500,
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
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
        {required && <span style={{ color: tokens.color.danger, marginLeft: 4 }}>*</span>}
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

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Grid3({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 12px",
        borderRadius: tokens.radius.md,
        background: checked ? tokens.color.successSoft : tokens.color.ink50,
        border: `1px solid ${
          checked ? `${tokens.color.success}33` : tokens.color.ink200
        }`,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 30,
          height: 18,
          borderRadius: 9,
          background: checked ? tokens.color.success : tokens.color.ink400,
          position: "relative",
          flexShrink: 0,
          transition: `background ${tokens.motion.fast}`,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 14 : 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: "white",
            transition: `left ${tokens.motion.fast}`,
            boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          }}
        />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 13,
            fontWeight: 600,
            color: tokens.color.ink900,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 11.5,
            color: tokens.color.ink600,
          }}
        >
          {description}
        </div>
      </div>
    </button>
  );
}
