import { Button } from "@/components/ui/button";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, REQUEST_TYPE_LABELS } from "@/lib/workScheduleRequestLabels";

export default function WorkerRequestsList({ requests, onCancel }) {
  if (!requests.length) return <div className="rounded-xl border bg-slate-50 p-5 text-center text-sm text-slate-500">עדיין אין בקשות</div>;
  return <div className="space-y-2">{requests.map((request) => <div key={request.id} className="rounded-xl border bg-white p-3 shadow-sm">
    <div className="flex justify-between gap-3"><div><b className="text-sm">{REQUEST_TYPE_LABELS[request.request_type] || request.request_type}</b><div className="text-xs text-slate-500 mt-1">{request.start_date || request.date || "ללא תאריך"}{request.end_date && request.end_date !== request.start_date ? ` – ${request.end_date}` : ""}{request.start_time || request.end_time ? ` · ${request.start_time || ""}–${request.end_time || ""}` : ""}</div></div><span className={`h-fit rounded-full border px-2 py-0.5 text-[11px] ${REQUEST_STATUS_STYLES[request.status]}`}>{REQUEST_STATUS_LABELS[request.status]}</span></div>
    <div className="text-sm mt-2 whitespace-pre-wrap">{request.message || request.requested_change_text || request.notes}</div>
    {request.admin_response && <div className="mt-2 rounded-lg border bg-slate-50 p-2 text-xs">תגובת מנהל: {request.admin_response}</div>}
    {request.status === "PENDING" && <Button variant="ghost" size="sm" className="mt-2 text-red-600" onClick={() => onCancel(request)}>בטל בקשה</Button>}
  </div>)}</div>;
}