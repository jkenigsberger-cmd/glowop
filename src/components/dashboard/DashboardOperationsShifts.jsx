import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ROW_BY_TYPE, fmtShiftTime } from "@/lib/workScheduleConfig";

const SHIFT_TYPES = ["OPERATIONS_MORNING", "OPERATIONS_EVENING", "NIGHT_ON_CALL"];

export default function DashboardOperationsShifts({ selectedDate }) {
  const { data: shifts = [] } = useQuery({
    queryKey: ["dashboardOperationsShifts", selectedDate],
    queryFn: () => base44.entities.WorkShift.filter({ date: selectedDate, status: "PLANNED" }),
  });
  const relevantShifts = useMemo(() => shifts.filter(shift => SHIFT_TYPES.includes(shift.row_type)), [shifts]);
  const { data: workers = [] } = useQuery({
    queryKey: ["dashboardShiftWorkers"],
    queryFn: () => base44.entities.WorkerProfile.list("full_name", 300),
    enabled: relevantShifts.length > 0,
  });
  const workerById = useMemo(() => Object.fromEntries(workers.map(worker => [worker.id, worker])), [workers]);
  if (relevantShifts.length === 0) return null;

  return (
    <section className="space-y-3" dir="rtl">
      <h2 className="flex items-center gap-2 border-b border-border pb-1.5 text-base font-bold text-foreground">
        <UsersRound className="h-4 w-4 text-slate-500" />
        צוות תפעול בבית (מסידור עבודה)
      </h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {SHIFT_TYPES.map(type => {
          const shift = relevantShifts.find(item => item.row_type === type);
          const meta = ROW_BY_TYPE[type];
          const workerName = shift?.worker_name || workerById[shift?.worker_id]?.full_name || "לא שובץ";
          const time = shift ? fmtShiftTime(shift.start_time, shift.end_time) : "";
          return (
            <div key={type} className={`rounded-xl border px-3 py-2.5 ${meta.chip}`}>
              <div className="text-xs font-semibold opacity-75">{meta.label}</div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="font-bold">{workerName}</span>
                {time && <span className="text-xs opacity-70" dir="ltr">{time}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}