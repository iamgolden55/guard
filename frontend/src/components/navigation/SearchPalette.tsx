import { useQuery } from "@tanstack/react-query";
// SearchPalette — global topbar search.
// ⌘K / Ctrl+K focuses the input. Typing filters cached staff + venues
// client-side (lists are small per-company). Results dropdown is portal-
// rendered so it can extend past the Topbar's bounding box. Click → navigate
// to /staff?focus=<id> or /venues?focus=<id>; the page picks up the param
// and opens the existing drawer.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../../design-system/Icon";
import { tokens } from "../../design-system/tokens";
import userService, { type StaffUser } from "../../services/userService";
import venueService from "../../services/venueService";
import type { Venue } from "../../types/venue";

const STALE_TIME = 5 * 60 * 1000;
const PER_GROUP_LIMIT = 5;

interface AnchorRect {
  top: number;
  left: number;
  width: number;
}

function isMacLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
}

function staffLabel(s: StaffUser): string {
  const full = s.full_name || `${s.first_name} ${s.last_name}`.trim();
  return full || s.username || s.email || `Staff #${s.id}`;
}

function venueLabel(v: Venue): string {
  return v.name;
}

function venueSubtitle(v: Venue): string {
  return [v.city, v.address].filter(Boolean).join(" · ");
}

export function SearchPalette() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const staffQuery = useQuery<StaffUser[]>({
    queryKey: ["search", "staff"],
    queryFn: () => userService.getStaffUsers(),
    staleTime: STALE_TIME,
  });
  const venuesQuery = useQuery<Venue[]>({
    queryKey: ["search", "venues"],
    queryFn: () => venueService.getAllVenues(),
    staleTime: STALE_TIME,
  });

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!trimmed) return { staff: [] as StaffUser[], venues: [] as Venue[] };
    const staff = (staffQuery.data ?? []).filter((s) => {
      const hay =
        `${s.first_name} ${s.last_name} ${s.username} ${s.email}`.toLowerCase();
      return hay.includes(trimmed);
    });
    const venues = (venuesQuery.data ?? []).filter((v) => {
      const hay = `${v.name} ${v.city ?? ""} ${v.address ?? ""}`.toLowerCase();
      return hay.includes(trimmed);
    });
    return {
      staff: staff.slice(0, PER_GROUP_LIMIT),
      venues: venues.slice(0, PER_GROUP_LIMIT),
    };
  }, [trimmed, staffQuery.data, venuesQuery.data]);

  const flatResults = useMemo(
    () => [
      ...matches.staff.map((s) => ({
        kind: "staff" as const,
        id: s.id,
        item: s,
      })),
      ...matches.venues.map((v) => ({
        kind: "venue" as const,
        id: v.id,
        item: v,
      })),
    ],
    [matches.staff, matches.venues],
  );

  // ── ⌘K / Ctrl+K focuses the input ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isShortcut =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isShortcut) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Position the dropdown beneath the input pill ─────────────────────────
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!wrapperRef.current) return;
      const r = wrapperRef.current.getBoundingClientRect();
      setAnchor({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // ── Outside click closes ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Reset highlight when result set changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: setActiveIdx is stable
  useEffect(() => {
    setActiveIdx(0);
  }, [flatResults]);

  function handleSelect(idx: number) {
    const result = flatResults[idx];
    if (!result) return;
    if (result.kind === "staff") {
      navigate(`/staff?focus=${result.id}`);
    } else {
      navigate(`/venues?focus=${result.id}`);
    }
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    if (!flatResults.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flatResults.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(activeIdx);
    }
  }

  const showDropdown = open && trimmed.length > 0;
  const isLoading = staffQuery.isLoading || venuesQuery.isLoading;

  return (
    <>
      <div
        ref={wrapperRef}
        className="hidden md:flex"
        style={{
          alignItems: "center",
          gap: 8,
          background: tokens.color.ink100,
          borderRadius: 8,
          padding: "8px 12px",
          minWidth: 280,
          color: tokens.color.ink600,
          position: "relative",
        }}
      >
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search staff, venues…"
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
        <kbd
          style={{
            fontFamily: tokens.font.mono,
            fontSize: 10,
            color: tokens.color.ink600,
            background: "white",
            border: `1px solid ${tokens.color.ink200}`,
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          {isMacLike() ? "⌘K" : "Ctrl+K"}
        </kbd>
      </div>

      {showDropdown &&
        anchor &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: anchor.width,
              maxHeight: 360,
              overflowY: "auto",
              background: "white",
              border: `1px solid ${tokens.color.ink200}`,
              borderRadius: 10,
              boxShadow: "0 12px 28px -8px rgba(32,31,30,0.20)",
              zIndex: 1000,
              fontFamily: tokens.font.body,
            }}
          >
            {isLoading && flatResults.length === 0 && (
              <EmptyRow>Loading…</EmptyRow>
            )}

            {!isLoading && flatResults.length === 0 && (
              <EmptyRow>No matches for &ldquo;{query}&rdquo;.</EmptyRow>
            )}

            {matches.staff.length > 0 && (
              <Group label="Staff">
                {matches.staff.map((s, i) => {
                  const idx = i;
                  return (
                    <ResultRow
                      key={`staff-${s.id}`}
                      active={idx === activeIdx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => handleSelect(idx)}
                      icon="users"
                      title={staffLabel(s)}
                      subtitle={s.email || s.username}
                    />
                  );
                })}
              </Group>
            )}

            {matches.venues.length > 0 && (
              <Group label="Venues">
                {matches.venues.map((v, i) => {
                  const idx = matches.staff.length + i;
                  return (
                    <ResultRow
                      key={`venue-${v.id}`}
                      active={idx === activeIdx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => handleSelect(idx)}
                      icon="pin"
                      title={venueLabel(v)}
                      subtitle={venueSubtitle(v)}
                    />
                  );
                })}
              </Group>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 14px",
        fontSize: 13,
        color: tokens.color.ink500,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          padding: "10px 14px 4px",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

interface ResultRowProps {
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  icon: IconName;
  title: string;
  subtitle?: string;
}

function ResultRow({
  active,
  onMouseEnter,
  onClick,
  icon,
  title,
  subtitle,
}: ResultRowProps) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 14px",
        background: active ? tokens.color.ink100 : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: tokens.font.body,
      }}
    >
      <Icon name={icon} size={14} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: tokens.color.ink900,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 11.5,
              color: tokens.color.ink500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </button>
  );
}
