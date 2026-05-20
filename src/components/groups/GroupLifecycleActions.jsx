import { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { CheckCircle2, Snowflake, RotateCcw, Trash2, AlertTriangle } from "lucide-react";

// ── Confirmation Modal ─────────────────────────────────────────────────────────

function ConfirmModal({ config, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (config.requireReason && !reason.trim()) return;
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 shrink-0 ${config.iconBg}`}>
            <config.Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-800">{config.title}</h2>
            <p className="text-sm text-slate-600 mt-1">{config.text}</p>
          </div>
        </div>

        {config.requireReason && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">סיבת הקפאה</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={2}
              placeholder="הכנס סיבת הקפאה..."
            />
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>ביטול</Button>
          <Button
            size="sm"
            className={config.btnClass}
            onClick={handleConfirm}
            disabled={loading || (config.requireReason && !reason.trim())}
          >
            {loading ? "מעבד..." : config.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

const MODAL_CONFIGS = {
  complete: {
    title: "סיום קבוצה",
    text: "הקבוצה תועבר להיסטוריית קבוצות ולא תופיע יותר כקבוצה פעילה. כל השיבוצים, הארוחות והפעילויות ישוחררו.",
    confirmLabel: "סיים והעבר להיסטוריה",
    requireReason: false,
    Icon: CheckCircle2,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    btnClass: "bg-teal-600 hover:bg-teal-700 text-white",
  },
  freeze: {
    title: "הקפאת קבוצה",
    text: "הקפאת הקבוצה תשמור את פרטי הקבוצה והלקוח, אך תשחרר את כל השיבוצים, הארוחות והפעילויות כך שהקבוצה לא תחסום משאבים.",
    confirmLabel: "הקפא ושחרר משאבים",
    requireReason: true,
    Icon: Snowflake,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    btnClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  reactivate: {
    title: "הפעלה מחדש",
    text: "פרטי הקבוצה יישמרו, אך יש לתכנן מחדש פעילויות, ארוחות ושיבוצי לינה.",
    confirmLabel: "הפעל מחדש",
    requireReason: false,
    Icon: RotateCcw,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  delete: {
    title: "מחיקה מוחלטת",
    text: "פעולה זו תמחק את הקבוצה ואת כל הנתונים התפעוליים הקשורים אליה. פעולה זו אינה מיועדת לקבוצות שהסתיימו או קבוצות בהמתנה.",
    confirmLabel: "מחק לצמיתות",
    requireReason: false,
    Icon: AlertTriangle,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    btnClass: "bg-red-600 hover:bg-red-700 text-white",
  },
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function GroupLifecycleActions({ group, onDeleted, onUpdated }) {
  const [modal, setModal] = useState(null); // "complete" | "freeze" | "reactivate" | "delete"
  const [loading, setLoading] = useState(false);

  const status = group?.status;
  const isActive = status === "DRAFT" || status === "CONFIRMED";
  const isArchived = status === "ARCHIVED";
  const isCompleted = status === "COMPLETED";

  const handleLifecycle = async (action, reason) => {
    setLoading(true);
    const res = await base44.functions.invoke("updateGroupLifecycle", {
      group_id: group.id,
      action,
      reason,
    });
    setLoading(false);
    setModal(null);
    if (res.data?.success) {
      const s = res.data.summary;
      const summaryParts = [];
      if (s?.sleepingAllocations)    summaryParts.push(`${s.sleepingAllocations} לינות`);
      if (s?.mealReservations)       summaryParts.push(`${s.mealReservations} ארוחות`);
      if (s?.scheduleItems)          summaryParts.push(`${s.scheduleItems} פעילויות`);
      if (s?.neighborhoodReservations) summaryParts.push(`${s.neighborhoodReservations} שכונות`);
      const summaryStr = summaryParts.length ? ` · שוחרר: ${summaryParts.join(', ')}` : '';
      if (action === 'complete') toast.success(`הקבוצה הועברה להיסטוריה${summaryStr}`);
      if (action === 'freeze')    toast.success(`הקבוצה הוקפאה${summaryStr}`);
      if (action === 'reactivate') toast.success('הקבוצה הופעלה מחדש');
      onUpdated?.();
    } else {
      toast.error(res.data?.error || 'הפעולה נכשלה');
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      console.log("[Delete UI] calling deleteGroup", group.id);
      const res = await base44.functions.invoke("deleteGroup", { group_id: group.id });
      console.log("[Delete UI] response", res);
      if (res.data?.success) {
        setModal(null);
        toast.success('הקבוצה נמחקה לצמיתות');
        onDeleted?.();
      } else {
        console.error("[Delete UI] deleteGroup success false", res.data);
        toast.error(
          res.data?.error ||
          res.data?.debug?.message ||
          'מחיקת הקבוצה נכשלה'
        );
      }
    } catch (err) {
      const backend = err?.response?.data;
      console.error("[Delete UI] full error", err);
      console.error("[Delete UI] backend error", backend);
      toast.error(
        backend?.error ||
        backend?.debug?.message ||
        err?.message ||
        'מחיקת הקבוצה נכשלה'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = (reason) => {
    if (modal === 'delete') return handleDelete();
    return handleLifecycle(modal, reason);
  };

  if (!group) return null;

  return (
    <>
      <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">פעולות מחזור חיים</p>
        <div className="flex flex-wrap gap-2">
          {isActive && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
                onClick={() => setModal("complete")}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                סיים קבוצה
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => setModal("freeze")}
              >
                <Snowflake className="w-3.5 h-3.5" />
                הקפא קבוצה
              </Button>
            </>
          )}
          {(isArchived || isCompleted) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setModal("reactivate")}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              הפעל מחדש
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-200 text-red-500 hover:bg-red-50 mr-auto"
            onClick={() => setModal("delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
            מחיקה מוחלטת
          </Button>
        </div>
        {isArchived && group.archived_reason && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            ❄️ סיבת הקפאה: {group.archived_reason}
          </p>
        )}
        {isCompleted && group.completed_at && (
          <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded px-2 py-1">
            ✓ הקבוצה הסתיימה — הועברה להיסטוריה
          </p>
        )}
      </div>

      {modal && (
        <ConfirmModal
          config={MODAL_CONFIGS[modal]}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      )}
    </>
  );
}