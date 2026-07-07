import { buildWeeklyScheduleReportData } from "@/lib/weeklyScheduleReport";

export default function WeeklyScheduleReportPreview({ schedule, shifts, weekStart }) {
  const data = buildWeeklyScheduleReportData(schedule, shifts, weekStart);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-slate-800" dir="rtl">
      <div className="border-b-2 border-primary pb-3 mb-3">
        <h2 className="text-lg font-bold">{data.title}</h2>
        <div className="text-xs text-slate-500 mt-1">{data.range} · {data.status}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.days.map((day) => (
          <section key={day.date} className="rounded-xl border border-slate-200 p-3 break-inside-avoid">
            <h3 className="text-sm font-bold text-primary mb-2">
              {day.dayName} <span className="font-normal text-slate-500">{day.dateLabel}</span>
            </h3>
            {day.sections.length === 0 ? (
              <p className="text-xs text-slate-400">אין משמרות מתוכננות</p>
            ) : (
              <div className="space-y-2">
                {day.sections.map((section) => (
                  <div key={section.type}>
                    <div className="text-xs font-semibold text-slate-600 mb-0.5">{section.label}</div>
                    <div className="space-y-0.5">
                      {section.lines.map((line, idx) => (
                        <div key={idx} className="text-xs leading-5 whitespace-pre-wrap">{line}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}