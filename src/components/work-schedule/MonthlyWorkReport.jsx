import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import MonthlyReportControls from "@/components/work-schedule/MonthlyReportControls";
import MonthlyReportTable from "@/components/work-schedule/MonthlyReportTable";
import { generateMonthlyWorkReportHtml } from "@/lib/monthlyWorkReportPdf";

const currentMonth = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };

export default function MonthlyWorkReport() {
  const [month, setMonth] = useState(currentMonth);
  const [workerId, setWorkerId] = useState("ALL");
  const [year, monthNumber] = month.split("-").map(Number);
  const { data, isLoading, error } = useQuery({ queryKey: ["monthlyWorkReport", year, monthNumber], queryFn: async () => (await base44.functions.invoke("getMonthlyWorkReport", { year, month: monthNumber })).data });
  const workers = data?.workers || [];
  const visibleWorkers = useMemo(() => workerId === "ALL" ? workers : workers.filter((worker) => worker.worker_id === workerId), [workers, workerId]);
  const handlePrint = () => { const printWindow = window.open("", "_blank"); if (!printWindow) return; printWindow.document.write(generateMonthlyWorkReportHtml(data, visibleWorkers, month)); printWindow.document.close(); printWindow.focus(); setTimeout(() => printWindow.print(), 250); };

  return <div className="space-y-4">
    <MonthlyReportControls month={month} onMonthChange={(value) => { setMonth(value); setWorkerId("ALL"); }} workers={workers} workerId={workerId} onWorkerChange={setWorkerId} onPrint={handlePrint} disabled={isLoading || !data} />
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">הדוח מבוסס רק על סידורי עבודה שפורסמו. חישוב השעות הוא הערכה לפי שעות ההתחלה והסיום בסידור ואינו מחליף את דוח הנוכחות ב-Connecteam.</div>
    {isLoading ? <div className="p-10 text-center text-sm text-slate-400">טוען דוח חודשי...</div> : error ? <div className="p-6 text-center text-sm text-destructive">לא ניתן לטעון את הדוח</div> : <MonthlyReportTable workers={visibleWorkers} />}
  </div>;
}