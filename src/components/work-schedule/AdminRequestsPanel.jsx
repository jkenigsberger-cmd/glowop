import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, REQUEST_TYPE_LABELS, SLOT_LABELS } from "@/lib/workScheduleRequestLabels";

const FILTERS = [
  { id: "PENDING", label: "ממתין" },
  { id: "APPROVED", label: "אושר" },
  { id: "REJECTED", label: "נדחה" },
  { id: "APPLIED", label: "בוצע" },
  { id: "ALL", label: "הכל" },
];

export default function AdminRequestsPanel({ userEmail }) {
  const [filter, setFilter] = useState("PENDING");
  const [responses, setResponses] = useState({});
  const queryClient = useQueryClient();
  const { data: requests = [] } = useQuery({ queryKey: ["workScheduleRequests"], queryFn: () => base44.entities.WorkScheduleRequest.list("-created_date", 500) });
  const visible = requests.filter((request) => filter === "ALL" || request.status === filter);

  const updateRequest = async (request, status) => {
    await base44.entities.WorkScheduleRequest.update(request.id, {
      status,
      admin_response: responses[request.id] ?? request.admin_response,
      reviewed_by: userEmail,
      reviewed_at: new Date().toISOString(),
      updated_by: userEmail,
    });
    queryClient.invalidateQueries({ queryKey: ["workScheduleRequests"] });
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-bold text-slate-800">בקשות עובדים</h2>
        <div className="flex gap-2 flex-wrap">{FILTERS.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`px-3 py-1 rounded-full text-xs border ${filter === item.id ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200"}`}>{item.label}</button>)}</div>
      </div>
      <div className="space-y-3">
        {visible.length === 0 ? <div className="text-sm text-slate-400 text-center py-6">אין בקשות להצגה</div> : visible.map((request) => (
          <div key={request.id} className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800">{request.worker_name || request.worker_email || "עובד"}</div>
                <div className="text-sm text-slate-600 mt-1">{REQUEST_TYPE_LABELS[request.request_type]}{request.date && ` · ${request.date}`}{request.preferred_slot && ` · ${SLOT_LABELS[request.preferred_slot]}`}</div>
              </div>
              <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${REQUEST_STATUS_STYLES[request.status]}`}>{REQUEST_STATUS_LABELS[request.status]}</span>
            </div>
            {request.current_shift_summary && <div className="text-sm text-slate-600 mt-2">משמרת קשורה: {request.current_shift_summary}</div>}
            {request.requested_change_text && <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{request.requested_change_text}</div>}
            {request.notes && <div className="text-sm text-slate-500 mt-2 whitespace-pre-wrap">{request.notes}</div>}
            <Textarea value={responses[request.id] ?? request.admin_response ?? ""} onChange={(e) => setResponses({ ...responses, [request.id]: e.target.value })} placeholder="תגובת מנהל" rows={2} className="mt-3" />
            <div className="flex gap-2 flex-wrap mt-3"><Button size="sm" variant="outline" onClick={() => updateRequest(request, "APPROVED")}>אשר</Button><Button size="sm" variant="outline" onClick={() => updateRequest(request, "REJECTED")}>דחה</Button><Button size="sm" onClick={() => updateRequest(request, "APPLIED")}>סמן כבוצע בסידור</Button></div>
          </div>
        ))}
      </div>
    </section>
  );
}