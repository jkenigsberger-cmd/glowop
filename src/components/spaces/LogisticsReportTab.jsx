/**
 * LogisticsReportTab — דוח לוגיסטיקה for common activity spaces.
 * Data: GroupScheduleItem (status=ACTIVE, has activity_space_id), ActivitySpace, Group.
 * Print-safe: uses window.print() with a dedicated print style block.
 */
import { useMemo, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import "moment/locale/he";
import { Printer, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { equipmentTextSummary } from "@/components/schedule/LogisticsFields";

moment.locale("he");

function fmtDate(d) {
  if (!d) return "";
  try {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  } catch { return d; }
}

function fmtDateHeb(d) {
  if (!d) return "";
  return moment(d).format("dddd, D MMMM YYYY");
}

// ── Print styles injected once ────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body > *:not(#logistics-print-root) { display: none !important; }
  #logistics-print-root { display: block !important; }
  @page { size: A4 portrait; margin: 15mm 14mm; }
  tr { page-break-inside: avoid; }
}
`;

function injectPrintStyle() {
  if (document.getElementById("logistics-print-style")) return;
  const s = document.createElement("style");
  s.id = "logistics-print-style";
  s.textContent = PRINT_STYLE;
  document.head.appendChild(s);
}

// ── Filter controls ───────────────────────────────────────────────────────────
function FiltersBar({ from, setFrom, to, setTo, spaceId, setSpaceId, groupId, setGroupId, spaces, groups, onClear }) {
  const hasFilter = from || to || spaceId || groupId;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">סינון</span>
        {hasFilter && (
          <button onClick={onClear} className="mr-auto flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
            <X className="w-3.5 h-3.5" /> נקה סינון
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">מתאריך</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">עד תאריך</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">מרחב</label>
          <select value={spaceId} onChange={e => setSpaceId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30 bg-white">
            <option value="">כל המרחבים</option>
            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">קבוצה</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30 bg-white">
            <option value="">כל הקבוצות</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Print template ────────────────────────────────────────────────────────────
function PrintTemplate({ rows, from, to, fromLabel, toLabel }) {
  const th = {
    padding: "7px 8px",
    background: "#1a56a0", color: "#fff", fontWeight: 700,
    textAlign: "right", fontSize: 10, borderRight: "1px solid #1565b0",
  };
  const td = (extra = {}) => ({
    padding: "6px 8px", borderBottom: "1px solid #e2e8f0",
    fontSize: 10, verticalAlign: "top", ...extra,
  });

  // Group by date
  const byDate = {};
  rows.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  return (
    <div id="logistics-print-root" style={{ display: "none", direction: "rtl",
      fontFamily: '"SimplerPro","Arial Hebrew",Arial,sans-serif', color: "#111" }}>

      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #1a56a0", paddingBottom: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1a56a0", fontFamily: '"Kav16","Arial Hebrew",Arial,sans-serif' }}>
          דוח לוגיסטיקה — מרחבי פעילות
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
          {fromLabel && toLabel ? `${fromLabel} – ${toLabel}` : fromLabel || toLabel || "כל התאריכים"}
        </div>
        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>הופק: {moment().format("DD/MM/YYYY HH:mm")}</div>
      </div>

      {rows.length === 0 && (
        <p style={{ textAlign: "center", color: "#888", fontSize: 11 }}>אין נתונים בטווח שנבחר</p>
      )}

      {Object.entries(byDate).map(([date, dateRows]) => (
        <div key={date} style={{ marginBottom: 18, pageBreakInside: "avoid" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a56a0", borderBottom: "1px solid #cbd5e1", paddingBottom: 4, marginBottom: 8 }}>
            {fmtDateHeb(date)}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["שעה", "מרחב / חדר", "קבוצה", "פעילות", "משתתפים", "ציוד נדרש", "הערות"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dateRows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={td({ whiteSpace: "nowrap" })}>{r.start_time}–{r.end_time}</td>
                  <td style={td({ fontWeight: 600 })}>{r.spaceName}</td>
                  <td style={td()}>{r.groupName}</td>
                  <td style={td()}>{r.activity_name}</td>
                  <td style={td({ textAlign: "center" })}>{r.pax || "—"}</td>
                  <td style={td({ color: "#1e40af" })}>{r.equipment || "—"}</td>
                  <td style={td({ color: "#555", fontSize: 9 })}>{r.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ marginTop: 20, borderTop: "1px solid #e2e8f0", paddingTop: 8, fontSize: 9, color: "#999", textAlign: "left" }}>
        סה״כ שורות: {rows.length}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LogisticsReportTab() {
  const today = moment().format("YYYY-MM-DD");
  const [from, setFrom] = useState(today);
  const [to, setTo]     = useState(moment().add(7, "days").format("YYYY-MM-DD"));
  const [spaceId, setSpaceId]   = useState("");
  const [groupId, setGroupId]   = useState("");

  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["spaces-schedule-items"],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ status: "ACTIVE" }),
  });
  const { data: rawSpaces = [] } = useQuery({
    queryKey: ["spaces-list"],
    queryFn: () => base44.entities.ActivitySpace.list(),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["spaces-groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 500),
  });

  const spaceById = useMemo(() => Object.fromEntries(rawSpaces.map(s => [s.id, s])), [rawSpaces]);
  const groupById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);

  // Groups that appear in schedule items (for filter dropdown)
  const activeGroupIds = useMemo(() => {
    const ids = new Set(scheduleItems.filter(i => i.activity_space_id).map(i => i.group_id));
    return groups.filter(g => ids.has(g.id));
  }, [scheduleItems, groups]);

  const rows = useMemo(() => {
    return scheduleItems
      .filter(i => {
        if (!i.activity_space_id) return false;
        if (from && i.date < from) return false;
        if (to   && i.date > to)   return false;
        if (spaceId && i.activity_space_id !== spaceId) return false;
        if (groupId && i.group_id !== groupId) return false;
        return true;
      })
      .map(i => ({
        ...i,
        spaceName: spaceById[i.activity_space_id]?.name || "—",
        groupName: groupById[i.group_id]?.group_name || "—",
        equipment: equipmentTextSummary(i),
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""));
  }, [scheduleItems, from, to, spaceId, groupId, spaceById, groupById]);

  // Group by date for screen display
  const byDate = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [rows]);

  const handlePrint = () => {
    injectPrintStyle();
    // Show print root, print, then hide
    const el = document.getElementById("logistics-print-root");
    if (el) el.style.display = "block";
    window.print();
    if (el) el.style.display = "none";
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <FiltersBar
        from={from} setFrom={setFrom}
        to={to} setTo={setTo}
        spaceId={spaceId} setSpaceId={setSpaceId}
        groupId={groupId} setGroupId={setGroupId}
        spaces={rawSpaces}
        groups={activeGroupIds}
        onClear={() => { setFrom(today); setTo(moment().add(7, "days").format("YYYY-MM-DD")); setSpaceId(""); setGroupId(""); }}
      />

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-600">
          {rows.length > 0
            ? <span>{rows.length} פעילויות בטווח הנבחר</span>
            : <span className="text-slate-400">אין נתונים להצגה</span>
          }
        </div>
        <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
          <Printer className="w-4 h-4" /> הדפס דוח
        </Button>
      </div>

      {/* Screen table */}
      {rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
          אין פעילויות בטווח התאריכים הנבחר
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDate).map(([date, dateRows]) => (
            <div key={date}>
              <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 mb-2">
                {fmtDateHeb(date)}
                <span className="mr-2 text-xs font-normal text-slate-400">{fmtDate(date)}</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs">
                      <th className="text-right px-3 py-2 font-semibold">שעה</th>
                      <th className="text-right px-3 py-2 font-semibold">מרחב</th>
                      <th className="text-right px-3 py-2 font-semibold">קבוצה</th>
                      <th className="text-right px-3 py-2 font-semibold">פעילות</th>
                      <th className="text-right px-3 py-2 font-semibold">משתתפים</th>
                      <th className="text-right px-3 py-2 font-semibold">ציוד נדרש</th>
                      <th className="text-right px-3 py-2 font-semibold">הערות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateRows.map((r, i) => (
                      <tr key={r.id} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap font-mono text-xs">{r.start_time}–{r.end_time}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{r.spaceName}</td>
                        <td className="px-3 py-2.5 text-slate-700">{r.groupName}</td>
                        <td className="px-3 py-2.5 text-slate-700">{r.activity_name}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600">{r.pax || "—"}</td>
                        <td className="px-3 py-2.5">
                          {r.equipment
                            ? <span className="text-blue-700 font-medium text-xs">{r.equipment}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{r.notes || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden print template */}
      <PrintTemplate
        rows={rows}
        from={from}
        to={to}
        fromLabel={from ? fmtDate(from) : ""}
        toLabel={to ? fmtDate(to) : ""}
      />
    </div>
  );
}