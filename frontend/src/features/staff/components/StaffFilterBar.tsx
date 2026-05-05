// Filter bar for the Staff directory. Contains search and an employment-type
// dropdown. Tab selection lives in <StaffTabs /> above this component.
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export interface StaffFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  employmentType: string;
  onEmploymentTypeChange: (value: string) => void;
  employmentTypeOptions: string[];
  resultCount: number;
}

export function StaffFilterBar({
  search,
  onSearchChange,
  employmentType,
  onEmploymentTypeChange,
  employmentTypeOptions,
  resultCount,
}: StaffFilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.lg,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: tokens.color.ink600,
          flex: 1,
          minWidth: 220,
        }}
      >
        <Icon name="search" size={14} />
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            fontFamily: tokens.font.body,
            flex: 1,
            color: tokens.color.ink800,
          }}
        />
      </div>

      <div style={{ width: 1, height: 24, background: tokens.color.ink200 }} />

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: tokens.color.ink600,
          fontFamily: tokens.font.body,
        }}
      >
        <Icon name="briefcase" size={13} />
        <span>Employment</span>
        <select
          value={employmentType}
          onChange={(e) => onEmploymentTypeChange(e.target.value)}
          style={{
            height: 32,
            padding: "0 28px 0 10px",
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            background: "white",
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink800,
            cursor: "pointer",
          }}
        >
          <option value="">All</option>
          {employmentTypeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      <div style={{ width: 1, height: 24, background: tokens.color.ink200 }} />

      <div
        style={{
          fontSize: 12,
          color: tokens.color.ink600,
          fontFamily: tokens.font.body,
        }}
      >
        {resultCount} {resultCount === 1 ? "result" : "results"}
      </div>
    </div>
  );
}
