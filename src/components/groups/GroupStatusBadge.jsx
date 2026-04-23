const CONFIG = {
  DRAFT:     { label: "טיוטה",   className: "bg-slate-100 text-slate-600 border-slate-200" },
  CONFIRMED: { label: "מאושר",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "מבוטל",   className: "bg-red-50 text-red-600 border-red-200" },
};

export default function GroupStatusBadge({ status }) {
  const c = CONFIG[status] || CONFIG.DRAFT;
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}