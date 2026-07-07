import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRoleContext } from "@/lib/RoleContext";
import { CalendarClock, Plus, StickyNote } from "lucide-react";
import { ROW_BY_TYPE, fmtShiftTime, fmtDM, dayNameOf } from "@/lib/workScheduleConfig";
import { Button } from "@/components/ui/button";
import WorkerShiftRequestModal from "@/components/work-schedule/WorkerShiftRequestModal";
import WorkerRequestsList from "@/components/work-schedule/WorkerRequestsList";

// Worker view — only PUBLISHED shifts assigned to the logged-in worker. Read-only.
export default function MyShifts() {
  const { internalUser } = useRoleContext();
  const email = (internalUser?.email || "").trim().toLowerCase();
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);

  const { data: profiles = [], isLoading: loadingProfile } = useQuery({
    queryKey: ["myWorkerProfile", email],
    queryFn: () => base44.entities.WorkerProfile.filter({ internal_user_email: email }),
    enabled: !!email,
  });
  const profile = profiles[0] || null;

  const { data: publishedSchedules = [] } = useQuery({
    queryKey: ["publishedWorkSchedules"],
    queryFn: () => base44.entities.WorkSchedule.filter({ status: "PUBLISHED" }, "-week_start_date", 100),
  });

  const { data: myShifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ["myWorkShifts", profile?.id],
    queryFn: () => base44.entities.WorkShift.filter({ worker_id: profile.id, status: "PLANNED" }, "date", 500),
    enabled: !!profile,
  });

  const publishedIds = new Set(publishedSchedules.map((s) => s.id));
  const today = new Date().toISOString().slice(0, 10);
  const shifts = myShifts
    .filter((s) => publishedIds.has(s.work_schedule_id) && s.date >= today)
    .filter((s) => s.row_type !== "HOUSEKEEPING_MORNING" && s.row_type !== "HOUSEKEEPING_EVENING")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""));

  const { data: myRequests = [] } = useQuery({
    queryKey: ["myWorkScheduleRequests", email],
    queryFn: () => base44.entities.WorkScheduleRequest.filter({ worker_email: email }, "-created_date", 100),
    enabled: !!email,
  });

  const refreshRequests = () => queryClient.invalidateQueries({ queryKey: ["myWorkScheduleRequests", email] });

  const handleCancelRequest = async (request) => {
    if (request.status !== "PENDING") return;
    await base44.entities.WorkScheduleRequest.update(request.id, { status: "CANCELLED", updated_by: email });
    refreshRequests();
  };

  const loading = loadingProfile || loadingShifts;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-slate-800">המשמרות שלי</h1>
        </div>
        {profile && (
          <Button type="button" size="sm" onClick={() => setRequestOpen(true)}>
            <Plus className="w-4 h-4" />
            בקשה חדשה
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 text-center py-10">טוען...</div>
      ) : !profile ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-6 text-center text-sm text-slate-500">
          החשבון שלך אינו מקושר לעובד בסידור העבודה.
          <br />
          <span className="text-xs text-slate-400">פנה למנהל כדי לקשר את החשבון.</span>
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-6 text-center text-sm text-slate-500">
          אין משמרות מתוכננות קרובות
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => {
            const row = ROW_BY_TYPE[s.row_type] || {};
            return (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                <div className="text-center shrink-0 w-16">
                  <div className="text-xs font-bold text-slate-700">{dayNameOf(s.date)}</div>
                  <div className="text-[11px] text-slate-400">{fmtDM(s.date)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`inline-block text-[11px] font-semibold rounded-full border px-2 py-0.5 ${row.chip || "bg-slate-100 border-slate-300 text-slate-600"}`}>
                    {s.row_label || row.label}
                  </span>
                  {s.notes && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <StickyNote className="w-3 h-3 shrink-0" />
                      <span className="truncate">{s.notes}</span>
                    </div>
                  )}
                </div>
                <div className="text-sm font-bold text-slate-700 font-mono shrink-0" dir="ltr">
                  {fmtShiftTime(s.start_time, s.end_time)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {profile && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">הבקשות שלי</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setRequestOpen(true)}>
              <Plus className="w-4 h-4" />
              בקשה חדשה
            </Button>
          </div>
          <WorkerRequestsList requests={myRequests} onCancel={handleCancelRequest} />
        </section>
      )}

      {requestOpen && profile && (
        <WorkerShiftRequestModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          profile={profile}
          email={email}
          shifts={shifts}
          onCreated={refreshRequests}
        />
      )}
    </div>
  );
}