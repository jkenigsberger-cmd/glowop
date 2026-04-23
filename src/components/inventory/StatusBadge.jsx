import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  WORKING: { label: "תקין", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  BROKEN: { label: "תקול", className: "bg-red-100 text-red-800 border-red-200" },
  MAINTENANCE: { label: "תחזוקה", className: "bg-amber-100 text-amber-800 border-amber-200" },
  CLOSED: { label: "סגור", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

const BED_STATUS_CONFIG = {
  FREE: { label: "פנוי", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  RESERVED: { label: "שמור", className: "bg-blue-100 text-blue-800 border-blue-200" },
  OCCUPIED: { label: "תפוס", className: "bg-orange-100 text-orange-800 border-orange-200" },
  BLOCKED: { label: "חסום", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function WorkingStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.WORKING;
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export function BedStatusBadge({ status }) {
  const config = BED_STATUS_CONFIG[status] || BED_STATUS_CONFIG.FREE;
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}