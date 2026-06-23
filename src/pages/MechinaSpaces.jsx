import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRoleContext } from "@/lib/RoleContext";
import { Building2, ChevronRight, ChevronLeft, CalendarDays, Plus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import MechinaBookingRequestModal from "@/components/mechina/MechinaBookingRequestModal";
import MechinaSpaceAvailability from "@/components/mechina/MechinaSpaceAvailability";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];

const STATUS_LABELS = {
  PENDING:          { label: "ממתין לאישור", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED:         { label: "מאושר",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED:         { label: "נדחה",           cls: "bg-red-50 text-red-700 border-red-200" },
  CANCELLED:        { label: "בוטל",           cls: "bg-slate-50 text-slate-500 border-slate-200" },
  CHANGE_REQUESTED: { label: "נדרש שינוי",    cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

function StatusBadge({ status }) {
  const cfg = STATUS_LABELS[status] || { label: status, cls: "bg-slate-50 text-slate-500 border-slate-200" };
  return (
    <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${cfg.cls}`}>{cfg.label}</span>
  );
}

function DateNav({ selectedDate, onDateChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onDateChange(addDays(selectedDate, -1))}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-slate-400" />
        <input
          type="date"
          value={selectedDate}
          onChange={e => onDateChange(e.target.value)}
          className="text-sm font-medium text-slate-800 border-0 bg-transparent focus:outline-none cursor-pointer"
        />
        <span className="text-sm text-slate-500 hidden sm:inline">{formatDate(selectedDate)}</span>
      </div>
      <button
        onClick={() => onDateChange(addDays(selectedDate, 1))}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {selectedDate !== todayStr() && (
        <button
          onClick={() => onDateChange(todayStr())}
          className="text-xs text-primary border border-primary/30 rounded-full px-2.5 py-0.5 hover:bg-primary/5 transition-colors"
        >
          היום
        </button>
      )}
    </div>
  );
}

export default function MechinaSpaces() {
  const { role, internalUser } = useRoleContext();
  const isAdmin = ADMIN_ROLES.includes(role);
  const isMechinaUser = role === "MECHINA_USER";

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [spaces, setSpaces] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [preselectedSpaceId, setPreselectedSpaceId] = useState("");

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");

  // Derived: selected assignment (for MECHINA_USER)
  const activeAssignments = assignments.filter(a => a.is_active);
  const assignment = activeAssignments.find(a => a.id === selectedAssignmentId) || activeAssignments[0];
  const mechinaGroupId = assignment?.group_id || "";

  // Auto-select first assignment when assignments load
  useEffect(() => {
    if (activeAssignments.length > 0 && !selectedAssignmentId) {
      setSelectedAssignmentId(activeAssignments[0].id);
    }
  }, [assignments]);

  // ── Load spaces once ─────────────────────────────────────────────────────
  useEffect(() => {
    base44.entities.ActivitySpace.list().then(setSpaces);
  }, []);

  // ── Load assignments for mechina user ───────────────────────────────────
  useEffect(() => {
    if (!isMechinaUser || !internalUser?.email) return;
    base44.entities.MechinaGroupAssignment.filter({ user_email: internalUser.email, is_active: true })
      .then(setAssignments);
  }, [isMechinaUser, internalUser?.email]);

  // ── Load daily data whenever selected date changes ───────────────────────
  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);

    const fetchBookings = base44.entities.GroupScheduleItem.filter({
      date: selectedDate,
      status: "ACTIVE",
    });
    const fetchPending = base44.entities.CommonSpaceBookingRequest.filter({
      date: selectedDate,
      status: "PENDING",
    });

    Promise.all([fetchBookings, fetchPending]).then(([bookings, requests]) => {
      // Only keep bookings that have an assigned activity_space_id
      setActiveBookings(bookings.filter(b => b.activity_space_id));
      setPendingRequests(requests);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedDate]);

  // ── Load my requests (mechina user) — re-fetch when selected group changes ─
  useEffect(() => {
    if (!isMechinaUser || !mechinaGroupId) return;
    base44.entities.CommonSpaceBookingRequest.filter({ mechina_group_id: mechinaGroupId })
      .then(reqs => setMyRequests(reqs.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""))));
  }, [isMechinaUser, mechinaGroupId]);

  // ── Load all pending for admin ───────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    base44.entities.CommonSpaceBookingRequest.filter({ status: "PENDING" })
      .then(reqs => setMyRequests(reqs.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""))));
  }, [isAdmin]);

  const handleRequestNew = (spaceId = "") => {
    setPreselectedSpaceId(spaceId);
    setModalOpen(true);
  };

  const handleSubmitted = () => {
    // Re-fetch daily pending and the requests list
    const sortDesc = reqs => reqs.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""));
    Promise.all([
      base44.entities.GroupScheduleItem.filter({ date: selectedDate, status: "ACTIVE" }),
      base44.entities.CommonSpaceBookingRequest.filter({ date: selectedDate, status: "PENDING" }),
      isMechinaUser && mechinaGroupId
        ? base44.entities.CommonSpaceBookingRequest.filter({ mechina_group_id: mechinaGroupId })
        : isAdmin
          ? base44.entities.CommonSpaceBookingRequest.filter({ status: "PENDING" })
          : Promise.resolve([]),
    ]).then(([bookings, pending, requests]) => {
      setActiveBookings(bookings.filter(b => b.activity_space_id));
      setPendingRequests(pending);
      setMyRequests(sortDesc(requests));
    });
  };

  // ── Access denied ────────────────────────────────────────────────────────
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

  const SPACE_SORT_ORDER = [
    "bunker_1", "bunker_2", "bunker_3", "bunker_4",
    "bunker_6", "bunker_7", "bunker_8",
    "ohel_moed", "outdoor_deck_lawn", "dining_hall",
    "boulder_1", "boulder_2", "boulder_3", "boulder_4",
    "boulder_5", "boulder_6", "boulder_7", "boulder_8",
  ];

  const bookableSpaces = spaces
    .filter(s => s.is_bookable !== false && s.code !== "bunker_5")
    .sort((a, b) => {
      const ai = SPACE_SORT_ORDER.indexOf(a.code);
      const bi = SPACE_SORT_ORDER.indexOf(b.code);
      const aw = ai === -1 ? 999 : ai;
      const bw = bi === -1 ? 999 : bi;
      return aw - bw;
    });

  // ── MECHINA USER VIEW ────────────────────────────────────────────────────
  if (isMechinaUser) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-heading font-semibold text-slate-800">בקשות מרחבים</h1>
            {activeAssignments.length === 0 && (
              <p className="text-sm text-amber-600">לא נמצאה מכינה מקושרת לחשבון זה. פנה למנהל המערכת.</p>
            )}
            {activeAssignments.length === 1 && (
              <p className="text-sm text-slate-500">
                מכינה: <span className="font-semibold text-slate-700">{assignment.group_name || mechinaGroupId}</span>
              </p>
            )}
            {activeAssignments.length > 1 && (
              <div className="flex items-center gap-2 mt-1">
                <label className="text-sm text-slate-500">בחר מכינה:</label>
                <select
                  value={selectedAssignmentId}
                  onChange={e => setSelectedAssignmentId(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {activeAssignments.map(a => (
                    <option key={a.id} value={a.id}>{a.group_name || a.group_id}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {mechinaGroupId && (
            <Button onClick={() => handleRequestNew()} className="gap-1.5">
              <Plus className="w-4 h-4" />
              בקשה חדשה
            </Button>
          )}
        </div>

        {/* Date navigator */}
        <DateNav selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {/* Availability grid */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-700">זמינות מרחבים — {formatDate(selectedDate)}</h2>
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">טוען...</div>
          ) : bookableSpaces.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
              לא נמצאו מרחבים פעילים
            </div>
          ) : (
            <MechinaSpaceAvailability
              spaces={bookableSpaces}
              activeBookings={activeBookings}
              pendingRequests={pendingRequests}
              isAdmin={false}
              allowCreateRequest={true}
              onRequestNew={handleRequestNew}
            />
          )}
        </section>

        {/* My requests list */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-700">הבקשות שלי</h2>
          </div>
          {myRequests.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center bg-white">
              <p className="text-sm text-slate-400">לא שלחת בקשות עדיין</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myRequests.map(req => (
                <div key={req.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{req.activity_title}</p>
                    <p className="text-xs text-slate-500">{req.space_name} · {req.date} · {req.start_time}–{req.end_time}</p>
                    {(req.status === "REJECTED" || req.status === "CHANGE_REQUESTED") && req.admin_notes && (
                      <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded px-2 py-1">{req.admin_notes}</p>
                    )}
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Modal */}
        {modalOpen && mechinaGroupId && (
          <MechinaBookingRequestModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSubmitted={handleSubmitted}
            spaces={bookableSpaces}
            defaultDate={selectedDate}
            defaultSpaceId={preselectedSpaceId}
            mechinaGroupId={mechinaGroupId}
          />
        )}
      </div>
    );
  }

  // ── ADMIN / OPERATIONS VIEW ──────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      {/* Header */}
      <div className="space-y-0.5">
        <h1 className="text-2xl font-heading font-semibold text-slate-800">ניהול בקשות מרחבים</h1>
        <p className="text-sm text-slate-500">פורטל מכינות — ניהול בקשות הזמנת מרחבי פעילות</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 space-y-1">
          <p className="text-xs text-slate-500">ממתינות לאישור</p>
          <p className="text-2xl font-bold text-amber-600">{myRequests.filter(r => r.status === "PENDING").length}</p>
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

      {/* Date navigator + availability */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-base font-semibold text-slate-700">זמינות מרחבים</h2>
          <DateNav selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </div>
        {loading ? (
          <div className="text-center py-10 text-slate-400 text-sm">טוען...</div>
        ) : bookableSpaces.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
            לא נמצאו מרחבים פעילים
          </div>
        ) : (
          <MechinaSpaceAvailability
            spaces={bookableSpaces}
            activeBookings={activeBookings}
            pendingRequests={pendingRequests}
            isAdmin={true}
            allowCreateRequest={false}
            onRequestNew={handleRequestNew}
          />
        )}
      </section>

      {/* Pending requests list */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-700">בקשות ממתינות לאישור</h2>
        {myRequests.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-white">
            <ListChecks className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">אין בקשות ממתינות כרגע</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myRequests.map(req => (
              <div key={req.id} className="bg-white border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{req.activity_title}</p>
                  <p className="text-xs text-slate-500">
                    {req.space_name} · {req.date} · {req.start_time}–{req.end_time}
                  </p>
                  <p className="text-xs text-slate-400">{req.requested_by_name || req.requested_by_email}</p>
                </div>
                <StatusBadge status={req.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal for admin too */}
      {modalOpen && (
        <MechinaBookingRequestModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmitted={handleSubmitted}
          spaces={bookableSpaces}
          defaultDate={selectedDate}
          defaultSpaceId={preselectedSpaceId}
          mechinaGroupId=""
        />
      )}
    </div>
  );
}