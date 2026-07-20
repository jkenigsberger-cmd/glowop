/**
 * LogisticsReportTab — דוח לוגיסטיקה for common activity spaces.
 * Purple styling, Hebrew dates, card-based layout, print-safe portal.
 */
import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import "moment/locale/he";
import { Printer, Filter, X, Clock, MapPin, Users, Wrench, FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { equipmentTextSummary } from "@/components/schedule/LogisticsFields";
import { mergeSharedActivities } from "@/lib/mergeSharedActivities";
import { isOperationalGroup } from "@/lib/quotePreparationFlow";

moment.locale("he");

// Hebrew day names map (moment day index 0=Sunday)
const HEB_DAYS = ["יום ראשון","יום שני","יום שלישי","יום רביעי","יום חמישי","יום שישי","יום שבת"];

function fmtDateShort(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtDateHeading(d) {
  if (!d) return "";
  const m = moment(d);
  const dayName = HEB_DAYS[m.day()];
  return `${dayName}, ${fmtDateShort(d)}`;
}

function fmtNow() {
  return moment().format("DD/MM/YYYY HH:mm");
}

// ── Print portal helpers ───────────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body > * { display: none !important; }
  body > #logistics-print-portal { display: block !important; }
  @page { size: A4 portrait; margin: 15mm 14mm; }
  .day-section { page-break-inside: avoid; margin-bottom: 20px; }
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

function mountPrintPortal(html) {
  let el = document.getElementById("logistics-print-portal");
  if (!el) {
    el = document.createElement("div");
    el.id = "logistics-print-portal";
    document.body.appendChild(el);
  }
  el.innerHTML = html;
}

function unmountPrintPortal() {
  const el = document.getElementById("logistics-print-portal");
  if (el) el.innerHTML = "";
}

// ── Filter controls ───────────────────────────────────────────────────────────
function FiltersBar({ from, setFrom, to, setTo, spaceId, setSpaceId, groupId, setGroupId, spaces, groups, onClear }) {
  const hasFilter = from || to || spaceId || groupId;
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-semibold text-purple-800">סינון</span>
        {hasFilter && (
          <button onClick={onClear} className="mr-auto flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
            <X className="w-3.5 h-3.5" /> נקה סינון
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-purple-600 font-medium">מתאריך</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full border border-purple-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-purple-600 font-medium">עד תאריך</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full border border-purple-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-purple-600 font-medium">מרחב</label>
          <select value={spaceId} onChange={e => setSpaceId(e.target.value)}
            className="w-full border border-purple-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white">
            <option value="">כל המרחבים</option>
            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-purple-600 font-medium">קבוצה</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)}
            className="w-full border border-purple-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white">
            <option value="">כל הקבוצות</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Single activity card (screen) ─────────────────────────────────────────────
function ActivityCard({ row }) {
  const equipment = row.equipment || "אין ציוד מיוחד";

  if (row.isShared) {
    return (
      <div className="bg-white border-2 border-violet-400 rounded-xl p-4 space-y-3 shadow-sm">
        {/* Shared badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-violet-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            פעילות משותפת
          </span>
          <span className="text-[10px] text-violet-500 font-medium">
            מאוחד מ-{row.linkedGroups.length} קבוצות
          </span>
          {row.mismatched && (
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
              ⚠ פעילות משותפת עם נתונים לא תואמים
            </span>
          )}
        </div>

        {/* Time + space */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            {row.start_time || "?"} – {row.end_time || "?"}
          </span>
          <span className="flex items-center gap-1.5 bg-violet-100 text-violet-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200">
            <MapPin className="w-3.5 h-3.5" />
            {row.spaceName}
          </span>
        </div>

        {/* Activity name */}
        <div>
          <span className="text-xs text-slate-400 block">פעילות</span>
          <span className="font-semibold text-slate-800">{row.activity_name}</span>
        </div>

        {/* Total pax — prominent */}
        <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-bold text-violet-800">
              סה״כ משתתפים: {row.totalPax}
            </span>
            {row.missingPax && (
              <span className="text-[10px] text-amber-600">⚠ חסר מספר משתתפים לאחת הקבוצות</span>
            )}
          </div>
        </div>

        {/* Linked groups */}
        <div>
          <span className="text-xs text-slate-400 block mb-1">קבוצות משויכות:</span>
          <ul className="space-y-0.5">
            {row.linkedGroups.map(g => (
              <li key={g.groupId} className="flex items-center gap-2 text-xs text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                <span className="font-medium">{g.groupName}</span>
                {g.pax > 0 && <span className="text-slate-400">— {g.pax} משתתפים</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* Equipment */}
        <div className="flex items-start gap-2">
          <Wrench className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
          <span className={`text-xs ${row.equipment ? "text-violet-700 font-medium" : "text-slate-400"}`}>
            {equipment}
          </span>
        </div>

        {/* Notes */}
        {row.notes && (
          <div className="flex items-start gap-2 border-t border-slate-100 pt-2">
            <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <span className="text-xs text-slate-500">{row.notes}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-purple-100 rounded-xl p-4 space-y-3 shadow-sm">
      {/* Time + space */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          <Clock className="w-3.5 h-3.5" />
          {row.start_time || "?"} – {row.end_time || "?"}
        </span>
        <span className="flex items-center gap-1.5 bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-200">
          <MapPin className="w-3.5 h-3.5" />
          {row.spaceName}
        </span>
      </div>

      {/* Main info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-xs text-slate-400 block">קבוצה</span>
          <span className="font-semibold text-slate-800">{row.groupName}</span>
        </div>
        <div>
          <span className="text-xs text-slate-400 block">פעילות</span>
          <span className="text-slate-700">{row.activity_name}</span>
        </div>
        {row.pax > 0 && (
          <div>
            <span className="text-xs text-slate-400 block">משתתפים</span>
            <span className="flex items-center gap-1 text-slate-700">
              <Users className="w-3.5 h-3.5 text-slate-400" /> {row.pax}
            </span>
          </div>
        )}
      </div>

      {/* Equipment */}
      <div className="flex items-start gap-2">
        <Wrench className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
        <span className={`text-xs ${row.equipment ? "text-purple-700 font-medium" : "text-slate-400"}`}>
          {equipment}
        </span>
      </div>

      {/* Notes */}
      {row.notes && (
        <div className="flex items-start gap-2 border-t border-slate-100 pt-2">
          <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
          <span className="text-xs text-slate-500">{row.notes}</span>
        </div>
      )}
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
    queryFn: async () => (await base44.entities.Group.list("-arrival_date", 500)).filter(isOperationalGroup),
  });

  const spaceById = useMemo(() => Object.fromEntries(rawSpaces.map(s => [s.id, s])), [rawSpaces]);
  const groupById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);

  const activeGroupIds = useMemo(() => {
    const ids = new Set(scheduleItems.filter(i => i.activity_space_id).map(i => i.group_id));
    return groups.filter(g => ids.has(g.id));
  }, [scheduleItems, groups]);

  const rows = useMemo(() => {
    // Enrich all items first, then apply group filter awareness for shared activities
    const enriched = scheduleItems
      .filter(i => {
        if (!i.activity_space_id || !groupById[i.group_id]) return false;
        if (from && i.date < from) return false;
        if (to   && i.date > to)   return false;
        if (spaceId && i.activity_space_id !== spaceId) return false;
        // For groupId filter: include if it's this group, or if it's a shared
        // activity that includes this group (so we don't split the merged card)
        if (groupId) {
          if (i.group_id !== groupId) {
            if (!i.shared_activity_id) return false;
            try {
              const ids = JSON.parse(i.shared_activity_group_ids || "[]");
              if (!ids.includes(groupId)) return false;
            } catch { return false; }
          }
        }
        return true;
      })
      .map(i => ({
        ...i,
        spaceName: spaceById[i.activity_space_id]?.name || "—",
        groupName: groupById[i.group_id]?.group_name || "—",
        equipment: equipmentTextSummary(i),
      }));

    // Merge shared activities, then sort
    return mergeSharedActivities(enriched)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""));
  }, [scheduleItems, from, to, spaceId, groupId, spaceById, groupById]);

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

    // Purple print palette
    const PURPLE = "#7c3aed";
    const PURPLE_LIGHT = "#ede9fe";
    const PURPLE_BORDER = "#c4b5fd";

    const th = `padding:7px 10px;background:${PURPLE};color:#fff;font-weight:700;text-align:right;font-size:10px;border-left:1px solid #6d28d9;`;
    const tdBase = `padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;vertical-align:top;`;

    const fromLabel = from ? fmtDateShort(from) : "";
    const toLabel   = to   ? fmtDateShort(to)   : "";
    const rangeText = fromLabel && toLabel ? `${fromLabel} – ${toLabel}` : fromLabel || toLabel || "כל התאריכים";

    let html = `<div style="direction:rtl;font-family:'SimplerPro','Arial Hebrew',Arial,sans-serif;color:#111;">`;

    // Header
    html += `<div style="text-align:center;border-bottom:3px solid ${PURPLE};padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:20px;font-weight:700;color:${PURPLE};">דוח לוגיסטיקה — מרחבי פעילות</div>
      <div style="font-size:12px;color:#555;margin-top:5px;">תאריכים: ${rangeText}</div>
      <div style="font-size:10px;color:#999;margin-top:3px;">הופק: ${fmtNow()}</div>
    </div>`;

    if (rows.length === 0) {
      html += `<p style="text-align:center;color:#888;font-size:13px;padding:40px 0;">אין שימוש במרחבים בטווח התאריכים שנבחר</p>`;
    } else {
      Object.entries(byDate).forEach(([date, dateRows]) => {
        html += `<div class="day-section" style="margin-bottom:24px;page-break-inside:avoid;">
          <div style="background:${PURPLE_LIGHT};border:1px solid ${PURPLE_BORDER};border-radius:6px;padding:7px 12px;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:700;color:${PURPLE};">${fmtDateHeading(date)}</span>
            <span style="font-size:10px;color:#6d28d9;margin-right:8px;">${dateRows.length} פעילויות</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
            <thead><tr>
              ${["שעה","מרחב","קבוצה","פעילות","משתתפים","ציוד נדרש","הערות"].map(h => `<th style="${th}">${h}</th>`).join("")}
            </tr></thead>
            <tbody>`;
        dateRows.forEach((r, i) => {
          const bg = i % 2 === 0 ? "#fff" : "#faf5ff";
          const equip = r.equipment || "אין ציוד מיוחד";
          const equipColor = r.equipment ? PURPLE : "#9ca3af";

          if (r.isShared) {
            const groupList = r.linkedGroups.map(g => `${g.groupName}${g.pax ? ` (${g.pax})` : ""}`).join(", ");
            const sharedLabel = `<span style="background:#7c3aed;color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:8px;margin-left:4px;">משותפת</span>`;
            html += `<tr style="background:${bg};border-right:3px solid #7c3aed;">
              <td style="${tdBase}font-weight:700;white-space:nowrap;color:#7c3aed;">${r.start_time || ""}–${r.end_time || ""}</td>
              <td style="${tdBase}font-weight:600;color:#1e1b4b;">${r.spaceName}</td>
              <td style="${tdBase}font-size:9px;">${groupList}${sharedLabel}</td>
              <td style="${tdBase}">${r.activity_name}</td>
              <td style="${tdBase}text-align:center;font-weight:700;color:#7c3aed;">${r.totalPax || "—"}</td>
              <td style="${tdBase}color:${equipColor};">${equip}</td>
              <td style="${tdBase}color:#6b7280;font-size:9px;">${r.notes || ""}</td>
            </tr>`;
          } else {
            html += `<tr style="background:${bg};">
              <td style="${tdBase}font-weight:700;white-space:nowrap;color:${PURPLE};">${r.start_time || ""}–${r.end_time || ""}</td>
              <td style="${tdBase}font-weight:600;color:#1e1b4b;">${r.spaceName}</td>
              <td style="${tdBase}">${r.groupName}</td>
              <td style="${tdBase}">${r.activity_name}</td>
              <td style="${tdBase}text-align:center;">${r.pax || "—"}</td>
              <td style="${tdBase}color:${equipColor};">${equip}</td>
              <td style="${tdBase}color:#6b7280;font-size:9px;">${r.notes || ""}</td>
            </tr>`;
          }
        });
        html += `</tbody></table></div>`;
      });
    }

    html += `<div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:9px;color:#999;text-align:left;">סה״כ: ${rows.length} שורות</div>`;
    html += `</div>`;

    mountPrintPortal(html);
    setTimeout(() => {
      window.print();
      unmountPrintPortal();
    }, 100);
  };

  const rangeLabel = from && to
    ? `${fmtDateShort(from)} – ${fmtDateShort(to)}`
    : from ? `מ-${fmtDateShort(from)}` : "";

  return (
    <div className="space-y-5">
      {/* Page title bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-purple-900">דוח לוגיסטיקה — מרחבי פעילות</h2>
            {rangeLabel && <p className="text-xs text-purple-500">{rangeLabel}</p>}
          </div>
        </div>
        <Button onClick={handlePrint} className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
          <Printer className="w-4 h-4" /> הדפס דוח
        </Button>
      </div>

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

      {/* Count summary */}
      {rows.length > 0 && (
        <p className="text-xs text-purple-600 font-medium">
          {rows.length} פעילויות בטווח הנבחר
          {rows.some(r => r.isShared) && (
            <span className="mr-2 text-violet-500">
              (כולל {rows.filter(r => r.isShared).length} משותפות)
            </span>
          )}
        </p>
      )}

      {/* Content */}
      {rows.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-purple-200 rounded-xl">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-purple-200" />
          <p className="text-slate-500 text-sm font-medium">אין שימוש במרחבים בטווח התאריכים שנבחר</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(byDate).map(([date, dateRows]) => (
            <div key={date}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-600 text-white text-xs font-bold px-4 py-2 rounded-lg">
                  {fmtDateHeading(date)}
                </div>
                <span className="text-xs text-purple-400">{dateRows.length} פעילויות</span>
                <div className="flex-1 h-px bg-purple-100" />
              </div>

              {/* Activity cards */}
              <div className="space-y-3">
                {dateRows.map(r => <ActivityCard key={r.id} row={r} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}