const CONFIG = {
  DRAFT:    { label: "טיוטה",    className: "bg-slate-100 text-slate-600 border-slate-200" },
  SENT:     { label: "נשלח",     className: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "מאושר",    className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "נדחה",     className: "bg-red-50 text-red-600 border-red-200" },
  EXPIRED:  { label: "פג תוקף",  className: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function QuoteStatusBadge({ status }) {
  const c = CONFIG[status] || CONFIG.DRAFT;
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}