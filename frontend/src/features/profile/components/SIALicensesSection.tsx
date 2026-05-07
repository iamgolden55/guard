import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Card,
  Input,
  Modal,
  Pill,
  SectionHeader,
  textStyles,
  tokens,
} from "../../../design-system";
import { type SIALicense, SIALicenseType } from "../../../types";
import { FieldLabel } from "./FieldLabel";
import { KeyValueGrid } from "./KeyValueGrid";

const schema = z
  .object({
    licenseNumber: z.string().trim().min(1, "License number is required"),
    licenseType: z.string().min(1, "License type is required"),
    issueDate: z.string().min(1, "Issue date is required"),
    expiryDate: z.string().min(1, "Expiry date is required"),
  })
  .refine((v) => new Date(v.expiryDate) >= new Date(v.issueDate), {
    path: ["expiryDate"],
    message: "Expiry date must be after the issue date",
  });

type FormValues = z.infer<typeof schema>;

function formatDate(dateString: string) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getLicenseStatus(expiryDate: string): {
  label: string;
  tone: "positive" | "warning" | "danger";
} {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(now.getMonth() + 3);
  if (expiry < now) return { label: "Expired", tone: "danger" };
  if (expiry < threeMonthsFromNow) return { label: "Expiring soon", tone: "warning" };
  return { label: "Valid", tone: "positive" };
}

// The API returns an id alongside the SIALicense fields. The shared SIALicense
// type doesn't surface it, so we widen locally where the id is needed for
// PATCH/DELETE calls.
type WithId = SIALicense & { id?: number | string };

const LICENSE_TYPE_LABELS: Record<string, string> = {
  ds: "Door Supervision",
  sg: "Security Guarding",
  cctv: "CCTV",
  cp: "Close Protection",
  k9: "Dog Handler",
  vs: "Vehicle Security",
  key: "Key Holding",
};

export interface SIALicensesSectionProps {
  licenses: SIALicense[];
  staffProfileId: number;
  onAdd: (data: {
    licenseNumber: string;
    licenseType: string;
    issueDate: string;
    expiryDate: string;
  }) => Promise<void>;
  onUpdate: (
    licenseId: string,
    data: {
      licenseNumber: string;
      licenseType: SIALicenseType;
      issueDate: string;
      expiryDate: string;
    },
  ) => Promise<void>;
  onDelete: (licenseId: string) => Promise<void>;
  isMutating: boolean;
}

export function SIALicensesSection({
  licenses,
  onAdd,
  onUpdate,
  onDelete,
  isMutating,
}: SIALicensesSectionProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WithId | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      licenseNumber: "",
      licenseType: "",
      issueDate: "",
      expiryDate: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              licenseNumber: editing.licenseNumber,
              licenseType: editing.licenseType,
              issueDate: editing.issueDate?.slice(0, 10) ?? "",
              expiryDate: editing.expiryDate?.slice(0, 10) ?? "",
            }
          : { licenseNumber: "", licenseType: "", issueDate: "", expiryDate: "" },
      );
    }
  }, [open, editing, reset]);

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
  };

  const onSubmit = async (values: FormValues) => {
    if (editing) {
      const id =
        editing.id !== undefined ? String(editing.id) : editing.licenseNumber;
      await onUpdate(id, {
        licenseNumber: values.licenseNumber,
        licenseType: values.licenseType as SIALicenseType,
        issueDate: values.issueDate,
        expiryDate: values.expiryDate,
      });
    } else {
      await onAdd(values);
    }
    closeModal();
  };

  const handleDelete = async (license: WithId) => {
    if (!window.confirm("Delete this SIA licence? This action cannot be undone.")) {
      return;
    }
    const id = license.id !== undefined ? String(license.id) : license.licenseNumber;
    await onDelete(id);
  };

  return (
    <>
      <Card padding={24}>
        <SectionHeader
          title="SIA licences"
          subtitle="Required for security work — keep your licences up to date"
          right={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Add licence
            </Button>
          }
        />

        {licenses.length === 0 ? (
          <div style={{ ...textStyles.mute }}>
            No SIA licences added yet. Click <strong>Add licence</strong> to record one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {licenses.map((raw, idx) => {
              const license = raw as WithId;
              const status = getLicenseStatus(license.expiryDate);
              const typeLabel =
                LICENSE_TYPE_LABELS[license.licenseType] ?? license.licenseType;
              return (
                <div
                  key={(license.id ?? license.licenseNumber ?? idx).toString()}
                  style={{
                    border: `1px solid ${tokens.color.ink200}`,
                    borderRadius: tokens.radius.lg,
                    padding: 16,
                    background: tokens.color.ink50,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ ...textStyles.h3, fontSize: 14 }}>{typeLabel}</span>
                      <Pill tone={status.tone} dot>
                        {status.label}
                      </Pill>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditing(license);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(license)}
                        disabled={isMutating}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <KeyValueGrid
                    columns={3}
                    items={[
                      { label: "Licence number", value: license.licenseNumber },
                      { label: "Issue date", value: formatDate(license.issueDate) },
                      { label: "Expiry date", value: formatDate(license.expiryDate) },
                    ]}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? "Edit SIA licence" : "Add SIA licence"}
        description="Provide your SIA licence details so we can verify your eligibility."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={isMutating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit(onSubmit)}
              disabled={!isValid || (editing ? !isDirty : false) || isMutating}
            >
              {isMutating ? "Saving…" : editing ? "Save changes" : "Add licence"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          noValidate
        >
          <FieldLabel
            label="Licence number"
            required
            error={errors.licenseNumber?.message}
            hint={editing ? "Licence number cannot be changed for an existing record." : undefined}
          >
            <Input
              {...register("licenseNumber")}
              type="text"
              disabled={!!editing}
            />
          </FieldLabel>

          <FieldLabel label="Licence type" required error={errors.licenseType?.message}>
            <select
              {...register("licenseType")}
              style={{
                height: 38,
                padding: "0 12px",
                border: `1px solid ${tokens.color.ink200}`,
                borderRadius: tokens.radius.md,
                fontFamily: tokens.font.body,
                fontSize: 13.5,
                background: "white",
                color: tokens.color.ink900,
              }}
            >
              <option value="">Select type…</option>
              {Object.values(SIALicenseType).map((type) => (
                <option key={type} value={type}>
                  {LICENSE_TYPE_LABELS[type] ?? type}
                </option>
              ))}
            </select>
          </FieldLabel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <FieldLabel
              label="Issue date"
              required
              error={errors.issueDate?.message}
            >
              <Input {...register("issueDate")} type="date" />
            </FieldLabel>
            <FieldLabel
              label="Expiry date"
              required
              error={errors.expiryDate?.message}
            >
              <Input {...register("expiryDate")} type="date" />
            </FieldLabel>
          </div>
        </form>
      </Modal>
    </>
  );
}
