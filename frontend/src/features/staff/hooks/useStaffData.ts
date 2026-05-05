// Staff directory data layer — TanStack Query against userService + profileService.
//
// Queries
//   ["staff","active"]         — userService.getStaffUsers()           (StaffUser[])
//   ["staff","pending"]        — profileService.getPendingStaffProfiles() (raw API shape)
//   ["staff", id, "sia"]       — lazy per-staff license list           (SIALicense[])
//   ["sia-licenses","all"]     — single GET on /api/v1/sia-licenses/   (drives SIAExpiringCard)
//
// Mutations
//   approveStaff               — optimistic remove from pending, invalidate active
//   deleteStaff                — optimistic remove from active
//   inviteStaff                — invalidate active on success
//   updateEmploymentType       — optimistic merge into active
//
// All cache writes are followed by `invalidateQueries` in onSettled so server
// reality wins after the round-trip.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../services/api";
import {
  employmentTypeService,
  type EmploymentType,
} from "../../../services/employmentTypeService";
import profileService from "../../../services/profileService";
import shiftService from "../../../services/shiftService";
import userService, {
  type StaffUser,
  type User,
} from "../../../services/userService";

// Pending profile shape — `profileService.getPendingStaffProfiles()` is
// untyped; we model the fields the directory consumes. Anything the backend
// returns beyond this list passes through harmlessly.
export interface PendingStaffProfile {
  id: number;
  user?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  full_name?: string;
  employment_type?: string | null;
  created_at?: string;
  is_approved?: boolean;
}

// Single shape used by the SIAExpiringCard + drawer SIA tab. The /sia-licenses/
// list endpoint returns Django-shaped license records.
export interface SIALicenseRecord {
  id: number;
  staff_profile: number;
  license_number: string;
  license_type: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  document_url?: string | null;
}

// Subset of StaffProfileSerializer used by the drawer's Address tab.
export interface StaffAddressRecord {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

// Subset of /api/v1/shifts/?staff=N used by the drawer's Activity tab.
export interface RecentShiftRecord {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  venue_name: string;
}

const ACTIVE_KEY = ["staff", "active"] as const;
const PENDING_KEY = ["staff", "pending"] as const;
const LICENSES_ALL_KEY = ["sia-licenses", "all"] as const;
const EMPLOYMENT_TYPES_KEY = ["employment-types", "active"] as const;

export interface InviteStaffPayload {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role?: string;
}

export interface UseStaffDataOptions {
  /** Pass the currently-open staff_profile.id so the SIA + address queries can lazy-fire. */
  selectedStaffId?: number | null;
  /** Pass the currently-open user.id so the recent-shifts query can lazy-fire. */
  selectedUserId?: number | null;
  /** Only fetch the per-staff SIA list when the drawer's SIA tab is open. */
  fetchSelectedSia?: boolean;
  /** Only fetch the per-staff address when the drawer's Address tab is open. */
  fetchSelectedProfile?: boolean;
  /** Only fetch recent shifts when the drawer's Activity tab is open. */
  fetchSelectedShifts?: boolean;
}

export function useStaffData(options: UseStaffDataOptions = {}) {
  const queryClient = useQueryClient();
  const {
    selectedStaffId = null,
    selectedUserId = null,
    fetchSelectedSia = false,
    fetchSelectedProfile = false,
    fetchSelectedShifts = false,
  } = options;

  const activeQuery = useQuery<StaffUser[]>({
    queryKey: ACTIVE_KEY,
    queryFn: () => userService.getStaffUsers(),
  });

  // Active employment-type catalogue — drives the drawer's dropdown and the
  // name→id lookup that updateEmploymentType needs. Endpoint may return either
  // a raw array or a paginated {results} envelope.
  const employmentTypesQuery = useQuery<EmploymentType[]>({
    queryKey: EMPLOYMENT_TYPES_KEY,
    queryFn: async () => {
      const data = await employmentTypeService.getActiveEmploymentTypes();
      if (Array.isArray(data)) return data;
      const envelope = data as { results?: EmploymentType[] } | undefined;
      return envelope?.results ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const pendingQuery = useQuery<PendingStaffProfile[]>({
    queryKey: PENDING_KEY,
    queryFn: async () => {
      const data = await profileService.getPendingStaffProfiles();
      // Endpoint may return either a raw array or a paginated {results} envelope.
      if (Array.isArray(data)) return data as PendingStaffProfile[];
      const envelope = data as { results?: PendingStaffProfile[] } | undefined;
      return envelope?.results ?? [];
    },
  });

  // Single GET for all licenses — drives SIAExpiringCard and could later drive
  // a per-row SIA pill in StaffTable. The backend may paginate; we accept the
  // first page only in v1 (and flag a follow-up if seed data exceeds it).
  const allLicensesQuery = useQuery<SIALicenseRecord[]>({
    queryKey: LICENSES_ALL_KEY,
    queryFn: async () => {
      const response = await api.get("/api/v1/sia-licenses/");
      const body = response.data as
        | SIALicenseRecord[]
        | { results?: SIALicenseRecord[] };
      return Array.isArray(body) ? body : (body.results ?? []);
    },
  });

  // Per-staff SIA — only fires when the drawer's SIA tab is open for a known id.
  const selectedSiaQuery = useQuery<SIALicenseRecord[]>({
    queryKey: ["staff", selectedStaffId, "sia"],
    queryFn: async () => {
      if (selectedStaffId == null) return [];
      const list = await profileService.getSIALicensesByProfile(selectedStaffId);
      return list as SIALicenseRecord[];
    },
    enabled: fetchSelectedSia && selectedStaffId != null,
  });

  // Per-staff profile — fires when the drawer's Address tab is open. The
  // /staff-profiles/{id}/ endpoint already exposes street/city/postal_code/country.
  const selectedProfileQuery = useQuery<StaffAddressRecord | null>({
    queryKey: ["staff", selectedStaffId, "profile"],
    queryFn: async () => {
      if (selectedStaffId == null) return null;
      const data = (await profileService.getStaffProfileById(
        selectedStaffId,
      )) as Partial<StaffAddressRecord> | null;
      if (!data) return null;
      return {
        street: data.street ?? "",
        city: data.city ?? "",
        postal_code: data.postal_code ?? "",
        country: data.country ?? "",
      };
    },
    enabled: fetchSelectedProfile && selectedStaffId != null,
  });

  // Per-staff recent shifts — fires when the drawer's Activity tab is open.
  // Shift FK is on user, not staff_profile, so we key by user.id.
  const selectedShiftsQuery = useQuery<RecentShiftRecord[]>({
    queryKey: ["staff", selectedUserId, "shifts"],
    queryFn: async () => {
      if (selectedUserId == null) return [];
      const shifts = (await shiftService.getShifts(selectedUserId)) as unknown as Array<
        Record<string, unknown>
      >;
      return shifts
        .map((s) => {
          const venueDetails =
            (s.venue_details as Record<string, unknown> | null | undefined) ?? null;
          const venueName =
            typeof venueDetails?.name === "string"
              ? (venueDetails.name as string)
              : typeof s.venue_name === "string"
                ? (s.venue_name as string)
                : "";
          return {
            id: Number(s.id),
            start_time: String(
              s.start_time ?? (s as Record<string, unknown>).startTime ?? "",
            ),
            end_time: String(
              s.end_time ?? (s as Record<string, unknown>).endTime ?? "",
            ),
            status: String(s.status ?? ""),
            venue_name: venueName,
          };
        })
        .sort((a, b) => (a.start_time < b.start_time ? 1 : -1))
        .slice(0, 10);
    },
    enabled: fetchSelectedShifts && selectedUserId != null,
  });

  // ── Approve pending profile ────────────────────────────────────────────────
  const approveStaff = useMutation({
    mutationFn: (profileId: number) => profileService.approveStaffProfile(profileId),
    onMutate: async (profileId) => {
      await queryClient.cancelQueries({ queryKey: PENDING_KEY });
      const prev = queryClient.getQueryData<PendingStaffProfile[]>(PENDING_KEY);
      queryClient.setQueryData<PendingStaffProfile[]>(PENDING_KEY, (curr) =>
        (curr ?? []).filter((p) => p.id !== profileId),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(PENDING_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY });
    },
  });

  // ── Delete staff user ──────────────────────────────────────────────────────
  const deleteStaff = useMutation({
    mutationFn: (userId: number) => userService.deleteUser(userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ACTIVE_KEY });
      const prev = queryClient.getQueryData<StaffUser[]>(ACTIVE_KEY);
      queryClient.setQueryData<StaffUser[]>(ACTIVE_KEY, (curr) =>
        (curr ?? []).filter((u) => u.id !== userId),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ACTIVE_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY });
    },
  });

  // ── Invite (create) staff user ─────────────────────────────────────────────
  const inviteStaff = useMutation({
    mutationFn: (payload: InviteStaffPayload) =>
      userService.createUser(payload as Partial<User>),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY });
      queryClient.invalidateQueries({ queryKey: PENDING_KEY });
    },
  });

  // ── Update staff address (admin) ──────────────────────────────────────────
  const updateStaffAddress = useMutation({
    mutationFn: ({
      staffProfileId,
      data,
    }: {
      staffProfileId: number;
      data: Partial<StaffAddressRecord>;
    }) => profileService.patchStaffProfile(staffProfileId, data),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["staff", vars.staffProfileId, "profile"],
      });
    },
  });

  // ── SIA licence CRUD (admin) ──────────────────────────────────────────────
  // All three invalidate both the per-staff list (drawer) and the global list
  // (right-rail expiring card + per-row pill).
  const invalidateSiaCaches = (staffProfileId: number) => {
    queryClient.invalidateQueries({
      queryKey: ["staff", staffProfileId, "sia"],
    });
    queryClient.invalidateQueries({ queryKey: LICENSES_ALL_KEY });
  };

  const addStaffLicense = useMutation({
    mutationFn: ({
      staffProfileId,
      data,
    }: {
      staffProfileId: number;
      data: {
        licenseNumber: string;
        licenseType: string;
        issueDate: string;
        expiryDate: string;
      };
    }) => profileService.addSIALicense(staffProfileId, data),
    onSettled: (_d, _e, vars) => invalidateSiaCaches(vars.staffProfileId),
  });

  const updateStaffLicense = useMutation({
    mutationFn: ({
      licenseId,
      data,
    }: {
      licenseId: number;
      staffProfileId: number;
      data: Record<string, unknown>;
    }) => profileService.patchSIALicense(licenseId, data),
    onSettled: (_d, _e, vars) => invalidateSiaCaches(vars.staffProfileId),
  });

  const deleteStaffLicense = useMutation({
    mutationFn: ({
      licenseId,
    }: {
      licenseId: number;
      staffProfileId: number;
    }) => profileService.deleteSIALicenseById(licenseId),
    onSettled: (_d, _e, vars) => invalidateSiaCaches(vars.staffProfileId),
  });

  // ── Update employment type ────────────────────────────────────────────────
  // Field lives on StaffProfile, NOT User. PATCH /staff-profiles/{id}/ with the
  // EmploymentType FK id (the serializer accepts the camelCase `employmentType`
  // alias for `employment_type_id`). Caller passes the human-readable name; we
  // look up the id from the cached employment-types list.
  const updateEmploymentType = useMutation({
    mutationFn: async ({
      staffProfileId,
      employmentType,
    }: {
      userId: number;
      staffProfileId: number | null;
      employmentType: string | null;
    }) => {
      if (staffProfileId == null) {
        throw new Error("This staff member has no profile yet — can't change employment type.");
      }
      let employmentTypeId: number | null = null;
      if (employmentType) {
        const list =
          queryClient.getQueryData<EmploymentType[]>(EMPLOYMENT_TYPES_KEY) ?? [];
        const match = list.find(
          (et) => et.name.toLowerCase() === employmentType.toLowerCase(),
        );
        if (!match) {
          throw new Error(`Unknown employment type "${employmentType}".`);
        }
        employmentTypeId = match.id;
      }
      return profileService.patchStaffProfile(staffProfileId, {
        employmentType: employmentTypeId,
      });
    },
    onMutate: async ({ userId, employmentType }) => {
      await queryClient.cancelQueries({ queryKey: ACTIVE_KEY });
      const prev = queryClient.getQueryData<StaffUser[]>(ACTIVE_KEY);
      queryClient.setQueryData<StaffUser[]>(ACTIVE_KEY, (curr) =>
        (curr ?? []).map((u) =>
          u.id === userId ? { ...u, employment_type: employmentType } : u,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ACTIVE_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY });
    },
  });

  // ── Update pay frequency ──────────────────────────────────────────────────
  const updatePayFrequency = useMutation({
    mutationFn: ({
      staffProfileId,
      payFrequency,
    }: {
      staffProfileId: number;
      payFrequency: "weekly" | "monthly";
    }) => profileService.patchStaffProfile(staffProfileId, { pay_frequency: payFrequency }),
    onMutate: async ({ staffProfileId, payFrequency }) => {
      await queryClient.cancelQueries({ queryKey: ACTIVE_KEY });
      const prev = queryClient.getQueryData<StaffUser[]>(ACTIVE_KEY);
      queryClient.setQueryData<StaffUser[]>(ACTIVE_KEY, (curr) =>
        (curr ?? []).map((u) =>
          u.staff_profile_id === staffProfileId ? { ...u, pay_frequency: payFrequency } : u,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ACTIVE_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY });
    },
  });

  return {
    active: activeQuery.data ?? [],
    pending: pendingQuery.data ?? [],
    employmentTypes: employmentTypesQuery.data ?? [],
    allLicenses: allLicensesQuery.data ?? [],
    selectedSiaLicenses: selectedSiaQuery.data ?? [],
    selectedAddress: selectedProfileQuery.data ?? null,
    selectedShifts: selectedShiftsQuery.data ?? [],
    isLoading: activeQuery.isLoading || pendingQuery.isLoading,
    isLoadingSelectedSia: selectedSiaQuery.isLoading,
    isLoadingSelectedAddress: selectedProfileQuery.isLoading,
    isLoadingSelectedShifts: selectedShiftsQuery.isLoading,
    activeError: activeQuery.error,
    pendingError: pendingQuery.error,
    approveStaff,
    deleteStaff,
    inviteStaff,
    updateEmploymentType,
    updatePayFrequency,
    updateStaffAddress,
    addStaffLicense,
    updateStaffLicense,
    deleteStaffLicense,
  };
}
