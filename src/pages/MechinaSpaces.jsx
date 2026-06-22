import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRoleContext } from "@/lib/RoleContext";
import { Building2, Clock, CalendarDays, ListChecks } from "lucide-react";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];

export default function MechinaSpaces() {
  const { role, internalUser } = useRoleContext();
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [allRequests, setAllRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const isAdmin = ADMIN_ROLES.includes(role);
  const isMechinaUser = role === "MECHINA_USER";

  // Load assignments for Mechina user
  useEffect(() => {
    if (!isMechinaUser || !internalUser?.email) return;
    setLoadingAssignments(true);
    base44.entities.MechinaGroupAssignment.filter({ user_email: internalUser.email, is_active: true })
      .then(setAssignments)
      .finally(() => setLoadingAssignments(false));
  }, [isMechinaUser, internalUser?.email]);

  // Load all requests for admin view
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingRequests(true);
    base44.entities.CommonSpaceBookingRequest.filter({ status: "PENDING" })
      .then(setAllRequests)
      .finally(() => setLoadingRequests(false));
  }, [isAdmin]);

  // Access denied
  if (!isAdmin && !isMechinaUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-center space-y-2">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">אין הרשאה לצפות בדף זה</p>
        </div>
      </div>
    );
  }

  // ── MECHINA USER VIEW ──────────────────────────────────────────────────────
  if (isMechinaUser) {
    const assignedGroup = assignments[0]; // primary assignment
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" dir="rtl">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-heading font-semibold text-slate-800">בקשות מרחבים</h1>
          {loadingAssignments ? (
            <p className="text-sm text-slate-400">טוען...</p>
          ) : assignedGroup ? (
            <p className="text-sm text-slate-500">
              מכינה: <span className="font-semibold text-slate-700">{assignedGroup.group_name || assignedGroup.group_id}</span>
            </p>
          ) : (
            <p className="text-sm text-amber-600">לא נמצאה מכינה מקושרת לחשבון זה. פנה למנהל המערכת.</p>
          )}
        </div>

        {/* Calendar placeholder */}
        <section className="border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3 bg-slate-50">
          <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-slate-400 font-medium">לוח זמינות מרחבים יופיע כאן</p>
          <p className="text-xs text-slate-400">בשלב הבא תוכל לצפות בזמינות של כל מרחב ולשלוח בקשה</p>
        </section>

        {/* My requests placeholder */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-700">הבקשות שלי</h2>
          </div>
          <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center bg-white">
            <p className="text-sm text-slate-400">רשימת הבקשות תופיע כאן לאחר שתשלח בקשה ראשונה</p>
          </div>
        </section>
      </div>
    );
  }

  // ── ADMIN / OPERATIONS VIEW ────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-heading font-semibold text-slate-800">ניהול בקשות מרחבים</h1>
        <p className="text-sm text-slate-500">פורטל מכינות — ניהול בקשות הזמנת מרחבי פעילות</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 space-y-1">
          <p className="text-xs text-slate-500">ממתינות לאישור</p>
          <p className="text-2xl font-bold text-amber-600">
            {loadingRequests ? "—" : allRequests.filter(r => r.status === "PENDING").length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 space-y-1">
          <p className="text-xs text-slate-500">מאושרות</p>
          <p className="text-2xl font-bold text-emerald-600">—</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 space-y-1">
          <p className="text-xs text-slate-500">נדחו</p>
          <p className="text-2xl font-bold text-slate-400">—</p>
        </div>
      </div>

      {/* Pending requests placeholder */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="text-base font-semibold text-slate-700">בקשות ממתינות לאישור</h2>
        </div>

        {loadingRequests ? (
          <div className="text-center py-10 text-slate-400 text-sm">טוען בקשות...</div>
        ) : allRequests.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-white">
            <ListChecks className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">אין בקשות ממתינות כרגע</p>
            <p className="text-xs text-slate-400 mt-1">כאשר מכינה תשלח בקשה, היא תופיע כאן לאישורך</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allRequests.map(req => (
              <div key={req.id} className="bg-white border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-semibold text-slate-800">{req.activity_title}</p>
                  <p className="text-xs text-slate-500">
                    {req.space_name} · {req.date} · {req.start_time}–{req.end_time}
                  </p>
                  <p className="text-xs text-slate-400">{req.requested_by_name || req.requested_by_email}</p>
                </div>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  ממתין לאישור
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}