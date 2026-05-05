import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, Input, SectionHeader, textStyles } from "../../../design-system";
import type { ProfileUpdateRequest, StaffProfile } from "../../../types";
import { FieldLabel } from "./FieldLabel";
import { KeyValueGrid } from "./KeyValueGrid";

const schema = z.object({
  accountName: z.string().trim().min(1, "Account name is required"),
  accountNumber: z
    .string()
    .trim()
    .min(6, "Account number is required")
    .max(12, "Account number is too long"),
  sortCode: z.string().trim().min(1, "Sort code is required"),
  bankName: z.string().trim().min(1, "Bank name is required"),
});

type FormValues = z.infer<typeof schema>;

function maskAccount(num?: string) {
  if (!num) return "";
  const last2 = num.slice(-2);
  return `••••••${last2}`;
}

export interface BankDetailsSectionProps {
  profile: StaffProfile;
  onSave: (payload: ProfileUpdateRequest) => Promise<void>;
  isSaving: boolean;
}

export function BankDetailsSection({ profile, onSave, isSaving }: BankDetailsSectionProps) {
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountName: profile.bankDetails?.accountName ?? "",
      accountNumber: profile.bankDetails?.accountNumber ?? "",
      sortCode: profile.bankDetails?.sortCode ?? "",
      bankName: profile.bankDetails?.bankName ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    await onSave({ bankDetails: values });
    setEditing(false);
    reset(values);
  };

  const hasBank = !!profile.bankDetails?.accountNumber;

  return (
    <Card padding={24}>
      <SectionHeader
        title="Bank details"
        subtitle="Used for payroll and reimbursements"
        right={
          !editing ? (
            <Button onClick={() => setEditing(true)} size="sm">
              {hasBank ? "Edit" : "Add bank details"}
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
          <FieldLabel label="Account name" required error={errors.accountName?.message}>
            <Input {...register("accountName")} type="text" autoComplete="cc-name" />
          </FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <FieldLabel
              label="Account number"
              required
              error={errors.accountNumber?.message}
            >
              <Input {...register("accountNumber")} type="text" inputMode="numeric" />
            </FieldLabel>
            <FieldLabel label="Sort code" required error={errors.sortCode?.message}>
              <Input {...register("sortCode")} type="text" placeholder="00-00-00" />
            </FieldLabel>
          </div>
          <FieldLabel label="Bank name" required error={errors.bankName?.message}>
            <Input {...register("bankName")} type="text" />
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
            <Button type="submit" variant="primary" disabled={!isDirty || isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      ) : hasBank ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <KeyValueGrid
            items={[
              { label: "Account name", value: profile.bankDetails.accountName },
              { label: "Bank name", value: profile.bankDetails.bankName },
              {
                label: "Account number",
                value: maskAccount(profile.bankDetails.accountNumber),
              },
              { label: "Sort code", value: profile.bankDetails.sortCode },
            ]}
          />
          <div style={{ ...textStyles.mute, fontSize: 11 }}>
            Bank details are encrypted and used only for payroll processing.
          </div>
        </div>
      ) : (
        <div style={{ ...textStyles.mute }}>
          No bank details on file. Add them to receive payroll payments.
        </div>
      )}
    </Card>
  );
}
