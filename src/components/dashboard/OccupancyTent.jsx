import { Link } from "react-router-dom";

/**
 * Single tent square in the occupancy map.
 * Shows:
 * - Tent code
 * - Occupancy fill from bottom (proportional to allocated_pax / capacity)
 * - pax / capacity number
 * - Group color (border + fill tint)
 * - Empty = neutral gray
 * - Click → navigate to group detail (if allocated)
 */
export default function OccupancyTent({
  tent,
  allocation,
  group,
  groupColor,
}) {
  if (!tent) return null;

  const isAllocated = !!allocation && !!group;
  const capacity = tent.capacity || 8;
  const pax = allocation?.allocated_pax || 0;
  const fillPct = capacity > 0 ? Math.min(100, Math.round((pax / capacity) * 100)) : 0;

  // Determine fill coloring
  const fillBg = isAllocated
    ? { backgroundColor: groupColor, opacity: 0.25 + (fillPct / 100) * 0.55 }
    : {};

  const borderColor = isAllocated ? groupColor : "#d1d5db";
  const textColor = isAllocated ? "#1e293b" : "#94a3b8";

  const content = (
    <div
      className="relative w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer select-none transition-all hover:scale-105 hover:shadow-md"
      style={{
        borderColor,
        backgroundColor: isAllocated
          ? `${groupColor}${Math.round(20 + (fillPct / 100) * 35).toString(16).padStart(2, '0')}`
          : "#f8fafc",
        boxShadow: isAllocated ? `0 1px 3px ${groupColor}20` : undefined,
      }}
    >
      {/* Fill bar from bottom */}
      {isAllocated && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-md transition-all duration-300"
          style={{
            height: `${fillPct}%`,
            backgroundColor: groupColor,
            opacity: 0.30,
          }}
        />
      )}

      {/* Tent code */}
      <span
        className="relative z-10 text-[10px] font-bold leading-tight"
        style={{ color: isAllocated ? textColor : "#94a3b8" }}
      >
        {tent.code}
      </span>

      {/* Pax / capacity */}
      <span
        className="relative z-10 text-[11px] font-black leading-tight"
        style={{ color: isAllocated ? textColor : "#cbd5e1" }}
      >
        {isAllocated ? `${pax}/${capacity}` : "—"}
      </span>
    </div>
  );

  // If allocated, wrap in Link to group
  if (isAllocated) {
    return (
      <Link to={`/groups/${group.id}`} title={`${group.group_name} — ${pax}/${capacity}`}>
        {content}
      </Link>
    );
  }

  return content;
}