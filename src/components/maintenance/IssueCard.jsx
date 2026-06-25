/**
 * IssueCard — displays a single MaintenanceIssue with status-change actions.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { User, Calendar, Tag, AlertTriangle, CheckCircle2, Clock, Package, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function IssueCard({ issue, canEdit, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState("");
  const [showNoteFor, setShowNoteFor] = useState(null);

  const isClosed = !OPEN_STATUSES.includes(issue.status);

  const photos = (() => {
    try { return JSON.parse(issue.photo_urls || "[]"); } catch { return []; }
  })();

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    const update = {
      status: newStatus,
      ...(note.trim() ? { internal_notes: [issue.internal_notes, note.trim()].filter(Boolean).join("\n---\n") } : {}),
    };
    if (newStatus === "DONE" || newStatus === "CANCELLED") {
      update.closed_date = new Date().toISOString();
    }
    await base44.entities.MaintenanceIssue.update(issue.id, update);
    setUpdating(false);
    setShowNoteFor(null);
    setNote("");
    onUpdated();
  };

  const handleStatusClick = (status) => {
    if (showNoteFor === status) {
      setShowNoteFor(null);
    } else {
      setShowNoteFor(status);
      setNote("");
    }
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${isClosed ? "opacity-70 bg-slate-50" : "bg-card"} border-border`}>
      {/* Header */}
      <button
        className="w-full text-right flex items-start gap-3 p-4"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[issue.status]}`}>
              {STATUS_LABELS[issue.status]}
            </span>
            <span className={`text-xs font-semibold ${PRIORITY_COLORS[issue.priority]}`}>
              {issue.priority === "URGENT" && <AlertTriangle className="w-3 h-3 inline ml-0.5" />}
              {PRIORITY_LABELS[issue.priority]}
            </span>
            {issue.category && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3" />{issue.category}
              </span>
            )}
          </div>
          <p className="font-semibold text-sm leading-snug">{issue.title}</p>
          {issue.description && !expanded && (
            <p className="text-xs text-muted-foreground truncate">{issue.description}</p>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {issue.description && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{issue.description}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> דווח ע"י: {issue.reported_by_name}
            </span>
            {issue.assigned_to_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> מוקצה ל: {issue.assigned_to_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {new Date(issue.created_date).toLocaleDateString("he-IL")}
            </span>
            {issue.closed_date && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> נסגר: {new Date(issue.closed_date).toLocaleDateString("he-IL")}
              </span>
            )}
          </div>

          {issue.internal_notes && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 whitespace-pre-wrap border border-slate-100">
              <p className="font-semibold mb-1 text-slate-500">הערות פנימיות</p>
              {issue.internal_notes}
            </div>
          )}

          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`תמונה ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-border" />
                </a>
              ))}
            </div>
          )}

          {/* Status actions — only for open issues and authorized users */}
          {canEdit && !isClosed && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-slate-500">עדכון סטטוס:</p>
              <div className="flex flex-wrap gap-2">
                {issue.status !== "IN_PROGRESS" && (
                  <button onClick={() => handleStatusClick("IN_PROGRESS")} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1">
                    <Clock className="w-3 h-3" /> בטיפול
                  </button>
                )}
                {issue.status !== "WAITING_PARTS" && (
                  <button onClick={() => handleStatusClick("WAITING_PARTS")} className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1">
                    <Package className="w-3 h-3" /> ממתין לחלקים
                  </button>
                )}
                <button onClick={() => handleStatusClick("DONE")} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> סמן כבוצע
                </button>
                <button onClick={() => handleStatusClick("CANCELLED")} className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> בטל
                </button>
              </div>

              {showNoteFor && (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="הערה (אופציונלי)..."
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={updating} onClick={() => updateStatus(showNoteFor)}>
                      {updating ? "מעדכן..." : `אשר: ${STATUS_LABELS[showNoteFor]}`}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowNoteFor(null)}>ביטול</Button>
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