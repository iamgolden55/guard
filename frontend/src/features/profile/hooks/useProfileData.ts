// Profile data layer — TanStack Query against the real profileService.
//
// Query: ["profile"] → StaffProfile (one fetch covers personal/contact/bank/SIA-list/image).
// Mutations cover the five edit surfaces (personal, contact, bank, password,
// image, SIA-license CRUD). Personal/contact/bank do optimistic merges so the
// edit form snaps to the saved state without waiting for the round-trip;
// password and SIA mutations just invalidate.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import profileService from "../../../services/profileService";
import type {
  ProfileUpdateRequest,
  SIALicense,
  SIALicenseUpdateRequest,
  StaffProfile,
} from "../../../types";
import { useAuth } from "../../../contexts/AuthContext";

const PROFILE_KEY = ["profile"] as const;

export interface AddSIALicenseInput {
  licenseNumber: string;
  licenseType: string;
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  status?: "valid" | "expired" | "pending";
  level?: string;
  document_url?: string;
}

export function useProfileData() {
  const queryClient = useQueryClient();
  const { refreshUserData } = useAuth();

  const profileQuery = useQuery<StaffProfile>({
    queryKey: PROFILE_KEY,
    queryFn: () => profileService.getProfile(),
  });

  // ── Personal / contact / bank — optimistic ────────────────────────────────
  const updateProfile = useMutation({
    mutationFn: (payload: ProfileUpdateRequest) =>
      profileService.updateProfile(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: PROFILE_KEY });
      const prev = queryClient.getQueryData<StaffProfile>(PROFILE_KEY);
      if (prev) {
        queryClient.setQueryData<StaffProfile>(PROFILE_KEY, {
          ...prev,
          ...payload,
          address: payload.address ? { ...prev.address, ...payload.address } : prev.address,
          emergencyContact: payload.emergencyContact
            ? { ...prev.emergencyContact, ...payload.emergencyContact }
            : prev.emergencyContact,
          bankDetails: payload.bankDetails
            ? { ...prev.bankDetails, ...payload.bankDetails }
            : prev.bankDetails,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(PROFILE_KEY, ctx.prev);
    },
    onSuccess: (saved, vars) => {
      // Authoritative server response wins.
      queryClient.setQueryData(PROFILE_KEY, saved);
      // Keep AuthContext name/email in sync if those changed.
      if (vars.firstName || vars.lastName || vars.email) refreshUserData();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  // ── Password — no cache impact ────────────────────────────────────────────
  const changePassword = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => profileService.changePassword(currentPassword, newPassword),
  });

  // ── Profile image — optimistic url swap on success ────────────────────────
  const uploadProfileImage = useMutation({
    mutationFn: (file: File) => profileService.uploadProfileImage(file),
    onSuccess: (result) => {
      const prev = queryClient.getQueryData<StaffProfile>(PROFILE_KEY);
      if (prev) {
        queryClient.setQueryData<StaffProfile>(PROFILE_KEY, {
          ...prev,
          profileImageUrl: result.imageUrl,
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  // ── SIA licenses — invalidate-only (write surface is small) ───────────────
  const addLicense = useMutation({
    mutationFn: ({
      staffProfileId,
      data,
    }: {
      staffProfileId: number;
      data: AddSIALicenseInput;
    }) => profileService.addSIALicense(staffProfileId, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  const updateLicense = useMutation({
    mutationFn: ({
      licenseId,
      data,
    }: {
      licenseId: string;
      data: SIALicenseUpdateRequest;
    }) => profileService.updateSIALicense(licenseId, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  const deleteLicense = useMutation({
    mutationFn: (licenseId: string) => profileService.deleteSIALicense(licenseId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  return {
    profile: profileQuery.data ?? null,
    siaLicenses: (profileQuery.data?.siaLicenses ?? []) as SIALicense[],
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError,
    error: profileQuery.error,
    refetch: profileQuery.refetch,
    updateProfile,
    changePassword,
    uploadProfileImage,
    addLicense,
    updateLicense,
    deleteLicense,
  };
}
