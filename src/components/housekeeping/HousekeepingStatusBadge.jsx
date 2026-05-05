const STATUS_CONFIG = {
  PENDING:     { label: "ממתין",    className: "bg-slate-100 text-slate-600 border-slate-300" },
  IN_PROGRESS: { label: "בניקיון", className: "bg-blue-100 text-blue-700 border-blue-300" },
  READY:       { label: "מוכן",    className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  ISSUE:       { label: "בעיה",    className: "bg-red-100 text-red-700 border-red-300" },
};

export default function HousekeepingStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}