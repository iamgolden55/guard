import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Card,
  Input,
  SectionHeader,
  textStyles,
  tokens,
} from "../../../design-system";
import type { ProfileUpdateRequest, StaffProfile } from "../../../types";
import { AlertBanner } from "./AlertBanner";
import { FieldLabel } from "./FieldLabel";
import { KeyValueGrid } from "./KeyValueGrid";

const baseSchema = z.object({
  phoneNumber: z.string().trim().min(1, "Phone number is required"),
  street: z.string().trim().min(1, "Street is required"),
  city: z.string().trim().min(1, "City is required"),
  postalCode: z.string().trim().min(1, "Postal code is required"),
  country: z.string().trim().min(1, "Country is required"),
  emergencyName: z.string().trim(),
  emergencyRelationship: z.string().trim(),
  emergencyPhone: z.string().trim(),
});

function buildSchema(role: string) {
  return baseSchema.superRefine((vals, ctx) => {
    if (role !== "admin") {
      if (!vals.emergencyName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emergencyName"],
          message: "Emergency contact name is required",
        });
      }
      if (!vals.emergencyRelationship) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emergencyRelationship"],
          message: "Relationship is required",
        });
      }
      if (!vals.emergencyPhone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emergencyPhone"],
          message: "Emergency contact phone is required",
        });
      }
    }
  });
}

type FormValues = z.infer<typeof baseSchema>;

export interface ContactSectionProps {
  profile: StaffProfile;
  onSave: (payload: ProfileUpdateRequest) => Promise<void>;
  isSaving: boolean;
}

export function ContactSection({ profile, onSave, isSaving }: ContactSectionProps) {
  const [editing, setEditing] = useState(false);
  const isAdmin = profile.role === "admin";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(profile.role)),
    defaultValues: {
      phoneNumber: profile.phoneNumber ?? "",
      street: profile.address?.street ?? "",
      city: profile.address?.city ?? "",
      postalCode: profile.address?.postalCode ?? "",
      country: profile.address?.country ?? "",
      emergencyName: profile.emergencyContact?.name ?? "",
      emergencyRelationship: profile.emergencyContact?.relationship ?? "",
      emergencyPhone: profile.emergencyContact?.phoneNumber ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    await onSave({
      phoneNumber: values.phoneNumber,
      address: {
        street: values.street,
        city: values.city,
        postalCode: values.postalCode,
        country: values.country,
      },
      emergencyContact: isAdmin
        ? undefined
        : {
            name: values.emergencyName,
            relationship: values.emergencyRelationship,
            phoneNumber: values.emergencyPhone,
          },
    });
    setEditing(false);
    reset(values);
  };

  return (
    <Card padding={24}>
      <SectionHeader
        title="Contact information"
        subtitle="Phone, address, and emergency contact"
        right={
          !editing ? (
            <Button onClick={() => setEditing(true)} size="sm">
              Edit
            </Button>
          ) : undefined
        }
      />

      {editing ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
          noValidate
        >
          <FieldLabel label="Phone number" required error={errors.phoneNumber?.message}>
            <Input {...register("phoneNumber")} type="tel" autoComplete="tel" />
          </FieldLabel>

          <div>
            <div style={{ ...textStyles.over, marginBottom: 10 }}>Address</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FieldLabel label="Street" required error={errors.street?.message}>
                <Input
                  {...register("street")}
                  type="text"
                  autoComplete="street-address"
                />
              </FieldLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FieldLabel label="City" required error={errors.city?.message}>
                  <Input {...register("city")} type="text" autoComplete="address-level2" />
                </FieldLabel>
                <FieldLabel
                  label="Postal code"
                  required
                  error={errors.postalCode?.message}
                >
                  <Input
                    {...register("postalCode")}
                    type="text"
                    autoComplete="postal-code"
                  />
                </FieldLabel>
              </div>
              <FieldLabel label="Country" required error={errors.country?.message}>
                <Input {...register("country")} type="text" autoComplete="country-name" />
              </FieldLabel>
            </div>
          </div>

          <div>
            <div style={{ ...textStyles.over, marginBottom: 10 }}>Emergency contact</div>
            {isAdmin && (
              <div style={{ marginBottom: 10 }}>
                <AlertBanner tone="info">
                  Emergency contact information is not collected for admin users.
                </AlertBanner>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FieldLabel
                label="Name"
                required={!isAdmin}
                error={errors.emergencyName?.message}
              >
                <Input
                  {...register("emergencyName")}
                  type="text"
                  disabled={isAdmin}
                />
              </FieldLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FieldLabel
                  label="Relationship"
                  required={!isAdmin}
                  error={errors.emergencyRelationship?.message}
                >
                  <Input
                    {...register("emergencyRelationship")}
                    type="text"
                    disabled={isAdmin}
                  />
                </FieldLabel>
                <FieldLabel
                  label="Phone number"
                  required={!isAdmin}
                  error={errors.emergencyPhone?.message}
                >
                  <Input
                    {...register("emergencyPhone")}
                    type="tel"
                    disabled={isAdmin}
                  />
                </FieldLabel>
              </div>
            </div>
          </div>

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
            <Button type="submit" variant="primary" disabled={!isDirty || isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <KeyValueGrid items={[{ label: "Phone number", value: profile.phoneNumber }]} />

          <div>
            <div style={{ ...textStyles.over, marginBottom: 8 }}>Address</div>
            {profile.address?.street ? (
              <div
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 13.5,
                  color: tokens.color.ink900,
                  lineHeight: 1.55,
                }}
              >
                <div>{profile.address.street}</div>
                <div>
                  {profile.address.city}
                  {profile.address.postalCode ? `, ${profile.address.postalCode}` : ""}
                </div>
                <div>{profile.address.country}</div>
              </div>
            ) : (
              <div style={{ ...textStyles.mute }}>No address on file</div>
            )}
          </div>

          <div>
            <div style={{ ...textStyles.over, marginBottom: 8 }}>Emergency contact</div>
            {isAdmin ? (
              <div style={{ ...textStyles.mute }}>
                Not collected for admin users.
              </div>
            ) : profile.emergencyContact?.name ? (
              <div
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 13.5,
                  color: tokens.color.ink900,
                  lineHeight: 1.55,
                }}
              >
                <div>
                  {profile.emergencyContact.name}{" "}
                  <span style={{ color: tokens.color.ink500 }}>
                    ({profile.emergencyContact.relationship})
                  </span>
                </div>
                <div>{profile.emergencyContact.phoneNumber}</div>
              </div>
            ) : (
              <div style={{ ...textStyles.mute }}>No emergency contact on file</div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
