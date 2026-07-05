/**
 * IssueCard — mobile-optimised card with large status action buttons.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, CheckCircle2, Clock, Package, XCircle, ChevronDown, ChevronUp, MapPin, Calendar, MessageCircle } from "lucide-react";

const MAINTENANCE_CONTACTS = [
  { name: "פלאפון אירוח", phone: "972503256403" },
  { name: "עומרי", phone: "972526549582" },
];

export const STATUS_LABELS = {
  OPEN: "פתוח",
  IN_PROGRESS: "בטיפול",
  WAITING_PARTS: "ממתין לחלקים",
  DONE: "בוצע",
  CANCELLED: "בוטל",
};

export const STATUS_COLORS = {
  OPEN: "bg-red-100 text-red-700 border-red-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  WAITING_PARTS: "bg-amber-100 text-amber-700 border-amber-200",
  DONE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

export const PRIORITY_LABELS = {
  LOW: "נמוכה",
  MEDIUM: "בינונית",
  HIGH: "גבוהה",
  URGENT: "דחוף",
};

export const PRIORITY_COLORS = {
  LOW: "text-slate-500",
  MEDIUM: "text-blue-600",
  HIGH: "text-orange-600",
  URGENT: "text-red-600 font-bold",
};

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_PARTS"];

export default function IssueCard({ issue, canEdit, onUpdated, showLocation = false }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [note, setNote] = useState("");
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  const isClosed = !OPEN_STATUSES.includes(issue.status);
  const isUrgent = issue.priority === "URGENT";

  const photos = (() => {
    try { return JSON.parse(issue.photo_urls || "[]"); } catch { return []; }
  })();

  const updateStatus = async (newStatus) => {
    setUpdating(newStatus);
    const update = {
      status: newStatus,
      ...(note.trim() ? { internal_notes: [issue.internal_notes, note.trim()].filter(Boolean).join("\n---\n") } : {}),
    };
    if (newStatus === "DONE" || newStatus === "CANCELLED") {
      update.closed_date = new Date().toISOString();
    }
    await base44.entities.MaintenanceIssue.update(issue.id, update);
    setUpdating(null);
    setConfirmStatus(null);
    setNote("");
    onUpdated();
  };

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
  };

  const handleWhatsAppNotification = (phone) => {
    const url = `${window.location.origin}/maintenance`;
    const location = [issue.location_section, issue.location_name].filter(Boolean).join(" · ") || "לא צוין";
    const message = `🚨 תקלה חדשה במערכת התחזוקה
נושא: ${issue.title}
מיקום: ${location}
עדיפות: ${PRIORITY_LABELS[issue.priority] || issue.priority}
תיאור: ${issue.description || "ללא תיאור"}

לצפייה בפרטי התקלה: ${url}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
    setWhatsappOpen(false);
  };

  return (
    <div className={`rounded-xl overflow-hidden border ${
      isUrgent && !isClosed
        ? "border-red-400 border-r-4"
        : isClosed
          ? "border-slate-200 bg-slate-50 opacity-70"
          : "border-border bg-card"
    }`}>

      {/* Urgent banner */}
      {isUrgent && !isClosed && (
        <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> דחוף
        </div>
      )}

      {/* Main row — always visible */}
      <button
        className="w-full text-right flex items-start gap-3 p-4"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Photo thumbnail */}
        {photos.length > 0 && (
          <img src={photos[0]} alt="" className="w-12 h-12 object-cover rounded-lg border border-border shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-sm leading-snug">{issue.title}</p>

          {showLocation && (issue.location_name || issue.location_section) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {[issue.location_section, issue.location_name].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[issue.status]}`}>
              {STATUS_LABELS[issue.status]}
            </span>
            <span className={`text-xs font-semibold ${PRIORITY_COLORS[issue.priority]}`}>
              {PRIORITY_LABELS[issue.priority]}
            </span>
            {issue.category && (
              <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">
                {issue.category}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {formatDate(issue.created_date)}
          </p>
        </div>

        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {issue.description && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{issue.description}</p>
          )}

          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>דווח ע"י: {issue.reported_by_name}</p>
            {issue.closed_date && <p>נסגר: {formatDate(issue.closed_date)}</p>}
          </div>

          {issue.internal_notes && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 whitespace-pre-wrap border border-slate-100">
              <p className="font-semibold mb-1 text-slate-500">הערות פנימיות</p>
              {issue.internal_notes}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={() => setWhatsappOpen(o => !o)}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-green-50 text-green-700 border border-green-200 font-semibold text-sm active:bg-green-100 transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> שלח בווטסאפ
              {whatsappOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {whatsappOpen && (
              <div className="grid gap-2 bg-green-50/50 rounded-xl p-2 border border-green-100">
                {MAINTENANCE_CONTACTS.map(contact => (
                  <button
                    key={contact.phone}
                    onClick={() => handleWhatsAppNotification(contact.phone)}
                    className="w-full flex items-center justify-between min-h-[44px] rounded-lg bg-white text-green-700 border border-green-200 px-3 font-semibold text-sm active:bg-green-100 transition-colors"
                  >
                    <span>{contact.name}</span>
                    <MessageCircle className="w-4 h-4" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`תמונה ${i + 1}`} className="w-16 h-16 object-cover rounded-xl border border-border" />
                </a>
              ))}
            </div>
          )}

          {/* Status actions — large mobile buttons */}
          {canEdit && !isClosed && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-slate-500">עדכון סטטוס:</p>
              <div className="grid grid-cols-2 gap-2">
                {issue.status !== "IN_PROGRESS" && (
                  <button
                    onClick={() => setConfirmStatus("IN_PROGRESS")}
                    disabled={updating === "IN_PROGRESS"}
                    className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-sm active:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    <Clock className="w-4 h-4" /> בטיפול
                  </button>
                )}
                {issue.status !== "WAITING_PARTS" && (
                  <button
                    onClick={() => setConfirmStatus("WAITING_PARTS")}
                    disabled={updating === "WAITING_PARTS"}
                    className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-sm active:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    <Package className="w-4 h-4" /> ממתין לחלקים
                  </button>
                )}
                <button
                  onClick={() => setConfirmStatus("DONE")}
                  disabled={!!updating}
                  className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-sm active:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> בוצע
                </button>
                <button
                  onClick={() => setConfirmStatus("CANCELLED")}
                  disabled={!!updating}
                  className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-slate-50 text-slate-500 border border-slate-200 font-semibold text-sm active:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> בטל
                </button>
              </div>

              {confirmStatus && (
                <div className="space-y-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600">
                    אשר: <span className="text-primary">{STATUS_LABELS[confirmStatus]}</span>
                  </p>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="הערה (אופציונלי)..."
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(confirmStatus)}
                      disabled={!!updating}
                      className="flex-1 min-h-[44px] bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-50"
                    >
                      {updating ? "מעדכן..." : "אשר"}
                    </button>
                    <button
                      onClick={() => { setConfirmStatus(null); setNote(""); }}
                      className="flex-1 min-h-[44px] border border-slate-200 rounded-xl text-sm text-slate-600"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}