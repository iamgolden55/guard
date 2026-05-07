import { useEffect, useRef, useState } from "react";
import { Card, textStyles, tokens } from "../../design-system";
import type { ProfileUpdateRequest } from "../../types";
import { AlertBanner } from "./components/AlertBanner";
import { BankDetailsSection } from "./components/BankDetailsSection";
import { ContactSection } from "./components/ContactSection";
import { PersonalDetailsSection } from "./components/PersonalDetailsSection";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileTabs, type ProfileTabKey } from "./components/ProfileTabs";
import { SecuritySection } from "./components/SecuritySection";
import { SIALicensesSection } from "./components/SIALicensesSection";
import { useProfileData } from "./hooks/useProfileData";

const TABS: { key: ProfileTabKey; label: string }[] = [
  { key: "personal", label: "Personal" },
  { key: "contact", label: "Contact" },
  { key: "licenses", label: "SIA licences" },
  { key: "bank", label: "Bank details" },
  { key: "security", label: "Security" },
];

function extractApiError(err: unknown, fallback: string): string {
  const e = err as
    | { response?: { data?: { message?: string; detail?: string } } }
    | undefined;
  return e?.response?.data?.message ?? e?.response?.data?.detail ?? fallback;
}

export default function ProfilePage() {
  const data = useProfileData();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("personal");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSuccess = (msg: string) => {
    setError(null);
    setSuccess(msg);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setSuccess(null), 4000);
  };

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  if (data.isLoading) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Card padding={32}>
          <div style={{ ...textStyles.mute, textAlign: "center" }}>
            Loading profile…
          </div>
        </Card>
      </div>
    );
  }

  if (!data.profile) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <AlertBanner tone="danger">
          We couldn't load your profile. Refresh the page to try again.
        </AlertBanner>
      </div>
    );
  }

  const profile = data.profile;

  const handleUpdate = async (
    payload: ProfileUpdateRequest,
    successMsg: string,
  ) => {
    setError(null);
    try {
      await data.updateProfile.mutateAsync(payload);
      flashSuccess(successMsg);
    } catch (err) {
      setError(extractApiError(err, "Failed to save changes. Please try again."));
      throw err;
    }
  };

  return (
    <div
      style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}
    >
      <h1 style={{ ...textStyles.h1, margin: 0 }}>My profile</h1>

      {error && (
        <AlertBanner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </AlertBanner>
      )}
      {success && (
        <AlertBanner tone="success" onDismiss={() => setSuccess(null)}>
          {success}
        </AlertBanner>
      )}

      <ProfileHeader
        profile={profile}
        isUploading={data.uploadProfileImage.isPending}
        onImageSelected={async (file) => {
          setError(null);
          try {
            await data.uploadProfileImage.mutateAsync(file);
            flashSuccess("Profile photo updated.");
          } catch (err) {
            setError(extractApiError(err, "Failed to upload photo. Please try again."));
          }
        }}
      />

      <ProfileTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
        {activeTab === "personal" && (
          <PersonalDetailsSection
            profile={profile}
            isSaving={data.updateProfile.isPending}
            onSave={(payload) =>
              handleUpdate(payload, "Personal information updated.")
            }
          />
        )}

        {activeTab === "contact" && (
          <ContactSection
            profile={profile}
            isSaving={data.updateProfile.isPending}
            onSave={(payload) => handleUpdate(payload, "Contact information updated.")}
          />
        )}

        {activeTab === "licenses" && (
          <SIALicensesSection
            licenses={data.siaLicenses}
            staffProfileId={profile.id}
            isMutating={
              data.addLicense.isPending ||
              data.updateLicense.isPending ||
              data.deleteLicense.isPending
            }
            onAdd={async (payload) => {
              setError(null);
              try {
                await data.addLicense.mutateAsync({
                  staffProfileId: profile.id,
                  data: payload,
                });
                flashSuccess("SIA licence added.");
              } catch (err) {
                setError(extractApiError(err, "Failed to add licence. Please try again."));
                throw err;
              }
            }}
            onUpdate={async (licenseId, payload) => {
              setError(null);
              try {
                await data.updateLicense.mutateAsync({
                  licenseId,
                  data: payload,
                });
                flashSuccess("SIA licence updated.");
              } catch (err) {
                setError(extractApiError(err, "Failed to update licence. Please try again."));
                throw err;
              }
            }}
            onDelete={async (licenseId) => {
              setError(null);
              try {
                await data.deleteLicense.mutateAsync(licenseId);
                flashSuccess("SIA licence deleted.");
              } catch (err) {
                setError(extractApiError(err, "Failed to delete licence. Please try again."));
              }
            }}
          />
        )}

        {activeTab === "bank" && (
          <BankDetailsSection
            profile={profile}
            isSaving={data.updateProfile.isPending}
            onSave={(payload) => handleUpdate(payload, "Bank details updated.")}
          />
        )}

        {activeTab === "security" && (
          <SecuritySection
            passwordLastChanged={profile.passwordLastChanged}
            isSaving={data.changePassword.isPending}
            onChangePassword={async (current, next) => {
              setError(null);
              try {
                await data.changePassword.mutateAsync({
                  currentPassword: current,
                  newPassword: next,
                });
                flashSuccess("Password changed successfully.");
              } catch (err) {
                setError(
                  extractApiError(
                    err,
                    "Failed to change password. Please check your current password and try again.",
                  ),
                );
                throw err;
              }
            }}
          />
        )}
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: tokens.color.ink500,
          padding: "12px 0 8px",
        }}
      >
        © Mead Security · My profile
      </div>
    </div>
  );
}
