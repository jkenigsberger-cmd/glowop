/**
 * ReviewAlertCard
 * Renders a single OperationalReviewAlert with an acknowledge button.
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { acknowledgeAlert } from "@/lib/reviewAlerts";
import { useRoleContext } from "@/lib/RoleContext";
import { format } from "date-fns";
import { toast } from "sonner";

// Which roles can acknowledge which modules
const MODULE_ACK_ROLES = {
  KITCHEN:              ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "KITCHEN"],
  HOUSEKEEPING:         ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER", "HOUSEKEEPING_STAFF"],
  ALLOCATION:           ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER"],
  SLEEPING_REQUIREMENTS:["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  GROUP:                ["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  ACTIVITIES:           ["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  REPORTS:              ["SUPER_ADMIN", "ADMIN"],
};

function canAcknowledge(role, module) {
  if (!role) return false;
  const allowed = MODULE_ACK_ROLES[module] || ["SUPER_ADMIN", "ADMIN"];
  return allowed.includes(role);
}

const MODULE_LABELS = {
  KITCHEN:              "מטבח",
  HOUSEKEEPING:         "משק בית",
  ALLOCATION:           "שיבוץ לינה",
  SLEEPING_REQUIREMENTS:"דרישות לינה",
  GROUP:                "קבוצה",
  ACTIVITIES:           "פעילויות",
  REPORTS:              "דוחות",
};

const SEVERITY_STYLES = {
  CRITICAL: "bg-red-50 border-red-300",
  WARNING:  "bg-amber-50 border-amber-300",
  INFO:     "bg-blue-50 border-blue-200",
};

const SEVERITY_TEXT = {
  CRITICAL: "text-red-700",
  WARNING:  "text-amber-800",
  INFO:     "text-blue-700",
};

export default function ReviewAlertCard({ alert, onAcknowledged }) {
  const { role } = useRoleContext();
  const [acking, setAcking] = useState(false);

  const canAck = canAcknowledge(role, alert.module);
  const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.WARNING;
  const textColor = SEVERITY_TEXT[alert.severity] || SEVERITY_TEXT.WARNING;

  const handleAcknowledge = async () => {
    setAcking(true);
    try {
      const me = await base44.auth.me();
      await acknowledgeAlert(alert.id, me?.email || me?.full_name || role);
      toast.success("ההתראה סומנה כטופלה");
      onAcknowledged?.();
    } catch (err) {
      toast.error("שגיאה באישור ההתראה");
    } finally {
      setAcking(false);
    }
  };

  const createdAt = alert.created_date
    ? (() => { try { return format(new Date(alert.created_date), "dd/MM/yyyy HH:mm"); } catch { return ""; } })()
    : "";

  return (
    <div className={`rounded-xl border-2 px-4 py-3 space-y-2 ${styles}`} dir="rtl">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${textColor}`} />
          <div className="min-w-0">
            <p className={`text-sm font-bold leading-snug ${textColor}`}>{alert.title}</p>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              alert.severity === "CRITICAL" ? "bg-red-100 text-red-700" :
              alert.severity === "INFO"     ? "bg-blue-100 text-blue-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {MODULE_LABELS[alert.module] || alert.module} — דורש בדיקה
            </span>
          </div>
        </div>
        {canAck && (
          <Button
            size="sm"
            variant="outline"
            disabled={acking}
            onClick={handleAcknowledge}
            className={`shrink-0 text-xs gap-1 ${
              alert.severity === "CRITICAL"
                ? "border-red-300 text-red-700 hover:bg-red-50"
                : "border-amber-400 text-amber-700 hover:bg-amber-100"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {acking ? "מאשר..." : "ראיתי וטיפלתי"}
          </Button>
        )}
      </div>

      {/* Message */}
      <p className={`text-xs leading-relaxed ${textColor}`}>{alert.message}</p>

      {/* Footer */}
      {createdAt && (
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {createdAt}
        </p>
      )}
    </div>
  );
}