/**
 * MechinaSpaceAvailability
 * Visual daily availability grid for common spaces.
 * Shows ACTIVE GroupScheduleItem bookings and PENDING CommonSpaceBookingRequest blocks.
 * Column = space, row = hour from 06:00–23:00.
 */

const HOUR_START = 6;
const HOUR_END = 23;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

function toMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function blockStyle(startTime, endTime) {
  const gridStart = HOUR_START * 60;
  const total = (HOUR_END + 1 - HOUR_START) * 60;
  const s = toMinutes(startTime) - gridStart;
  const e = toMinutes(endTime) - gridStart;
  const top = Math.max(0, (s / total) * 100);
  const height = Math.max(1.5, ((e - s) / total) * 100);
  return { top: `${top}%`, height: `${height}%` };
}

function TimeBlock({ label, color, startTime, endTime, title }) {
  const style = blockStyle(startTime, endTime);
  return (
    <div
      className={`absolute right-0 left-0 mx-0.5 rounded ${color} flex flex-col justify-start px-1 py-0.5 overflow-hidden`}
      style={{ ...style, position: "absolute", zIndex: 2 }}
      title={title}
    >
      <span className="text-[10px] font-semibold leading-tight truncate">{label}</span>
      <span className="text-[9px] leading-tight opacity-80">{startTime}–{endTime}</span>
    </div>
  );
}

export default function MechinaSpaceAvailability({ spaces, activeBookings, pendingRequests, isAdmin, onRequestNew }) {
  const TOTAL_HEIGHT = 600; // px total grid height

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-0" style={{ minWidth: Math.max(spaces.length * 140, 400) + 48 }}>

        {/* Time axis */}
        <div className="w-12 shrink-0 mt-8">
          <div style={{ height: TOTAL_HEIGHT, position: "relative" }}>
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute w-full text-[10px] text-slate-400 text-left pr-1"
                style={{ top: `${((h - HOUR_START) / (HOUR_END + 1 - HOUR_START)) * 100}%`, transform: "translateY(-50%)" }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {/* Space columns */}
        {spaces.map(space => {
          const spaceBookings = activeBookings.filter(b => b.activity_space_id === space.id);
          const spacePending  = pendingRequests.filter(r => r.space_id === space.id);

          return (
            <div key={space.id} className="flex flex-col" style={{ width: 140 }}>
              {/* Column header */}
              <div className="h-8 flex flex-col items-center justify-center px-1 mb-0">
                <p className="text-xs font-semibold text-slate-700 text-center leading-tight">{space.name}</p>
                {space.capacity && <p className="text-[10px] text-slate-400">{space.capacity} איש</p>}
              </div>

              {/* Grid body */}
              <div
                className="relative border border-slate-200 rounded-lg bg-white overflow-hidden"
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
                {spaceBookings.map(b => (
                  <TimeBlock
                    key={b.id}
                    startTime={b.start_time}
                    endTime={b.end_time}
                    label="תפוס"
                    color="bg-slate-600 text-white"
                    title={isAdmin ? `${b.activity_name} (${b.start_time}–${b.end_time})` : "תפוס"}
                  />
                ))}

                {/* PENDING requests — ממתין לאישור */}
                {spacePending.map(r => (
                  <TimeBlock
                    key={r.id}
                    startTime={r.start_time}
                    endTime={r.end_time}
                    label="ממתין לאישור"
                    color="bg-amber-400 text-amber-900"
                    title={isAdmin ? `${r.activity_title} — ${r.requested_by_name || r.requested_by_email} (${r.start_time}–${r.end_time})` : "ממתין לאישור"}
                  />
                ))}

                {/* "New request" button — bottom of column */}
                <button
                  onClick={() => onRequestNew(space.id)}
                  className="absolute bottom-2 left-0 right-0 mx-auto w-fit text-[10px] text-primary border border-primary/30 rounded-full px-2 py-0.5 bg-white hover:bg-primary/5 transition-colors z-10"
                  style={{ position: "absolute" }}
                >
                  + בקשה
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded bg-slate-600 inline-block" /> תפוס
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> ממתין לאישור
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" /> פנוי
        </span>
      </div>
    </div>
  );
}