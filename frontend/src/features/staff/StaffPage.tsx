// StaffPage — admin "People → Staff" directory. Composes header + banner +
// 2-col grid (filters/table on the left, right-rail trio on the right) with
// a side drawer for detail and a modal for invitations. Mirrors PayrollPage.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../../design-system/primitives/Card";
import { tokens } from "../../design-system/tokens";
import { InviteStaffModal } from "./components/InviteStaffModal";
import { PendingApprovalBanner } from "./components/PendingApprovalBanner";
import {
  EmploymentMixCard,
  PendingApprovalsCard,
  SIAExpiringCard,
} from "./components/RightRailCards";
import { type DrawerTab, StaffDrawer } from "./components/StaffDrawer";
import { StaffFilterBar } from "./components/StaffFilterBar";
import { StaffHeader } from "./components/StaffHeader";
import { type StaffRow, StaffTable } from "./components/StaffTable";
import { type StaffTabKey, StaffTabs } from "./components/StaffTabs";
import { useStaffData } from "./hooks/useStaffData";
import type { PendingStaffProfile } from "./hooks/useStaffData";

function isAdmin(
  role: string | undefined,
  membershipRole: string | undefined,
): boolean {
  const r = (role ?? "").toLowerCase();
  const m = (membershipRole ?? "").toLowerCase();
  return r === "admin" || m === "admin" || m === "owner";
}

function fullNameFromStaffUser(s: {
  full_name: string;
  first_name: string;
  last_name: string;
  username: string;
}): string {
  return (
    s.full_name ||
    `${s.first_name} ${s.last_name}`.trim() ||
    s.username ||
    "Unnamed"
  );
}

// Backend serializes `employment_type` as a related object
// ({id, name, description, ...}), not a string. Normalize to a display name.
function employmentTypeName(et: unknown): string | null {
  if (et == null) return null;
  if (typeof et === "string") return et;
  if (typeof et === "object" && "name" in (et as Record<string, unknown>)) {
    const v = (et as { name?: unknown }).name;
    return typeof v === "string" ? v : null;
  }
  return null;
}

function fullNameFromPending(p: PendingStaffProfile): string {
  if (p.full_name) return p.full_name;
  return (
    `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
    p.username ||
    "Unnamed"
  );
}

export default function StaffPage() {
  const { authState } = useAuth();
  const userRole = authState.user?.role;
  const membershipRole = authState.currentMembership?.role;

  const [tab, setTab] = useState<StaffTabKey>("active");
  const [search, setSearch] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState("");
  const [selectedRow, setSelectedRow] = useState<StaffRow | null>(null);
  const [initialDrawerTab, setInitialDrawerTab] =
    useState<DrawerTab>("profile");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("profile");
  const [inviteOpen, setInviteOpen] = useState(false);
  // Tracks the last user we resent an invite to so the button shows "Sent ✓"
  // briefly before reverting to "Resend invite".
  const [recentlyResentId, setRecentlyResentId] = useState<number | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const data = useStaffData({
    selectedStaffId: selectedRow?.staffProfileId ?? null,
    selectedUserId: selectedRow?.id ?? null,
    fetchSelectedSia: !!selectedRow && drawerTab === "sia",
    fetchSelectedProfile: !!selectedRow && drawerTab === "address",
    fetchSelectedShifts: !!selectedRow && drawerTab === "activity",
  });

  // ── View-model: normalize active + pending into StaffRow[] ────────────────
  const activeRows = useMemo<StaffRow[]>(
    () =>
      data.active.map((s) => ({
        id: s.id,
        staffProfileId: s.staff_profile_id ?? undefined,
        fullName: fullNameFromStaffUser(s),
        email: s.email,
        employmentType: employmentTypeName(s.employment_type),
        payFrequency: s.pay_frequency ?? "weekly",
        joined: null, // StaffUser doesn't expose created_at; flagged in plan
        isPending: false,
      })),
    [data.active],
  );

  const pendingRows = useMemo<StaffRow[]>(
    () =>
      data.pending.map((p) => ({
        id: p.id,
        staffProfileId: p.id,
        fullName: fullNameFromPending(p),
        email: p.email ?? "",
        employmentType: employmentTypeName(p.employment_type),
        payFrequency: "weekly" as const,
        joined: p.created_at ?? null,
        isPending: true,
      })),
    [data.pending],
  );

  // Re-derive the drawer's row from the latest active/pending lists each time
  // they refresh, so optimistic mutations (employment type, pay frequency, …)
  // surface immediately without the user having to refresh the page.
  const currentRow = useMemo<StaffRow | null>(() => {
    if (!selectedRow) return null;
    const fresh =
      activeRows.find((r) => r.id === selectedRow.id && !selectedRow.isPending) ??
      pendingRows.find((r) => r.id === selectedRow.id && selectedRow.isPending);
    return fresh ?? selectedRow;
  }, [selectedRow, activeRows, pendingRows]);

  // ── Filters: apply search + employment-type to whichever tab is selected ──
  // Prefer the live employment-types catalogue (so newly-added types are
  // selectable even before any staff use them); fall back to scraping the
  // active list while it's loading.
  const employmentTypeOptions = useMemo(() => {
    if (data.employmentTypes.length > 0) {
      return data.employmentTypes.map((et) => et.name).sort();
    }
    const set = new Set<string>();
    for (const s of data.active) {
      const name = employmentTypeName(s.employment_type);
      if (name) set.add(name);
    }
    return Array.from(set).sort();
  }, [data.active, data.employmentTypes]);

  const filteredRows = useMemo(() => {
    const base = tab === "active" ? activeRows : pendingRows;
    const q = search.trim().toLowerCase();
    return base.filter((row) => {
      if (
        q &&
        !row.fullName.toLowerCase().includes(q) &&
        !row.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (employmentFilter && row.employmentType !== employmentFilter)
        return false;
      return true;
    });
  }, [tab, activeRows, pendingRows, search, employmentFilter]);

  // ── Map staff_profile → display name (used by SIAExpiringCard) ────────────
  const staffNameByProfileId = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of activeRows) {
      if (r.staffProfileId != null) m.set(r.staffProfileId, r.fullName);
    }
    for (const r of pendingRows) {
      if (r.staffProfileId != null) m.set(r.staffProfileId, r.fullName);
    }
    return m;
  }, [activeRows, pendingRows]);

  // ── Map staff_profile → licenses (for the SIA pill on each row) ───────────
  const licensesByStaffProfile = useMemo(() => {
    const m = new Map<number, typeof data.allLicenses>();
    for (const lic of data.allLicenses) {
      const arr = m.get(lic.staff_profile) ?? [];
      arr.push(lic);
      m.set(lic.staff_profile, arr);
    }
    return m;
  }, [data.allLicenses]);

  const expiringSoonCount = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return data.allLicenses.filter((lic) => {
      const t = new Date(lic.expiry_date).getTime();
      if (Number.isNaN(t)) return false;
      const ms = t - now;
      return ms <= thirtyDays;
    }).length;
  }, [data.allLicenses]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openRow = (row: StaffRow, atTab: DrawerTab = "profile") => {
    setInitialDrawerTab(atTab);
    setDrawerTab(atTab);
    setSelectedRow(row);
  };

  // Honour ?focus=<id> from the topbar search palette: open the matching
  // row's drawer and strip the param so refreshes don't re-open it.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  // biome-ignore lint/correctness/useExhaustiveDependencies: openRow is stable per render
  useEffect(() => {
    if (!focusId) return;
    const id = Number(focusId);
    if (!Number.isFinite(id)) return;
    const row =
      activeRows.find((r) => r.id === id) ??
      pendingRows.find((r) => r.id === id);
    if (!row) return;
    setTab(row.isPending ? "pending" : "active");
    openRow(row, "profile");
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  }, [focusId, activeRows, pendingRows, searchParams, setSearchParams]);

  const handleApprove = async (row: StaffRow) => {
    await data.approveStaff.mutateAsync(row.id);
    if (selectedRow?.id === row.id) setSelectedRow(null);
  };

  const handleResendInvite = async (row: StaffRow) => {
    setResendError(null);
    try {
      await data.resendInvite.mutateAsync(row.id);
      setRecentlyResentId(row.id);
      window.setTimeout(() => {
        setRecentlyResentId((current) => (current === row.id ? null : current));
      }, 4000);
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: unknown } } | undefined)?.response?.data;
      const message =
        errData && typeof errData === "object" && !Array.isArray(errData) && "error" in errData
          ? String((errData as { error: unknown }).error)
          : "Couldn't resend invite. Try again in a moment.";
      setResendError(`${row.fullName}: ${message}`);
      window.setTimeout(() => setResendError(null), 6000);
    }
  };

  const handleDelete = async (row: StaffRow) => {
    await data.deleteStaff.mutateAsync(row.id);
    if (selectedRow?.id === row.id) setSelectedRow(null);
  };

  const handleUnlockAccount = async (row: StaffRow) => {
    return data.unlockAccount.mutateAsync(row.id);
  };

  const handleUpdateEmployment = async (
    userId: number,
    staffProfileId: number | null,
    employmentType: string | null,
  ) => {
    await data.updateEmploymentType.mutateAsync({
      userId,
      staffProfileId,
      employmentType,
    });
  };

  const handleUpdatePayFrequency = async (
    staffProfileId: number,
    payFrequency: "weekly" | "monthly",
  ) => {
    await data.updatePayFrequency.mutateAsync({ staffProfileId, payFrequency });
  };

  const handleReviewPending = (profile: PendingStaffProfile) => {
    const row = pendingRows.find((r) => r.id === profile.id);
    if (row) {
      setTab("pending");
      openRow(row, "profile");
    }
  };

  const handleSelectExpiring = (staffProfileId: number) => {
    const row =
      activeRows.find((r) => r.staffProfileId === staffProfileId) ??
      pendingRows.find((r) => r.staffProfileId === staffProfileId);
    if (row) openRow(row, "sia");
  };

  const handleUpdateAddress = async (
    staffProfileId: number,
    addressPatch: Partial<{
      street: string;
      city: string;
      postal_code: string;
      country: string;
    }>,
  ) => {
    await data.updateStaffAddress.mutateAsync({
      staffProfileId,
      data: addressPatch,
    });
  };

  const handleAddLicense = async (
    staffProfileId: number,
    payload: {
      licenseNumber: string;
      licenseType: string;
      issueDate: string;
      expiryDate: string;
    },
  ) => {
    await data.addStaffLicense.mutateAsync({ staffProfileId, data: payload });
  };

  const handleUpdateLicense = async (
    licenseId: number,
    staffProfileId: number,
    payload: { issue_date: string; expiry_date: string; license_type: string },
  ) => {
    await data.updateStaffLicense.mutateAsync({
      licenseId,
      staffProfileId,
      data: payload,
    });
  };

  const handleDeleteLicense = async (
    licenseId: number,
    staffProfileId: number,
  ) => {
    await data.deleteStaffLicense.mutateAsync({ licenseId, staffProfileId });
  };

  // ── Permission gate (admin-only for v1) ───────────────────────────────────
  if (!isAdmin(userRole, membershipRole)) {
    return (
      <>
        <StaffHeader
          activeCount={0}
          pendingCount={0}
          expiringSiaCount={0}
          onInvite={() => undefined}
        />
        <main
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 28,
            background: tokens.color.ink50,
          }}
        >
          <Card padding={32}>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 18,
                color: tokens.color.ink900,
                marginBottom: 6,
              }}
            >
              Admins only
            </div>
            <div
              style={{
                fontFamily: tokens.font.body,
                fontSize: 13,
                color: tokens.color.ink600,
              }}
            >
              The staff directory is available to admin users. Speak to your
              team owner if you need access.
            </div>
          </Card>
        </main>
      </>
    );
  }

  const counts = { active: activeRows.length, pending: pendingRows.length };

  const isMutating =
    data.approveStaff.isPending ||
    data.deleteStaff.isPending ||
    data.updateEmploymentType.isPending;

  return (
    <>
      <StaffHeader
        activeCount={counts.active}
        pendingCount={counts.pending}
        expiringSiaCount={expiringSoonCount}
        onInvite={() => setInviteOpen(true)}
      />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          background: tokens.color.ink50,
        }}
      >
        <PendingApprovalBanner
          count={counts.pending}
          onReview={() => setTab("pending")}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 340px",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              minWidth: 0,
            }}
          >
            <StaffTabs active={tab} counts={counts} onChange={setTab} />
            <StaffFilterBar
              search={search}
              onSearchChange={setSearch}
              employmentType={employmentFilter}
              onEmploymentTypeChange={setEmploymentFilter}
              employmentTypeOptions={employmentTypeOptions}
              resultCount={filteredRows.length}
            />
            {resendError && (
              <div
                role="alert"
                style={{
                  background: tokens.color.dangerSoft,
                  color: tokens.color.dangerInk,
                  border: `1px solid ${tokens.color.danger}33`,
                  borderRadius: tokens.radius.md,
                  padding: "10px 12px",
                  fontFamily: tokens.font.body,
                  fontSize: 13,
                }}
              >
                {resendError}
              </div>
            )}
            <StaffTable
              rows={filteredRows}
              licensesByStaffProfile={licensesByStaffProfile}
              onRowClick={(row) => openRow(row, "profile")}
              onApprove={(row) => void handleApprove(row)}
              approvingId={
                data.approveStaff.isPending
                  ? ((data.approveStaff.variables as number | undefined) ??
                    null)
                  : null
              }
              onResendInvite={(row) => void handleResendInvite(row)}
              resendingId={
                data.resendInvite.isPending
                  ? ((data.resendInvite.variables as number | undefined) ??
                    null)
                  : null
              }
              resentId={recentlyResentId}
              isLoading={data.isLoading}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PendingApprovalsCard
              pending={data.pending}
              onReview={handleReviewPending}
            />
            <SIAExpiringCard
              staffNameByProfileId={staffNameByProfileId}
              licenses={data.allLicenses}
              onSelect={handleSelectExpiring}
            />
            <EmploymentMixCard staff={data.active} />
          </div>
        </div>

        <div style={{ height: 24 }} />
      </main>

      <StaffDrawer
        row={currentRow}
        initialTab={initialDrawerTab}
        onClose={() => setSelectedRow(null)}
        onTabChange={setDrawerTab}
        siaLicenses={data.selectedSiaLicenses}
        isLoadingSia={data.isLoadingSelectedSia}
        address={data.selectedAddress}
        isLoadingAddress={data.isLoadingSelectedAddress}
        recentShifts={data.selectedShifts}
        isLoadingShifts={data.isLoadingSelectedShifts}
        employmentTypeOptions={employmentTypeOptions}
        onUpdateEmploymentType={handleUpdateEmployment}
        onUpdatePayFrequency={handleUpdatePayFrequency}
        onUpdateAddress={handleUpdateAddress}
        isSavingAddress={data.updateStaffAddress.isPending}
        onAddLicense={handleAddLicense}
        onUpdateLicense={handleUpdateLicense}
        onDeleteLicense={handleDeleteLicense}
        isMutatingLicense={
          data.addStaffLicense.isPending ||
          data.updateStaffLicense.isPending ||
          data.deleteStaffLicense.isPending
        }
        onApprove={handleApprove}
        onDelete={handleDelete}
        onUnlockAccount={handleUnlockAccount}
        isUnlockingAccount={data.unlockAccount.isPending}
        isMutating={isMutating}
      />

      <InviteStaffModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSubmit={(payload) =>
          data.inviteStaff.mutateAsync(payload).then(() => undefined)
        }
        isSubmitting={data.inviteStaff.isPending}
      />
    </>
  );
}
