/**
 * GroupedAlertCard
 * Used in GroupDetail to show multiple alerts (same source, different modules)
 * as one combined card with per-module acknowledgement chips.
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { acknowledgeAlert } from "@/lib/reviewAlerts";
import { useRoleContext } from "@/lib/RoleContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { MODULE_LABELS } from "./ReviewAlertCard";

const MODULE_ACK_ROLES = {
  KITCHEN:               ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "KITCHEN"],
  HOUSEKEEPING:          ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER", "HOUSEKEEPING_STAFF"],
  ALLOCATION:            ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER"],
  SLEEPING_REQUIREMENTS: ["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  GROUP:                 ["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  ACTIVITIES:            ["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  REPORTS:               ["SUPER_ADMIN", "ADMIN"],
};

function canAck(role, module) {
  return (MODULE_ACK_ROLES[module] || ["SUPER_ADMIN", "ADMIN"]).includes(role || "");
}

const AFFECTED_AREAS = {
  SLEEPING_REQUIREMENTS: "דרישות לינה",
  ALLOCATION:            "שיבוץ לינה",
  KITCHEN:               "מטבח",
  HOUSEKEEPING:          "משק בית",
};

function parsePaxChange(alert) {
  try {
    const prev = alert.previous_value_json ? JSON.parse(alert.previous_value_json) : null;
    const next  = alert.new_value_json      ? JSON.parse(alert.new_value_json)      : null;
    if (!prev || !next) return null;
    const oldPax = Number(prev.total_pax ?? prev.pax ?? 0);
    const newPax = Number(next.total_pax ?? next.pax ?? 0);
    if (!oldPax && !newPax) return null;
    return { oldPax, newPax, diff: newPax - oldPax };
  } catch { return null; }
}

export default function GroupedAlertCard({ alerts, groupName, onAcknowledged }) {
  const { role } = useRoleContext();
  const [ackingId, setAckingId] = useState(null);

  if (!alerts || alerts.length === 0) return null;

  // Use the first alert for title/message/values (all share same source)
  const primary = alerts[0];
  const paxChange = parsePaxChange(primary);

  const createdAt = primary.created_date
    ? (() => { try { return format(new Date(primary.created_date), "dd/MM/yyyy HH:mm"); } catch { return ""; } })()
    : "";

  const handleAck = async (alert) => {
    setAckingId(alert.id);
    try {
      const me = await base44.auth.me();
      await acknowledgeAlert(alert.id, me?.email || me?.full_name || role);
      toast.success(`${MODULE_LABELS[alert.module] || alert.module} — סומן כטופל`);
      onAcknowledged?.();
    } catch {
      toast.error("שגיאה באישור ההתראה");
    } finally {
      setAckingId(null);
    }
  };

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 space-y-2" dir="rtl">
      {/* Header */}
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-800" />
        <p className="text-sm font-bold text-amber-800">{primary.title}</p>
      </div>

      {/* Group name */}
      {groupName && (
        <p className="text-xs font-semibold text-amber-700">קבוצה: {groupName}</p>
      )}

      {/* Message / pax change */}
      {paxChange ? (
        <div className="text-xs text-amber-800 space-y-0.5">
          <p>מספר האנשים בקבוצה השתנה מ-{paxChange.oldPax} ל-{paxChange.newPax}.</p>
          {paxChange.diff !== 0 && (
            <p className="font-semibold">
              {paxChange.diff > 0 ? `נוספו ${paxChange.diff} אנשים.` : `ירדו ${Math.abs(paxChange.diff)} אנשים.`}
            </p>
          )}
          <p className="text-amber-700">
            אזורים מושפעים: {alerts.map(a => AFFECTED_AREAS[a.module] || MODULE_LABELS[a.module] || a.module).join(", ")}
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-800 leading-relaxed">{primary.message}</p>
      )}

      {/* Per-module status chips with individual acknowledge */}
      <div className="flex flex-wrap gap-2 pt-1">
        {alerts.map(alert => {
          const userCanAck = canAck(role, alert.module);
          const isAcking   = ackingId === alert.id;
          return (
            <div key={alert.id} className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-semibold text-amber-800">
                {MODULE_LABELS[alert.module] || alert.module}
              </span>
              <span className="text-[10px] text-amber-500">— פתוח</span>
              {userCanAck && (
                <button
                  disabled={isAcking || ackingId !== null}
                  onClick={() => handleAck(alert)}
                  className="text-[10px] text-amber-700 hover:text-emerald-700 flex items-center gap-0.5 disabled:opacity-50"
                  title="סמן כטופל"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {isAcking ? "..." : "טופל"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {createdAt && (
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {createdAt}
        </p>
      )}
    </div>
  );
}