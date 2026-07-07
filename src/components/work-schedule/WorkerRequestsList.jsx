import { Button } from "@/components/ui/button";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, REQUEST_TYPE_LABELS, SLOT_LABELS } from "@/lib/workScheduleRequestLabels";

export default function WorkerRequestsList({ requests, onCancel }) {
  if (requests.length === 0) return <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-5 text-center text-sm text-slate-500">עדיין אין בקשות</div>;
  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <div key={request.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-800">{REQUEST_TYPE_LABELS[request.request_type]}</div>
              <div className="text-xs text-slate-500 mt-1">{request.date || "ללא תאריך"}{request.preferred_slot && ` · ${SLOT_LABELS[request.preferred_slot]}`}</div>
            </div>
            <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${REQUEST_STATUS_STYLES[request.status]}`}>{REQUEST_STATUS_LABELS[request.status]}</span>
          </div>
          {request.current_shift_summary && <div className="text-xs text-slate-600 mt-2">משמרת: {request.current_shift_summary}</div>}
          {request.requested_change_text && <div className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{request.requested_change_text}</div>}
          {request.notes && <div className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{request.notes}</div>}
          {request.admin_response && <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-2">תגובת מנהל: {request.admin_response}</div>}
          {request.status === "PENDING" && <Button variant="ghost" size="sm" className="mt-2 text-xs text-red-600 hover:text-red-700" onClick={() => onCancel(request)}>בטל בקשה</Button>}
        </div>
      ))}
    </div>
  );
}