// LiveView — composes the 3-pane Live tab.
// project/attendance-live.jsx:481-489.
import type { AttendanceShift } from "../../data/mocks";
import { LiveLeftRail } from "./LiveLeftRail";
import { TimelineRiver, type GroupBy } from "./TimelineRiver";
import { VenueGrid } from "./VenueGrid";

export interface LiveViewProps {
  groupBy?: GroupBy;
  showPhotos?: boolean;
  onSelect: (shift: AttendanceShift) => void;
  leftRailOpen?: boolean;
  venueGridOpen?: boolean;
}

export function LiveView({
  groupBy = "venue",
  showPhotos = true,
  onSelect,
  leftRailOpen = true,
  venueGridOpen = true,
}: LiveViewProps) {
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {leftRailOpen && <LiveLeftRail onSelect={onSelect} />}
      <TimelineRiver groupBy={groupBy} showPhotos={showPhotos} onSelect={onSelect} />
      {venueGridOpen && <VenueGrid onSelect={onSelect} />}
    </div>
  );
}
