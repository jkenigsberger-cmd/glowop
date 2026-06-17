import { useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { he } from "date-fns/locale";
import { X } from "lucide-react";
import SearchBar from "@/components/search/SearchBar";
import DateRangeFilter from "@/components/search/DateRangeFilter";

const STATUS_LABELS = {
  DRAFT: "טיוטה",
  PENDING_APPROVAL: "בהמתנה",
  CONFIRMED: "מאושר",
  COMPLETED: "הושלם",
  CANCELLED: "בוטל",
  ARCHIVED: "ארכיון",
};

function generateMonthOptions() {
  const now = new Date();
  const options = [{ value: "ALL", label: "כל החודשים" }];
  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy", { locale: he });
    options.push({ value, label });
  }
  return options;
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-white border border-slate-300 rounded-full px-2.5 py-0.5 text-slate-600 font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-red-500"><X className="w-3 h-3" /></button>
    </span>
  );
}

/**
 * Shared filter bar for Groups and ApprovedGroups.
 *
 * Props:
 *   searchQuery / onSearchChange
 *   monthFilter / onMonthChange    — "ALL" | "yyyy-MM"
 *   typeFilter / onTypeChange      — "ALL" | "LODGING" | "DAY_USE"
 *   statusFilter / onStatusChange  — "ALL" | Group status
 *   dateStart / dateEnd / onDateStartChange / onDateEndChange
 *   onClearAll
 *   showStatus / showType (default true)
 */
export default function GroupFilters({
  searchQuery, onSearchChange,
  monthFilter, onMonthChange,
  typeFilter, onTypeChange,
  statusFilter, onStatusChange,
  dateStart, onDateStartChange,
  dateEnd, onDateEndChange,
  onClearAll,
  showStatus = true,
  showType = true,
}) {
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const hasFilters = searchQuery || monthFilter !== "ALL" || typeFilter !== "ALL" || statusFilter !== "ALL" || dateStart || dateEnd;

  return (
    <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
      <SearchBar
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="חפש קבוצה לפי שם, איש קשר, טלפון..."
      />

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={monthFilter}
          onChange={e => onMonthChange(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {monthOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {showType && (
          <select
            value={typeFilter}
            onChange={e => onTypeChange(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">כל הסוגים</option>
            <option value="LODGING">לינה</option>
            <option value="DAY_USE">באי יום</option>
          </select>
        )}

        {showStatus && (
          <select
            value={statusFilter}
            onChange={e => onStatusChange(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">כל הסטטוסים</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
      </div>

      <DateRangeFilter
        startDate={dateStart}
        endDate={dateEnd}
        onStartChange={onDateStartChange}
        onEndChange={onDateEndChange}
      />

      {hasFilters && (
        <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-slate-200">
          {searchQuery && <FilterChip label={`חיפוש: ${searchQuery}`} onRemove={() => onSearchChange("")} />}
          {monthFilter !== "ALL" && (
            <FilterChip
              label={monthOptions.find(o => o.value === monthFilter)?.label || monthFilter}
              onRemove={() => onMonthChange("ALL")}
            />
          )}
          {typeFilter !== "ALL" && (
            <FilterChip label={typeFilter === "LODGING" ? "לינה" : "באי יום"} onRemove={() => onTypeChange("ALL")} />
          )}
          {statusFilter !== "ALL" && (
            <FilterChip label={STATUS_LABELS[statusFilter] || statusFilter} onRemove={() => onStatusChange("ALL")} />
          )}
          {dateStart && <FilterChip label={`מ-${dateStart}`} onRemove={() => onDateStartChange(null)} />}
          {dateEnd && <FilterChip label={`עד-${dateEnd}`} onRemove={() => onDateEndChange(null)} />}
          <button onClick={onClearAll} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-0.5">
            נקה הכל
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Apply all filters to a list of groups.
 * Returns the filtered array.
 */
export function filterGroups(items, { searchQuery, monthFilter, typeFilter, statusFilter, dateStart, dateEnd }) {
  const q = (searchQuery || "").trim().toLowerCase();

  // Compute month range once
  let monthStart = null;
  let monthEnd = null;
  if (monthFilter && monthFilter !== "ALL") {
    const [y, m] = monthFilter.split("-").map(Number);
    monthStart = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    monthEnd = new Date(y, m, 0).toISOString().slice(0, 10);
  }

  return items.filter(g => {
    // Text search
    if (q && !([g.group_name, g.contact_name, g.contact_phone, g.contact_email, g.internal_notes]
      .some(f => f && (typeof f === "string" ? f : String(f)).toLowerCase().includes(q)))) return false;

    // Type
    if (typeFilter && typeFilter !== "ALL" && g.group_type !== typeFilter) return false;

    // Status
    if (statusFilter && statusFilter !== "ALL" && g.status !== statusFilter) return false;

    // Date range (overlap)
    const arrDate = g.arrival_date?.trim() || null;
    const depDate = g.departure_date?.trim() || null;
    const effectiveEnd = depDate || arrDate;

    if (dateStart && (!effectiveEnd || effectiveEnd < dateStart)) return false;
    if (dateEnd && (!arrDate || arrDate > dateEnd)) return false;

    // Month (overlap)
    if (monthStart && monthEnd) {
      if (!arrDate || arrDate > monthEnd) return false;
      if (!effectiveEnd || effectiveEnd < monthStart) return false;
    }

    return true;
  });
}