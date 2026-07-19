import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MonthlyReportControls({ month, onMonthChange, workers, workerId, onWorkerChange, onPrint, disabled }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="space-y-1 text-xs font-medium text-slate-600">
        <span>חודש</span>
        <Input type="month" value={month} onChange={(event) => event.target.value && onMonthChange(event.target.value)} className="w-40" />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-600">
        <span>עובד</span>
        <select value={workerId} onChange={(event) => onWorkerChange(event.target.value)} className="flex h-9 min-w-52 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="ALL">כל העובדים</option>
          {workers.map((worker) => <option key={worker.worker_id} value={worker.worker_id}>{worker.worker_name}</option>)}
        </select>
      </label>
      <div className="flex-1" />
      <Button type="button" variant="outline" size="sm" onClick={onPrint} disabled={disabled}>
        <Printer className="w-4 h-4" /> הדפס / PDF
      </Button>
    </div>
  );
}