/**
 * Print template for the housekeeping monthly HOURS report (hours only — no money).
 * Per-worker breakdown with regular / 150% / actual / payable hours, totals,
 * and the calculation explanation. Rendered in a portal and printed via window.print().
 */
import { calculateCleaningPayrollBreakdown, reasonsText } from "@/lib/cleaningPayrollCalculator";

const DOW_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function fmtDate(d) {
  if (!d) return "";
  const [y, mo, day] = d.split("-");
  return `${day}/${mo}/${y}`;
}
function dowLabel(d) {
  const [y, mo, day] = d.split("-").map(Number);
  return DOW_HE[new Date(Date.UTC(y, mo - 1, day)).getUTCDay()];
}
const n2 = (x) => Number(x || 0).toFixed(2);

export default function CleaningHoursPrintTemplate({ shifts, holidays = [], from, to }) {
  const holidayDates = (holidays || []).filter((h) => h.is_active).map((h) => h.date);

  const active = shifts
    .filter((s) => s.status === "ACTIVE" && s.date >= from && s.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  // Group by worker, compute breakdowns scaled by workers_count
  const groups = {};
  const grand = { regular: 0, premium: 0, actual: 0, payable: 0 };
  let incompleteCount = 0;

  active.forEach((s) => {
    const name = s.label?.trim() || "ללא שם";
    if (!groups[name]) groups[name] = { rows: [], totals: { regular: 0, premium: 0, actual: 0, payable: 0 } };
    const b = calculateCleaningPayrollBreakdown(s, holidayDates);
    const workers = Number(s.workers_count) || 1;
    const row = { s, b, workers, regular: b.regular_hours * workers, premium: b.premium_150_hours * workers, actual: b.actual_hours * workers, payable: b.payable_hours * workers };
    groups[name].rows.push(row);
    if (b.incomplete) {
      incompleteCount += 1;
    } else {
      ["regular", "premium", "actual", "payable"].forEach((k) => {
        groups[name].totals[k] += row[k];
        grand[k] += row[k];
      });
    }
  });

  const workerNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, "he"));

  const page = {
    width: "210mm", minHeight: "297mm", padding: "14mm 16mm 20mm",
    boxSizing: "border-box", fontFamily: '"SimplerPro", "Arial Hebrew", Arial, sans-serif',
    fontSize: 11, direction: "rtl", backgroundColor: "#fff", color: "#111",
  };
  const th = { padding: "6px 8px", background: "#1a56a0", color: "#fff", fontWeight: 700, textAlign: "right", fontSize: 10 };
  const td = { padding: "5px 8px", borderBottom: "1px solid #e2e8f0", fontSize: 10 };

  return (
    <div id="cleaning-print-root" style={page}>
      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #1a56a0", paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a56a0", fontFamily: '"Kav16", "Arial Hebrew", Arial, sans-serif' }}>דוח שעות עובדות ניקיון</div>
        <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>מתאריך {fmtDate(from)} עד תאריך {fmtDate(to)}</div>
      </div>

      {/* Explanation */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "8px 12px", marginBottom: 16, fontSize: 11 }}>
        <strong>חישוב שעות לתשלום:</strong> שעות רגילות × 1.0 + שעות 150% × 1.5 = שעות לתשלום
        <span style={{ color: "#64748b", marginRight: 8 }}>(דוגמה: 1.00 × 1.0 + 2.00 × 1.5 = 4.00)</span>
      </div>

      {incompleteCount > 0 && (
        <div style={{ fontSize: 10, color: "#b45309", marginBottom: 10 }}>
          {incompleteCount} משמרות ללא שעת יציאה / לא הושלמו — אינן נכללות בסיכום.
        </div>
      )}

      {/* Per-worker tables */}
      {workerNames.map((name) => {
        const g = groups[name];
        return (
          <div key={name} style={{ marginBottom: 16, breakInside: "avoid" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1a56a0", marginBottom: 6 }}>{name}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["תאריך", "יום", "כניסה", "יציאה", "רגילות", "150%", "בפועל", "לתשלום", "סיבת 150%", "הערות"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={r.s.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={td}>{fmtDate(r.s.date)}</td>
                    <td style={td}>{dowLabel(r.s.date)}</td>
                    <td style={td}>{r.s.start_time}</td>
                    <td style={td}>{r.s.end_time || "—"}</td>
                    {r.b.incomplete ? (
                      <td colSpan={6} style={{ ...td, color: "#b45309" }}>חסר שעת יציאה / משמרת לא הושלמה</td>
                    ) : (
                      <>
                        <td style={td}>{n2(r.regular)}</td>
                        <td style={{ ...td, fontWeight: 600, color: "#b45309" }}>{n2(r.premium)}</td>
                        <td style={td}>{n2(r.actual)}</td>
                        <td style={{ ...td, fontWeight: 700, color: "#1a56a0" }}>{n2(r.payable)}</td>
                        <td style={td}>{r.b.premium_reasons.length ? reasonsText(r.b.premium_reasons) : "רגיל"}</td>
                        <td style={{ ...td, fontSize: 9, color: "#666" }}>{r.workers > 1 ? `×${r.workers} ` : ""}{r.s.notes || ""}</td>
                      </>
                    )}
                  </tr>
                ))}
                <tr style={{ background: "#eff6ff" }}>
                  <td colSpan={4} style={{ ...td, fontWeight: 700, color: "#1a56a0" }}>סה״כ {name}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{n2(g.totals.regular)}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#b45309" }}>{n2(g.totals.premium)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{n2(g.totals.actual)}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#1a56a0" }}>{n2(g.totals.payable)}</td>
                  <td colSpan={2} style={td} />
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Grand totals */}
      <div style={{ marginTop: 8, marginBottom: 16, breakInside: "avoid" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a56a0", borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginBottom: 8 }}>סה״כ כללי (כל העובדות)</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["סה״כ שעות רגילות", n2(grand.regular)],
              ["סה״כ שעות 150%", n2(grand.premium)],
              ["סה״כ שעות בפועל", n2(grand.actual)],
              ["סה״כ שעות לתשלום", n2(grand.payable)],
            ].map(([label, val]) => (
              <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ ...td, fontWeight: 600, width: "60%" }}>{label}</td>
                <td style={{ ...td, fontWeight: 700 }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Internal notes */}
      <div style={{ fontSize: 9, color: "#64748b", borderTop: "1px solid #e2e8f0", paddingTop: 8, lineHeight: 1.6 }}>
        <div>החישוב מבוסס על ימי החג והנתונים כפי שמופיעים במערכת בזמן הפקת הדוח.</div>
        <div>יש לוודא את כללי השכר הסופיים מול חשבות שכר / רואה חשבון.</div>
      </div>
    </div>
  );
}