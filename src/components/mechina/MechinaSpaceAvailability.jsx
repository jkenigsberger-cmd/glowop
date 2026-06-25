/**
 * MechinaSpaceAvailability
 * Visual daily availability grid for common spaces.
 * Shows ACTIVE GroupScheduleItem bookings and PENDING CommonSpaceBookingRequest blocks.
 * Column = space, row = hour from 06:00–23:00.
 *
 * UI improvements:
 * - Sticky time axis on the right (RTL) — remains visible during horizontal scroll
 * - Sticky header row for space names
 * - Deterministic group colors by hashing group_id
 * - Per-date group legend
 * - Richer event cards: group name + time + status
 */

const HOUR_START = 6;
const HOUR_END   = 23;
const HOURS      = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const TOTAL_HEIGHT = 680; // px total grid height

// ── Deterministic color palette ───────────────────────────────────────────────
const COLOR_PALETTE = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a" }, // blue
  { bg: "#dcfce7", border: "#22c55e", text: "#14532d" }, // green
  { bg: "#fce7f3", border: "#ec4899", text: "#831843" }, // pink
  { bg: "#ede9fe", border: "#8b5cf6", text: "#3b0764" }, // violet
  { bg: "#ffedd5", border: "#f97316", text: "#7c2d12" }, // orange
  { bg: "#cffafe", border: "#06b6d4", text: "#164e63" }, // cyan
  { bg: "#fef9c3", border: "#eab308", text: "#713f12" }, // yellow
  { bg: "#fce4ec", border: "#e91e63", text: "#880e4f" }, // rose
  { bg: "#e8f5e9", border: "#4caf50", text: "#1b5e20" }, // lime
  { bg: "#ede7f6", border: "#673ab7", text: "#311b92" }, // deep-purple
  { bg: "#e3f2fd", border: "#1565c0", text: "#0d47a1" }, // deep-blue
  { bg: "#fff3e0", border: "#ef6c00", text: "#bf360c" }, // deep-orange
];

function hashGroupId(group_id) {
  if (!group_id) return 0;
  let hash = 0;
  for (let i = 0; i < group_id.length; i++) {
    hash = (hash * 31 + group_id.charCodeAt(i)) >>> 0;
  }
  return hash % COLOR_PALETTE.length;
}

export function getMechinaColor(group_id) {
  return COLOR_PALETTE[hashGroupId(group_id)];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function blockStyle(startTime, endTime) {
  const gridStart = HOUR_START * 60;
  const total     = (HOUR_END + 1 - HOUR_START) * 60;
  const s         = toMinutes(startTime) - gridStart;
  const e         = toMinutes(endTime)   - gridStart;
  const top       = Math.max(0, (s / total) * 100);
  const height    = Math.max(2, ((e - s) / total) * 100);
  return { top: `${top}%`, height: `${height}%` };
}

// ── TimeBlock ─────────────────────────────────────────────────────────────────
function TimeBlock({ groupId, groupName, startTime, endTime, statusLabel, title }) {
  const color = getMechinaColor(groupId);
  const style = blockStyle(startTime, endTime);
  return (
    <div
      className="absolute right-0 left-0 mx-0.5 rounded overflow-hidden flex flex-col justify-start px-1.5 py-1 cursor-default"
      style={{
        ...style,
        position: "absolute",
        zIndex: 2,
        backgroundColor: color.bg,
        borderLeft: `3px solid ${color.border}`,
        color: color.text,
      }}
      title={title}
    >
      {groupName && (
        <span className="text-[10px] font-bold leading-tight truncate">{groupName}</span>
      )}
      <span className="text-[9px] leading-tight opacity-80 font-medium">{startTime}–{endTime}</span>
      <span
        className="text-[9px] leading-tight font-semibold mt-0.5 truncate"
        style={{ color: color.border }}
      >
        {statusLabel}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MechinaSpaceAvailability({
  spaces, activeBookings, pendingRequests,
  isAdmin, onRequestNew, allowCreateRequest,
  groupMap = {},  // optional: map of group_id → { group_name }
}) {
  const COLUMN_WIDTH = 140;
  const TIME_COL_WIDTH = 48;

  // Collect groups that appear on this date for the legend
  const legendGroups = (() => {
    const seen = new Map(); // group_id → name
    activeBookings.forEach(b => {
      if (b.group_id && !seen.has(b.group_id)) {
        const name = groupMap[b.group_id]?.group_name || b.group_id;
        seen.set(b.group_id, name);
      }
    });
    pendingRequests.forEach(r => {
      const gid = r.mechina_group_id || r.group_id;
      if (gid && !seen.has(gid)) {
        const name = groupMap[gid]?.group_name || r.requested_by_name || gid;
        seen.set(gid, name);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  })();

  return (
    <div>
      {/* Scroll container — horizontal scroll only */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${COLUMN_WIDTH * spaces.length}px ${TIME_COL_WIDTH}px`,
            minWidth: COLUMN_WIDTH * spaces.length + TIME_COL_WIDTH,
          }}
        >
          {/* ── Space columns (left side, scrolls) ── */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${spaces.length}, ${COLUMN_WIDTH}px)` }}>
            {/* Header row */}
            {spaces.map(space => (
              <div
                key={space.id}
                className="h-10 flex flex-col items-center justify-center px-1 border-b border-r border-slate-200 bg-slate-50"
              >
                <p className="text-xs font-semibold text-slate-700 text-center leading-tight">{space.name}</p>
                {space.capacity && <p className="text-[10px] text-slate-400">{space.capacity} איש</p>}
              </div>
            ))}

            {/* Grid body */}
            {spaces.map(space => {
              const spaceBookings = activeBookings.filter(b => b.activity_space_id === space.id);
              const spacePending  = pendingRequests.filter(r => r.space_id === space.id);

              return (
                <div
                  key={space.id}
                  className="relative border-r border-slate-200 bg-white overflow-hidden"
                  style={{ height: TOTAL_HEIGHT }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-slate-100"
                      style={{ top: `${((h - HOUR_START) / (HOUR_END + 1 - HOUR_START)) * 100}%` }}
                    />
                  ))}

                  {/* ACTIVE bookings — תפוס */}
                  {spaceBookings.map(b => {
                    const name = groupMap[b.group_id]?.group_name || (isAdmin ? b.activity_name : null);
                    return (
                      <TimeBlock
                        key={b.id}
                        groupId={b.group_id}
                        groupName={name}
                        startTime={b.start_time}
                        endTime={b.end_time}
                        statusLabel="תפוס"
                        title={isAdmin ? `${b.activity_name} (${b.start_time}–${b.end_time})` : "תפוס"}
                      />
                    );
                  })}

                  {/* PENDING requests — ממתין לאישור */}
                  {spacePending.map(r => {
                    const gid  = r.mechina_group_id || r.group_id;
                    const name = groupMap[gid]?.group_name || r.requested_by_name || null;
                    return (
                      <TimeBlock
                        key={r.id}
                        groupId={gid}
                        groupName={name}
                        startTime={r.start_time}
                        endTime={r.end_time}
                        statusLabel="ממתין לאישור"
                        title={isAdmin ? `${r.activity_title} — ${r.requested_by_name || r.requested_by_email} (${r.start_time}–${r.end_time})` : "ממתין לאישור"}
                      />
                    );
                  })}

                  {/* "New request" button — Mechina users only */}
                  {allowCreateRequest && (
                    <button
                      onClick={() => onRequestNew(space.id)}
                      className="absolute bottom-2 left-0 right-0 mx-auto w-fit text-[10px] text-primary border border-primary/30 rounded-full px-2 py-0.5 bg-white hover:bg-primary/5 transition-colors z-10"
                    >
                      + בקשה
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Sticky time axis — right side (RTL), does NOT scroll horizontally ── */}
          <div
            style={{
              position: "sticky",
              right: 0,
              zIndex: 10,
              backgroundColor: "white",
              borderLeft: "1px solid #e2e8f0",
              width: TIME_COL_WIDTH,
            }}
          >
            {/* Header placeholder to align with column headers */}
            <div className="h-10 border-b border-slate-200 bg-slate-50" />

            {/* Hour labels */}
            <div style={{ height: TOTAL_HEIGHT, position: "relative" }}>
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute w-full text-[10px] text-slate-400 text-center"
                  style={{
                    top: `${((h - HOUR_START) / (HOUR_END + 1 - HOUR_START)) * 100}%`,
                    transform: "translateY(-50%)",
                    paddingRight: 2,
                  }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 px-1">
        {/* Status legend */}
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded inline-block bg-white border-2 border-slate-200" /> פנוי
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#fef3c7", border: "2px solid #f59e0b" }} /> ממתין לאישור
        </span>

        {/* Per-group color chips (only groups on this date) */}
        {legendGroups.length > 0 && (
          <>
            <span className="text-xs text-slate-300 select-none">|</span>
            {legendGroups.map(({ id, name }) => {
              const c = getMechinaColor(id);
              return (
                <span key={id} className="flex items-center gap-1.5 text-xs" style={{ color: c.text }}>
                  <span
                    className="w-3 h-3 rounded inline-block"
                    style={{ backgroundColor: c.bg, border: `2px solid ${c.border}` }}
                  />
                  {name}
                </span>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}