// ProfilesView — list of compliance profiles with active toggle + edit.
import { Card } from "../../../design-system/primitives/Card";
import { Button } from "../../../design-system/primitives/Button";
import { Pill } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { useAccent } from "../../../contexts/AccentContext";
import { tokens } from "../../../design-system/tokens";
import type { ComplianceProfile } from "../../../types/compliance";

export interface ProfilesViewProps {
  profiles: ComplianceProfile[];
  isLoading: boolean;
  isMutating: boolean;
  onSetActive: (profile: ComplianceProfile) => void;
  onEdit: (profile: ComplianceProfile) => void;
  onCreate: () => void;
}

export function ProfilesView({
  profiles,
  isLoading,
  isMutating,
  onSetActive,
  onEdit,
  onCreate,
}: ProfilesViewProps) {
  const { palette } = useAccent();

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: 24,
        background: tokens.color.ink50,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {isLoading ? (
          <Card padding={32}>
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                color: tokens.color.ink500,
              }}
            >
              Loading compliance profiles…
            </div>
          </Card>
        ) : profiles.length === 0 ? (
          <Card padding={32}>
            <div
              style={{
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  margin: "0 auto 12px",
                  borderRadius: 22,
                  background: tokens.color.ink100,
                  display: "grid",
                  placeItems: "center",
                  color: tokens.color.ink500,
                }}
              >
                <Icon name="briefcase" size={20} />
              </div>
              <div
                style={{
                  fontFamily: tokens.font.display,
                  fontWeight: 700,
                  fontSize: 14,
                  color: tokens.color.ink800,
                  marginBottom: 4,
                }}
              >
                No compliance profiles yet
              </div>
              <div
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 12.5,
                  color: tokens.color.ink500,
                  marginBottom: 16,
                }}
              >
                Profiles bundle working-hours regulations with thresholds and
                approval rules.
              </div>
              <Button
                variant="primary"
                accent={palette}
                leading={<Icon name="plus" size={14} />}
                onClick={onCreate}
              >
                Create your first profile
              </Button>
            </div>
          </Card>
        ) : (
          profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              isMutating={isMutating}
              onSetActive={onSetActive}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  isMutating,
  onSetActive,
  onEdit,
}: {
  profile: ComplianceProfile;
  isMutating: boolean;
  onSetActive: (profile: ComplianceProfile) => void;
  onEdit: (profile: ComplianceProfile) => void;
}) {
  return (
    <Card padding={20}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 15,
                color: tokens.color.ink900,
                letterSpacing: "-0.01em",
              }}
            >
              {profile.name}
            </div>
            {profile.is_active && (
              <Pill tone="positive" dot>
                Active
              </Pill>
            )}
          </div>
          {profile.description && (
            <div
              style={{
                fontFamily: tokens.font.body,
                fontSize: 12.5,
                color: tokens.color.ink600,
                marginBottom: 12,
              }}
            >
              {profile.description}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "10px 18px",
            }}
          >
            <Stat
              label="Region"
              value={profile.working_hours_regulation_data?.country_name ?? "—"}
            />
            <Stat
              label="Max daily hours"
              value={profile.effective_max_daily_hours ?? "—"}
              suffix="h"
            />
            <Stat
              label="Max weekly hours"
              value={profile.effective_max_weekly_hours ?? "—"}
              suffix="h"
            />
            <Stat
              label="Max consecutive days"
              value={String(profile.effective_max_consecutive_days ?? "—")}
            />
          </div>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {profile.auto_approve_overtime && (
              <Pill tone="info">Auto-approve overtime</Pill>
            )}
            {profile.require_manager_approval && (
              <Pill tone="neutral">Manager approval required</Pill>
            )}
            {profile.notify_on_violations && (
              <Pill tone="neutral">Notify on violations</Pill>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {!profile.is_active && (
            <Button
              variant="secondary"
              onClick={() => onSetActive(profile)}
              disabled={isMutating}
            >
              Set active
            </Button>
          )}
          <Button
            variant="ghost"
            leading={<Icon name="edit" size={13} />}
            onClick={() => onEdit(profile)}
            disabled={isMutating}
          >
            Edit
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          color: tokens.color.ink900,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
        {suffix && value !== "—" && (
          <span style={{ color: tokens.color.ink500 }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}
