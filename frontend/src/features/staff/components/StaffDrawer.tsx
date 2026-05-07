// Staff detail drawer — slide-over with 4 sub-tabs (Profile / SIA / Address /
// Activity). Pattern lifted from features/payroll/components/OfficerDrawer.tsx.
import { useEffect, useState } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Pill } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { useAccent } from "../../../contexts/AccentContext";
import type {
  RecentShiftRecord,
  SIALicenseRecord,
  StaffAddressRecord,
} from "../hooks/useStaffData";
import type { StaffRow } from "./StaffTable";
import { ProfileTab } from "./drawer/ProfileTab";
import { SIALicensesTab } from "./drawer/SIALicensesTab";
import { AddressTab } from "./drawer/AddressTab";
import { ActivityTab } from "./drawer/ActivityTab";

interface SIAFormPayload {
  licenseNumber: string;
  licenseType: string;
  issueDate: string;
  expiryDate: string;
}

export type DrawerTab = "profile" | "sia" | "address" | "activity";

const TABS: { key: DrawerTab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "sia", label: "SIA licences" },
  { key: "address", label: "Address" },
  { key: "activity", label: "Activity" },
];

export interface StaffDrawerProps {
  row: StaffRow | null;
  initialTab?: DrawerTab;
  onClose: () => void;
  /** Parent fetches per-tab data lazily based on which tab is active. */
  onTabChange?: (tab: DrawerTab) => void;
  siaLicenses: SIALicenseRecord[];
  isLoadingSia: boolean;
  address: StaffAddressRecord | null;
  isLoadingAddress: boolean;
  recentShifts: RecentShiftRecord[];
  isLoadingShifts: boolean;
  employmentTypeOptions: string[];
  onUpdateEmploymentType?: (
    userId: number,
    staffProfileId: number | null,
    value: string | null,
  ) => Promise<void>;
  onUpdatePayFrequency?: (
    staffProfileId: number,
    value: "weekly" | "monthly",
  ) => Promise<void>;
  onUpdateAddress?: (
    staffProfileId: number,
    data: Partial<StaffAddressRecord>,
  ) => Promise<void>;
  isSavingAddress: boolean;
  onAddLicense?: (staffProfileId: number, data: SIAFormPayload) => Promise<void>;
  onUpdateLicense?: (
    licenseId: number,
    staffProfileId: number,
    data: { issue_date: string; expiry_date: string; license_type: string },
  ) => Promise<void>;
  onDeleteLicense?: (licenseId: number, staffProfileId: number) => Promise<void>;
  isMutatingLicense: boolean;
  onApprove?: (row: StaffRow) => Promise<void>;
  onDelete?: (row: StaffRow) => Promise<void>;
  isMutating: boolean;
}

export function StaffDrawer({
  row,
  initialTab = "profile",
  onClose,
  onTabChange,
  siaLicenses,
  isLoadingSia,
  address,
  isLoadingAddress,
  recentShifts,
  isLoadingShifts,
  employmentTypeOptions,
  onUpdateEmploymentType,
  onUpdatePayFrequency,
  onUpdateAddress,
  isSavingAddress,
  onAddLicense,
  onUpdateLicense,
  onDeleteLicense,
  isMutatingLicense,
  onApprove,
  onDelete,
  isMutating,
}: StaffDrawerProps) {
  const { palette } = useAccent();
  const [tab, setTab] = useState<DrawerTab>(initialTab);

  // Reset to the parent's preferred initial tab whenever a different row is opened.
  useEffect(() => {
    if (row) setTab(initialTab);
  }, [row, initialTab]);

  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [row, onClose]);

  if (!row) return null;

  const handleTabChange = (next: DrawerTab) => {
    setTab(next);
    onTabChange?.(next);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(32,31,30,0.44)",
          backdropFilter: "blur(3px)",
          zIndex: tokens.z.modal - 1,
        }}
      />
      <div
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(560px, 94vw)",
          background: "white",
          zIndex: tokens.z.modal,
          boxShadow: "-12px 0 48px -16px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${tokens.color.ink200}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <Avatar name={row.fullName} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 18,
                color: tokens.color.ink900,
                letterSpacing: "-0.015em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.fullName}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: tokens.color.ink600,
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.email || "—"}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {row.isPending ? (
                <Pill tone="warning" dot>
                  Pending approval
                </Pill>
              ) : (
                <Pill tone="positive" dot>
                  Active
                </Pill>
              )}
              {row.employmentType && <Pill tone="neutral">{row.employmentType}</Pill>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: tokens.color.ink100,
              border: "none",
              color: tokens.color.ink600,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          style={{
            display: "flex",
            gap: 0,
            padding: "0 24px",
            borderBottom: `1px solid ${tokens.color.ink200}`,
            overflowX: "auto",
          }}
        >
          {TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(t.key)}
                style={{
                  padding: "12px 14px",
                  border: "none",
                  background: "transparent",
                  fontFamily: tokens.font.body,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? palette.primary : tokens.color.ink600,
                  borderBottom: `2px solid ${isActive ? palette.primary : "transparent"}`,
                  marginBottom: -1,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {tab === "profile" && (
            <ProfileTab
              row={row}
              employmentTypeOptions={employmentTypeOptions}
              onUpdateEmploymentType={onUpdateEmploymentType}
              onUpdatePayFrequency={onUpdatePayFrequency}
              onApprove={onApprove}
              onDelete={onDelete}
              isMutating={isMutating}
            />
          )}
          {tab === "sia" && (
            <SIALicensesTab
              licenses={siaLicenses}
              isLoading={isLoadingSia}
              staffProfileId={row.staffProfileId ?? null}
              staffName={row.fullName}
              onAdd={onAddLicense}
              onUpdate={onUpdateLicense}
              onDelete={onDeleteLicense}
              isMutating={isMutatingLicense}
            />
          )}
          {tab === "address" && (
            <AddressTab
              address={address}
              isLoading={isLoadingAddress}
              staffProfileId={row.staffProfileId ?? null}
              onSave={onUpdateAddress}
              isSaving={isSavingAddress}
            />
          )}
          {tab === "activity" && (
            <ActivityTab shifts={recentShifts} isLoading={isLoadingShifts} />
          )}
        </div>
      </div>
    </>
  );
}
