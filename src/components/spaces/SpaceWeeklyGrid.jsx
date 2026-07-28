import moment from "moment";
import "moment/locale/he";
import { cn } from "@/lib/utils";
import { isBlockVisibleOnCalendarDate } from "@/lib/activitySpaceBlocks";
import { equipmentTextSummary } from "@/components/schedule/LogisticsFields";

moment.locale("he");

const HEB_DAYS = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"];

function getWeekDates(pivot) {
  const start = moment(pivot).startOf("isoWeek");
  return Array.from({ length: 7 }, (_, i) => start.clone().add(i, "days"));
}

const HEAT = [
  "bg-slate-50 text-slate-300",    // 0
  "bg-emerald-50 text-emerald-700 border border-emerald-200",   // 1
  "bg-amber-50 text-amber-700 border border-amber-200",         // 2-3
  "bg-orange-100 text-orange-800 border border-orange-300",     // 4+
];

function heatClass(count) {
  if (count === 0) return HEAT[0];
  if (count === 1) return HEAT[1];
  if (count <= 3) return HEAT[2];
  return HEAT[3];
}

const SPACE_TYPE_LABELS = { BUNKER: "בונקר", OHEL_MOED: "אוהל מועד", DINING_HALL: "חדר אוכל" };

export default function SpaceWeeklyGrid({ spaces, allItems, blocks = [], pivot, onSelectDay, onSelectStandalone }) {
  const weekDates = getWeekDates(pivot);
  const today = moment().format("YYYY-MM-DD");

  return (
    <div className="overflow-x-auto" dir="rtl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-right px-3 py-2.5 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500 min-w-[140px]">
              מרחב
            </th>
            {weekDates.map((d, i) => {
              const isToday = d.format("YYYY-MM-DD") === today;
              return (
                <th
                  key={i}
                  className={cn(
                    "text-center px-2 py-2.5 border border-slate-200 text-xs font-semibold min-w-[80px]",
                    isToday ? "bg-primary text-primary-foreground" : "bg-slate-50 text-slate-500"
                  )}
                >
                  <div>{HEB_DAYS[i]}</div>
                  <div className={cn("font-bold text-sm", isToday ? "text-white" : "text-slate-700")}>
                    {d.format("D/M")}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {spaces.map((space) => (
            <tr key={space.id} className="hover:bg-slate-50/50 transition-colors">
              {/* Space label */}
              <td className="px-3 py-2.5 border border-slate-200 bg-white">
                <div className="font-semibold text-slate-700 text-xs">{space.name}</div>
                <div className="text-[10px] text-slate-400">
                  {SPACE_TYPE_LABELS[space.space_type] || space.space_type}
                </div>
              </td>
              {weekDates.map((d) => {
                const dateStr = d.format("YYYY-MM-DD");
                const cellItems = allItems.filter((i) => i.activity_space_id === space.id && i.date === dateStr);
                const count = cellItems.length;
                const standaloneItems = cellItems.filter((item, index, rows) => item.standalone && rows.findIndex((row) => row.reservationId === item.reservationId) === index);
                const blockCount = blocks.filter(block =>
                  block.activity_space_id === space.id && isBlockVisibleOnCalendarDate(block, dateStr)
                ).length;
                const hasContent = count > 0 || blockCount > 0;

                return (
                  <td key={dateStr} className="border border-slate-200 p-1 text-center align-top">
                    <button
                      type="button"
                      onClick={() => hasContent && onSelectDay(dateStr)}
                      disabled={!hasContent}
                      className={cn("w-full h-10 rounded-lg text-xs font-bold transition-all", blockCount > 0 ? "bg-amber-100 text-amber-800 border border-amber-300" : heatClass(count), hasContent && "hover:shadow-md cursor-pointer")}
                    >
                      {blockCount > 0 ? `חסום${count > 0 ? ` · ${count}` : ""}` : count > 0 ? count : "—"}
                    </button>
                    {standaloneItems.map((item) => (
                      <button key={item.reservationId} type="button" onClick={() => onSelectStandalone?.(item.reservationId)} className="mt-1 w-full rounded bg-purple-50 px-1 py-1 text-[9px] text-purple-700 hover:bg-purple-100">
                        <span className="block font-bold">פעילות כללית</span>
                        <span className="block truncate font-semibold">{item.activityName}</span>
                        <span className="block" dir="ltr">{dateStr} · {item.start_time}–{item.end_time}</span>
                        {item.pax > 0 && <span className="block">{item.pax} משתתפים</span>}
                        {item.spaceNames?.length > 0 && <span className="block truncate">{item.spaceNames.join(", ")}</span>}
                        {item.organizer_name && <span className="block truncate">אחראי: {item.organizer_name}</span>}
                        {equipmentTextSummary(item) && <span className="block truncate">ציוד: {equipmentTextSummary(item)}</span>}
                        <span className="block font-semibold underline">פרטים ועריכה</span>
                      </button>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}