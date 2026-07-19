import MonthlyWorkerRow from "@/components/work-schedule/MonthlyWorkerRow";

export default function MonthlyReportTable({ workers }) {
  if (!workers.length) return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-400">לא נמצאו משמרות שפורסמו בחודש זה</div>;
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3 text-right">עובד</th><th className="p-3">ימי עבודה</th><th className="p-3">משמרות בוקר</th><th className="p-3">משמרות ערב</th><th className="p-3">כונן לילה</th><th className="p-3">שעות משוערות</th><th className="p-3">ימים</th></tr></thead><tbody>{workers.map((worker) => <MonthlyWorkerRow key={worker.worker_id} worker={worker} />)}</tbody></table></div>;
}