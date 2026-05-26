/**
 * Print template for cleaning worker hours report.
 * Rendered in a portal and printed via window.print().
 */

const SHIFT_LABELS = { MORNING: "בוקר", EVENING: "ערב", OTHER: "אחר" };

function fmtMins(mins) {
  if (!mins || mins <= 0) return "0:00";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function fmtDate(d) {
  if (!d) return "";
  try {
    const [y, mo, day] = d.split("-");
    return `${day}/${mo}/${y}`;
  } catch { return d; }
}

function decimalHours(mins) {
  return (mins / 60).toFixed(1);
}

export default function CleaningHoursPrintTemplate({ shifts, from, to }) {
  const active = shifts.filter(s => s.status === "ACTIVE" && s.date >= from && s.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.shift_type.localeCompare(b.shift_type) || a.start_time.localeCompare(b.start_time));

  const totalMins   = active.reduce((s, r) => s + (r.total_worker_minutes || 0), 0);
  const morningMins = active.filter(r => r.shift_type === "MORNING").reduce((s, r) => s + (r.total_worker_minutes || 0), 0);
  const eveningMins = active.filter(r => r.shift_type === "EVENING").reduce((s, r) => s + (r.total_worker_minutes || 0), 0);
  const otherMins   = active.filter(r => r.shift_type === "OTHER").reduce((s, r) => s + (r.total_worker_minutes || 0), 0);
  const uniqueDays  = new Set(active.map(r => r.date)).size;

  // Group by date for daily totals
  const byDate = {};
  active.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  const page = {
    width: "210mm", minHeight: "297mm", padding: "14mm 16mm 20mm",
    boxSizing: "border-box", fontFamily: '"Arial Hebrew", Arial, sans-serif',
    fontSize: 12, direction: "rtl", backgroundColor: "#fff", color: "#111",
  };

  const th = { padding: "8px 10px", background: "#1a56a0", color: "#fff", fontWeight: 700, textAlign: "right", fontSize: 11 };
  const td = { padding: "7px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 11 };

  return (
    <div id="cleaning-print-root" style={page}>
      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #1a56a0", paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a56a0" }}>דוח שעות עובדות ניקיון</div>
        <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
          מתאריך {fmtDate(from)} עד תאריך {fmtDate(to)}
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a56a0", borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginBottom: 10 }}>סיכום</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["סה״כ שעות עבודה", `${fmtMins(totalMins)} (${decimalHours(totalMins)} שעות)`],
              ["סה״כ משמרות", active.length],
              ["סה״כ ימי עבודה", uniqueDays],
              ["סה״כ שעות בוקר", fmtMins(morningMins)],
              ["סה״כ שעות ערב", fmtMins(eveningMins)],
              ["סה״כ שעות אחר", fmtMins(otherMins)],
            ].map(([label, val]) => (
              <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ ...td, fontWeight: 600, width: "50%" }}>{label}</td>
                <td style={{ ...td }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a56a0", borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginBottom: 10 }}>פירוט משמרות</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["תאריך", "משמרת", "עובדות", "התחלה", "סיום", "לעובדת", "סה״כ", "הערות"].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(byDate).map(([date, rows]) => {
              const dayTotal = rows.reduce((s, r) => s + (r.total_worker_minutes || 0), 0);
              return [
                ...rows.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={td}>{fmtDate(r.date)}</td>
                    <td style={td}>{SHIFT_LABELS[r.shift_type]}{r.label ? ` — ${r.label}` : ""}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.workers_count}</td>
                    <td style={td}>{r.start_time}</td>
                    <td style={td}>{r.end_time}</td>
                    <td style={td}>{fmtMins(r.minutes_per_worker)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmtMins(r.total_worker_minutes)}</td>
                    <td style={{ ...td, fontSize: 10, color: "#666" }}>{r.notes || ""}</td>
                  </tr>
                )),
                <tr key={`total-${date}`} style={{ background: "#eff6ff" }}>
                  <td colSpan={6} style={{ ...td, fontWeight: 700, color: "#1a56a0" }}>סה״כ יום {fmtDate(date)}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#1a56a0" }}>{fmtMins(dayTotal)}</td>
                  <td style={td} />
                </tr>
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}