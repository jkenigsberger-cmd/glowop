import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fmtHours, fmtReportDate, TEAM_LABELS } from "@/lib/monthlyWorkReport";

export default function MonthlyWorkerRow({ worker }) {
  const [open, setOpen] = useState(false);
  return <>
    <tr className="border-b border-slate-100 align-top">
      <td className="p-3 font-semibold text-slate-800">{worker.worker_name}<div className="text-[11px] font-normal text-slate-400">{TEAM_LABELS[worker.team] || worker.team}</div></td>
      <td className="p-3 text-center font-bold">{worker.total_days}</td>
      <td className="p-3 text-center font-bold">{worker.total_shifts}</td>
      <td className="p-3 text-center">{worker.morning_shifts}</td>
      <td className="p-3 text-center">{worker.evening_shifts}</td>
      <td className="p-3 text-center font-bold text-cyan-700">{worker.night_on_call_count}</td>
      <td className="p-3 text-center">{fmtHours(worker.estimated_hours)}</td>
      <td className="p-3"><button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs font-medium text-primary">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} פירוט ימים</button></td>
    </tr>
    {open && <tr className="border-b border-slate-200 bg-slate-50"><td colSpan="8" className="p-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{worker.details.map((item, index) => <div key={`${item.date}-${item.row_type}-${index}`} className="rounded-lg border bg-white px-3 py-2 text-xs"><strong>{fmtReportDate(item.date)}</strong> · {item.row_label}<div className="text-slate-500">{item.is_night_on_call ? "לינה במקום" : `${item.start_time || "—"}–${item.end_time || "—"} · ${fmtHours(item.estimated_hours)} שעות`}</div></div>)}</div></td></tr>}
  </>;
}