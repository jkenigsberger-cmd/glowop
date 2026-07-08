import { renderToStaticMarkup } from "react-dom/server";
import { addDays, DAY_NAMES, fmtDM, fmtShiftTime, ROW_TYPES } from "@/lib/workScheduleConfig";

const STATUS_LABELS = {
  DRAFT: "טיוטה",
  PUBLISHED: "פורסם",
  ARCHIVED: "בארכיון",
};

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function formatShiftForPdf(shift, row) {
  if (row.textOnly) return shift.notes || "";

  if (row.countBased) {
    const count = Number(shift.worker_count || 0);
    return count > 0 ? `${count} מנקות` : "";
  }

  if (shift.row_type === "NIGHT_ON_CALL") {
    return shift.worker_name || shift.notes || "";
  }

  const time = fmtShiftTime(shift.start_time, shift.end_time);
  if (shift.worker_name && time) return `${shift.worker_name} ${time}`;
  if (shift.worker_name) return shift.worker_name;
  if (time) return time;
  return shift.notes || "";
}

function getCellItems(shifts, date, row) {
  return shifts
    .filter((shift) => shift.status === "PLANNED" && shift.date === date && shift.row_type === row.type)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "") || (a.worker_name || "").localeCompare(b.worker_name || ""))
    .map((shift) => formatShiftForPdf(shift, row))
    .filter(Boolean);
}

export default function WeeklySchedulePdfView({ schedule, shifts = [], weekStart }) {
  const weekDates = getWeekDates(weekStart);
  const weekEnd = addDays(weekStart, 6);

  return (
    <main className="weekly-pdf" dir="rtl">
      <header className="pdf-header">
        <div>
          <h1>סידור עבודה שבועי</h1>
          <p className="date-range">{fmtDM(weekStart)} – {fmtDM(weekEnd)}</p>
        </div>
        <div className="status-box">
          <span>סטטוס</span>
          <strong>{STATUS_LABELS[schedule?.status] || schedule?.status || "—"}</strong>
        </div>
      </header>

      <table className="schedule-table">
        <thead>
          <tr>
            <th className="row-title">תחום</th>
            {weekDates.map((date, index) => (
              <th key={date}>
                <div>{DAY_NAMES[index]}</div>
                <small>{fmtDM(date)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_TYPES.map((row) => (
            <tr key={row.type}>
              <th className="row-title">{row.label}</th>
              {weekDates.map((date) => {
                const items = getCellItems(shifts, date, row);
                return (
                  <td key={`${row.type}-${date}`}>
                    {items.map((item, index) => (
                      <div className="shift-line" key={`${item}-${index}`}>{item}</div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const PDF_STYLES = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #ffffff;
    color: #172033;
    direction: rtl;
    font-family: Arial, "Arial Hebrew", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .weekly-pdf { width: 100%; }
  .pdf-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid #1d4ed8;
  }
  h1 {
    margin: 0 0 3px 0;
    font-size: 22px;
    line-height: 1.1;
    color: #0f172a;
  }
  .date-range {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: #475569;
  }
  .status-box {
    min-width: 92px;
    padding: 6px 10px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
    text-align: center;
  }
  .status-box span {
    display: block;
    font-size: 9px;
    color: #64748b;
    margin-bottom: 2px;
  }
  .status-box strong {
    display: block;
    font-size: 13px;
    color: #0f172a;
  }
  .schedule-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10.5px;
    line-height: 1.28;
  }
  th, td {
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }
  thead th {
    background: #eff6ff;
    color: #0f172a;
    padding: 6px 4px;
    text-align: center;
    font-weight: 800;
  }
  thead small {
    display: block;
    margin-top: 2px;
    font-size: 9px;
    color: #475569;
    font-weight: 700;
  }
  .row-title {
    width: 92px;
    background: #f8fafc;
    color: #334155;
    text-align: right;
    font-weight: 800;
    padding: 6px 6px;
  }
  tbody td {
    height: 42px;
    padding: 4px 5px;
    color: #1e293b;
  }
  tbody tr:nth-child(even) td { background: #fcfcfd; }
  .shift-line {
    display: block;
    margin: 0 0 3px 0;
    padding: 2px 4px;
    border-radius: 5px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    font-weight: 700;
    word-break: break-word;
  }
  .shift-line:last-child { margin-bottom: 0; }
  @media print {
    body { width: 100%; }
    .pdf-header { break-after: avoid; }
    tr { break-inside: avoid; page-break-inside: avoid; }
  }
`;

export function generateWeeklySchedulePdfHtml(schedule, shifts, weekStart) {
  const markup = renderToStaticMarkup(
    <WeeklySchedulePdfView schedule={schedule} shifts={shifts} weekStart={weekStart} />
  );

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>סידור עבודה שבועי</title>
  <style>${PDF_STYLES}</style>
</head>
<body>${markup}</body>
</html>`;
}