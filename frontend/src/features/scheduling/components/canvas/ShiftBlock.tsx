// ShiftBlock — absolutely-positioned block on the day canvas timeline.
// Ported 1:1 from project/scheduling-canvas.jsx:113-209.
// Phase 7.5: open shifts are drop targets for officer drag-drop.
// Phase 7.6: assigned shifts are draggable so they can be reassigned to
// another row.
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import {
  fmtRange,
  HOURS_START,
  hrs,
  officerById,
  venueById,
  type Shift,
} from "../../data/mocks";
import { HOUR_W } from "./HourHeader";

export type ColorBy = "venue" | "status";

export interface ShiftBlockProps {
  shift: Shift;
  onOpen: (shift: Shift) => void;
  colorBy?: ColorBy;
}

export function ShiftBlock({ shift, onOpen, colorBy = "venue" }: ShiftBlockProps) {
  const venue = venueById(shift.venueId);
  const officer = officerById(shift.officerId);

  // Open shifts are drop targets for officer cards.
  const {
    setNodeRef: setDropRef,
    isOver,
    active,
  } = useDroppable({
    id: `shift-drop:${shift.id}`,
    data: { shiftId: shift.id, kind: "shift" },
    disabled: shift.status !== "open",
  });

  // Assigned (non-open, non-completed) shifts are draggable so they can be
  // re-arranged to another row.
  const draggableEnabled = shift.officerId !== null && shift.status !== "completed";
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    transform,
    isDragging,
  } = useDraggable({
    id: `shift-drag:${shift.id}`,
    data: { shiftId: shift.id, kind: "shift-block" },
    disabled: !draggableEnabled,
  });

  const setNodeRef = (el: HTMLButtonElement | null) => {
    setDropRef(el);
    setDragRef(el);
  };

  if (!venue) return null;

  const left = (shift.start - HOURS_START) * HOUR_W + 2;
  const width = (shift.end - shift.start) * HOUR_W - 4;

  const hardViol = (shift.violations || []).find((v) => v.tier === "hard");
  const softViol = (shift.violations || []).find((v) => v.tier === "soft");

  const bgColor =
    shift.status === "open"
      ? "white"
      : colorBy === "status"
        ? shift.published
          ? "#0f766e"
          : tokens.color.warn
        : venue.color;
  const fgColor = shift.status === "open" ? tokens.color.ink900 : "white";

  const draftPattern = !shift.published && shift.status !== "open";

  // Drop-target highlighting for open shifts during a drag.
  const hovering = isOver && shift.status === "open";
  const dragActive = !!active && shift.status === "open";

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(shift)}
      {...(draggableEnabled ? listeners : {})}
      {...(draggableEnabled ? attributes : {})}
      style={{
        position: "absolute",
        top: 6,
        bottom: 6,
        left,
        width,
        minWidth: 60,
        borderRadius: 7,
        background: hovering ? tokens.color.successSoft : bgColor,
        outline: hovering ? `2px solid ${tokens.color.success}` : undefined,
        outlineOffset: hovering ? -2 : undefined,
        opacity: isDragging ? 0.45 : 1,
        transform: CSS.Translate.toString(transform),
        touchAction: draggableEnabled ? "none" : undefined,
        cursor: draggableEnabled ? (isDragging ? "grabbing" : "grab") : "pointer",
        border:
          shift.status === "open"
            ? `1.5px dashed ${hovering ? tokens.color.success : tokens.color.ink500}`
            : hardViol
              ? `2px solid ${tokens.color.danger}`
              : softViol
                ? `2px solid ${tokens.color.warn}`
                : `1px solid ${shift.published ? "transparent" : tokens.color.warn}`,
        color: fgColor,
        padding: "6px 9px",
        textAlign: "left",
        fontFamily: tokens.font.body,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: hovering
          ? `0 0 0 3px ${tokens.color.success}33`
          : dragActive && shift.status === "open"
            ? `0 0 0 2px ${tokens.color.ink300}`
            : shift.status === "open"
              ? "none"
              : "0 1px 2px rgba(32,31,30,0.12)",
        backgroundImage: draftPattern
          ? "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.18) 6px, rgba(255,255,255,0.18) 9px)"
          : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 4,
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: "-0.005em",
            }}
          >
            {officer ? officer.name : "Open shift"}
          </div>
          <div
            style={{
              fontSize: 10.5,
              opacity: 0.88,
              marginTop: 2,
              fontFamily: tokens.font.mono,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {fmtRange(shift.start, shift.end)}
            {width > 130 && <span style={{ opacity: 0.75 }}> · {venue.name}</span>}
          </div>
        </div>
        {(hardViol || softViol) && (
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              flexShrink: 0,
              background: hardViol ? "rgba(203,36,49,0.9)" : "rgba(217,119,6,0.9)",
              color: "white",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="alert" size={11} />
          </div>
        )}
      </div>

      {width > 90 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            opacity: 0.9,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {!shift.published && shift.status !== "open" && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 4px",
                borderRadius: 2,
                background: "rgba(255,255,255,0.22)",
                letterSpacing: "0.05em",
              }}
            >
              DRAFT
            </span>
          )}
          {shift.status === "open" && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 4px",
                borderRadius: 2,
                background: tokens.color.ink100,
                color: tokens.color.ink600,
                letterSpacing: "0.05em",
              }}
            >
              OPEN · NEEDS COVER
            </span>
          )}
          {width > 160 && officer && shift.published && (
            <span style={{ fontSize: 9.5, opacity: 0.75 }}>
              {venue.req} · {hrs(shift.start, shift.end)}h
            </span>
          )}
        </div>
      )}
    </button>
  );
}
