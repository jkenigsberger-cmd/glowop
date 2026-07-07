import { Copy, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateWorkerPersonalMessage, groupCleaningContractorByDay, groupShiftsByWorker } from "@/lib/weeklyScheduleReport";

export default function WeeklyScheduleReportWorkers({ schedule, shifts, weekStart, onCopyWorker }) {
  const workers = groupShiftsByWorker(schedule, shifts);
  const cleaning = groupCleaningContractorByDay(schedule, shifts, weekStart);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {workers.map((worker) => (
          <section key={worker.key} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">{worker.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{worker.totalShifts} משמרות השבוע</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onCopyWorker(generateWorkerPersonalMessage(worker, schedule, weekStart))}>
                <Copy className="w-3.5 h-3.5" />
                העתק הודעה לעובד
              </Button>
            </div>
            <div className="space-y-3">
              {worker.days.map((day) => (
                <div key={day.date} className="border-r-4 border-primary/30 pr-3">
                  <div className="text-sm font-bold text-slate-700">{day.dayName} <span className="text-slate-400 font-normal">{day.dateLabel}</span></div>
                  {day.shifts.map((shift) => shift.isNight ? (
                    <div key={shift.id} className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-950 text-white px-2 py-0.5 text-xs font-semibold">
                      <Moon className="w-3 h-3" /> כונן לילה
                    </div>
                  ) : (
                    <div key={shift.id} className="text-sm text-slate-700 mt-1">{shift.label}{shift.time && ` · ${shift.time}`}{shift.notes && <span className="text-slate-500"> · {shift.notes}</span>}</div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {cleaning.length > 0 && (
        <section className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <h3 className="text-base font-bold text-green-900 mb-3">ניקיון קבלן</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {cleaning.map((day) => <div key={day.date} className="bg-white/70 border border-green-100 rounded-xl p-3 text-sm"><b>{day.dayName} {day.dateLabel}</b>{day.morning > 0 && <div>ניקיון בוקר: {day.morning} מנקות</div>}{day.evening > 0 && <div>ניקיון ערב: {day.evening} מנקות</div>}</div>)}
          </div>
        </section>
      )}
    </div>
  );
}