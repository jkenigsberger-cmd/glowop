/**
 * Print template for the housekeeping monthly HOURS report (hours only — no money).
 * A4 portrait, ONE unified flat table for all shifts, repeating header on each page,
 * no row split across pages, compact totals box. The 150% logic is untouched.
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

const COLS = [
  "תאריך", "יום", "עובדת / תיאור", "כמות", "כניסה", "יציאה",
  "רגילות", "150%", "בפועל", "לתשלום", "סיבת 150%", "הערות",
];

export default function CleaningHoursPrintTemplate({ shifts, holidays = [], from, to }) {
  const holidayDates = (holidays || []).filter((h) => h.is_active).map((h) => h.date);

  const grand = { regular: 0, premium: 0, actual: 0, payable: 0 };
  let incompleteCount = 0;

  const rows = shifts
    .filter((s) => s.status === "ACTIVE" && s.date >= from && s.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
    .map((s) => {
      const b = calculateCleaningPayrollBreakdown(s, holidayDates);
      const workers = Number(s.workers_count) || 1;
      const row = {
        s, b, workers,
        label: s.label?.trim() || "ללא שם",
        regular: b.regular_hours * workers,
        premium: b.premium_150_hours * workers,
        actual: b.actual_hours * workers,
        payable: b.payable_hours * workers,
      };
      if (b.incomplete) {
        incompleteCount += 1;
      } else {
        grand.regular += row.regular;
        grand.premium += row.premium;
        grand.actual += row.actual;
        grand.payable += row.payable;
      }
      return row;
    });

  return (
    <div id="cleaning-print-root">
      <style>{`
        @page { size: A4 portrait; margin: 12mm 10mm; }
        #cleaning-print-root {
          direction: rtl;
          font-family: "SimplerPro", "Arial Hebrew", Arial, sans-serif;
          color: #111;
          font-size: 9px;
          line-height: 1.35;
        }
        #cleaning-print-root .hp-head {
          text-align: center;
          border-bottom: 2px solid #1a56a0;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        #cleaning-print-root .hp-title {
          font-size: 16px; font-weight: 700; color: #1a56a0;
          font-family: "Kav16", "Arial Hebrew", Arial, sans-serif;
        }
        #cleaning-print-root .hp-period { font-size: 10px; color: #555; margin-top: 3px; }
        #cleaning-print-root .hp-explain {
          background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px;
          padding: 5px 8px; margin-bottom: 8px; font-size: 9px;
        }
        #cleaning-print-root .hp-warn { font-size: 8.5px; color: #b45309; margin-bottom: 6px; }
        #cleaning-print-root table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        #cleaning-print-root thead { display: table-header-group; }
        #cleaning-print-root tr { page-break-inside: avoid; break-inside: avoid; }
        #cleaning-print-root th {
          background: #1a56a0; color: #fff; font-weight: 700; font-size: 8px;
          padding: 4px 3px; text-align: right; border: 1px solid #1a56a0;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        #cleaning-print-root td {
          padding: 3px; border: 1px solid #d8e0ea; font-size: 8.5px;
          text-align: right; word-break: break-word; overflow-wrap: anywhere;
        }
        #cleaning-print-root tbody tr:nth-child(even) td { background: #f8fafc; }
        #cleaning-print-root .hp-total-row td {
          background: #eff6ff; font-weight: 700;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        #cleaning-print-root .hp-pay { color: #1a56a0; font-weight: 700; }
        #cleaning-print-root .hp-prem { color: #b45309; }
        #cleaning-print-root .hp-box {
          margin-top: 10px; display: flex; gap: 8px;
        }
        #cleaning-print-root .hp-stat {
          flex: 1; border: 1px solid #cbd5e1; border-radius: 4px;
          padding: 6px; text-align: center;
        }
        #cleaning-print-root .hp-stat b { display: block; font-size: 13px; color: #1a56a0; }
        #cleaning-print-root .hp-stat span { font-size: 8px; color: #555; }
        #cleaning-print-root .hp-notes {
          margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0;
          font-size: 7.5px; color: #64748b; line-height: 1.5;
        }
      `}</style>

      <div className="hp-head">
        <div className="hp-title">דוח שעות עובדות ניקיון — חישוב 150%</div>
        <div className="hp-period">מתאריך {fmtDate(from)} עד תאריך {fmtDate(to)}</div>
      </div>

      <div className="hp-explain">
        <strong>חישוב שעות לתשלום:</strong> שעות רגילות × 1.0 + שעות 150% × 1.5 = שעות לתשלום
        <span style={{ color: "#64748b", marginRight: 6 }}>(דוגמה: 1.00 × 1.0 + 2.00 × 1.5 = 4.00)</span>
      </div>

      {incompleteCount > 0 && (
        <div className="hp-warn">{incompleteCount} משמרות ללא שעת יציאה / לא הושלמו — אינן נכללות בסיכום.</div>
      )}

      {rows.length === 0 ? (
        <p style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>אין משמרות בטווח התאריכים שנבחר</p>
      ) : (
        <table>
          <colgroup>
            <col style={{ width: "8%" }} /><col style={{ width: "6%" }} /><col style={{ width: "13%" }} />
            <col style={{ width: "5%" }} /><col style={{ width: "6%" }} /><col style={{ width: "6%" }} />
            <col style={{ width: "7%" }} /><col style={{ width: "7%" }} /><col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} /><col style={{ width: "12%" }} /><col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr>{COLS.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.s.id}>
                <td>{fmtDate(r.s.date)}</td>
                <td>{dowLabel(r.s.date)}</td>
                <td>{r.label}</td>
                <td style={{ textAlign: "center" }}>{r.workers}</td>
                <td>{r.s.start_time}</td>
                <td>{r.s.end_time || "—"}</td>
                {r.b.incomplete ? (
                  <td colSpan={6} style={{ color: "#b45309" }}>חסר שעת יציאה / משמרת לא הושלמה</td>
                ) : (
                  <>
                    <td>{n2(r.regular)}</td>
                    <td className="hp-prem">{n2(r.premium)}</td>
                    <td>{n2(r.actual)}</td>
                    <td className="hp-pay">{n2(r.payable)}</td>
                    <td>{r.b.premium_reasons.length ? reasonsText(r.b.premium_reasons) : "—"}</td>
                    <td>{r.s.notes || ""}</td>
                  </>
                )}
              </tr>
            ))}
            <tr className="hp-total-row">
              <td colSpan={6}>סה״כ כללי (כל העובדות)</td>
              <td>{n2(grand.regular)}</td>
              <td className="hp-prem">{n2(grand.premium)}</td>
              <td>{n2(grand.actual)}</td>
              <td className="hp-pay">{n2(grand.payable)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      )}

      {rows.length > 0 && (
        <div className="hp-box">
          <div className="hp-stat"><b>{n2(grand.regular)}</b><span>סה״כ שעות רגילות</span></div>
          <div className="hp-stat"><b>{n2(grand.premium)}</b><span>סה״כ שעות 150%</span></div>
          <div className="hp-stat"><b>{n2(grand.actual)}</b><span>סה״כ שעות בפועל</span></div>
          <div className="hp-stat"><b>{n2(grand.payable)}</b><span>סה״כ שעות לתשלום</span></div>
        </div>
      )}

      <div className="hp-notes">
        <div>החישוב מבוסס על ימי החג והנתונים כפי שמופיעים במערכת בזמן הפקת הדוח.</div>
        <div>יש לוודא את כללי השכר הסופיים מול חשבות שכר / רואה חשבון.</div>
      </div>
    </div>
  );
}