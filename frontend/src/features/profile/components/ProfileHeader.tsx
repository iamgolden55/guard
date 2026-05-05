import { useRef } from "react";
import { Avatar, Card, Icon, textStyles, tokens } from "../../../design-system";
import type { StaffProfile } from "../../../types";

export interface ProfileHeaderProps {
  profile: StaffProfile;
  onImageSelected: (file: File) => void;
  isUploading: boolean;
}

export function ProfileHeader({ profile, onImageSelected, isUploading }: ProfileHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || profile.username;

  return (
    <Card padding={24}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative" }}>
          {profile.profileImageUrl ? (
            <img
              src={profile.profileImageUrl}
              alt={fullName}
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${tokens.color.ink200}`,
              }}
            />
          ) : (
            <Avatar name={fullName} size={96} />
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            aria-label="Change profile picture"
            title="Change profile picture"
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "white",
              border: `1px solid ${tokens.color.ink200}`,
              boxShadow: tokens.shadow.sm,
              display: "grid",
              placeItems: "center",
              cursor: isUploading ? "wait" : "pointer",
              color: tokens.color.ink700,
            }}
          >
            <Icon name="edit" size={14} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImageSelected(f);
              e.target.value = "";
            }}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ ...textStyles.h2, fontSize: 18 }}>{fullName}</div>
          <div
            style={{
              ...textStyles.mute,
              fontSize: 13,
              textTransform: "capitalize",
              marginTop: 2,
            }}
          >
            {profile.role}
          </div>
        </div>

        {isUploading && (
          <div style={{ ...textStyles.mute, fontSize: 12 }}>Uploading image…</div>
        )}
      </div>
    </Card>
  );
}
