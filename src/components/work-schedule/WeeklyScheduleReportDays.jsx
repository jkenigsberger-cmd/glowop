import { Moon } from "lucide-react";
import { groupShiftsByDay } from "@/lib/weeklyScheduleReport";

const sectionClasses = {
  OPERATIONS_MORNING: "bg-blue-50 border-blue-200 text-blue-950",
  OPERATIONS_EVENING: "bg-orange-50 border-orange-200 text-orange-950",
  NIGHT_ON_CALL: "bg-blue-950 border-blue-950 text-white",
  HOUSEKEEPING_MORNING: "bg-green-50 border-green-200 text-green-950",
  HOUSEKEEPING_EVENING: "bg-green-50 border-green-200 text-green-950",
  HOUSEKEEPING_MANAGER: "bg-emerald-50 border-emerald-200 text-emerald-950",
  MAINTENANCE: "bg-sky-50 border-sky-200 text-sky-950",
  PLANNED_ACTIVITY: "bg-slate-50 border-slate-200 text-slate-700",
};

export default function WeeklyScheduleReportDays({ schedule, shifts, weekStart }) {
  const days = groupShiftsByDay(schedule, shifts, weekStart).filter((day) => day.sections.length > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir="rtl">
      {days.map((day) => (
        <section key={day.date} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-3">{day.dayName} <span className="text-slate-400 font-normal">{day.dateLabel}</span></h3>
          <div className="space-y-2">
            {day.sections.map((section) => (
              <div key={section.type} className={`rounded-xl border p-3 ${sectionClasses[section.type] || "bg-slate-50 border-slate-200 text-slate-700"}`}>
                <div className="flex items-center gap-1.5 text-sm font-bold mb-1">{section.type === "NIGHT_ON_CALL" && <Moon className="w-4 h-4" />}{section.label}</div>
                {section.lines.map((line, idx) => <div key={idx} className="text-sm leading-6 whitespace-pre-wrap">{line}</div>)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}