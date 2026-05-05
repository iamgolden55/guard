import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, Input, SectionHeader } from "../../../design-system";
import type { ProfileUpdateRequest, StaffProfile } from "../../../types";
import { FieldLabel } from "./FieldLabel";
import { KeyValueGrid } from "./KeyValueGrid";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Invalid email format"),
});

type FormValues = z.infer<typeof schema>;

function formatDate(dateString?: string) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export interface PersonalDetailsSectionProps {
  profile: StaffProfile;
  onSave: (payload: ProfileUpdateRequest) => Promise<void>;
  isSaving: boolean;
}

export function PersonalDetailsSection({
  profile,
  onSave,
  isSaving,
}: PersonalDetailsSectionProps) {
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      email: profile.email ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    await onSave(values);
    setEditing(false);
    reset(values);
  };

  return (
    <Card padding={24}>
      <SectionHeader
        title="Personal information"
        subtitle="Your name and login email"
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
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          noValidate
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <FieldLabel label="First name" required error={errors.firstName?.message}>
              <Input {...register("firstName")} type="text" autoComplete="given-name" />
            </FieldLabel>
            <FieldLabel label="Last name" required error={errors.lastName?.message}>
              <Input {...register("lastName")} type="text" autoComplete="family-name" />
            </FieldLabel>
          </div>
          <FieldLabel label="Email" required error={errors.email?.message}>
            <Input {...register("email")} type="email" autoComplete="email" />
          </FieldLabel>

          <FieldLabel
            label="National Insurance number"
            hint="Cannot be changed for security reasons."
          >
            <Input value={profile.nationalInsuranceNumber ?? ""} disabled readOnly />
          </FieldLabel>

          <FieldLabel
            label="Date of birth"
            hint="Cannot be changed for security reasons."
          >
            <Input
              type="text"
              value={profile.dateOfBirth ? formatDate(profile.dateOfBirth) : ""}
              disabled
              readOnly
            />
          </FieldLabel>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
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
        <KeyValueGrid
          items={[
            { label: "First name", value: profile.firstName },
            { label: "Last name", value: profile.lastName },
            { label: "Email", value: profile.email },
            { label: "National Insurance number", value: profile.nationalInsuranceNumber },
            {
              label: "Date of birth",
              value: profile.dateOfBirth ? formatDate(profile.dateOfBirth) : "",
            },
            { label: "Username", value: profile.username },
          ]}
        />
      )}
    </Card>
  );
}
