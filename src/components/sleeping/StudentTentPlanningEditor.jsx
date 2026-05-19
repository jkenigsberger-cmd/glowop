/**
 * Inline planning editor for student tent distribution rows.
 * Each row = { tent_count, people_per_tent, notes }
 * Used inside SleepingRequirementsTab (not the specific-tent dialog).
 */
import { Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMPTY_ROW = () => ({ tent_count: 1, people_per_tent: 8, notes: "" });

function rowTotal(row) {
  return (Number(row.tent_count) || 0) * (Number(row.people_per_tent) || 0);
}

export default function StudentTentPlanningEditor({
  title,
  required,
  rows,
  onChange,
  maxPerTent = 8,
  color = "bg-blue-50",
}) {
  const addRow    = () => onChange([...rows, EMPTY_ROW()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  const total = rows.reduce((s, r) => s + rowTotal(r), 0);
  const hasRequired = required != null && required > 0;
  const mismatch = hasRequired && total !== required;
  const overMax  = rows.some(r => Number(r.people_per_tent) > maxPerTent);

  return (
    <div className={`rounded-xl border p-3 space-y-2.5 ${color} border-blue-200`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <Button
          size="sm" variant="outline"
          onClick={addRow}
          className="h-7 text-xs gap-1 bg-white"
        >
          <Plus className="w-3 h-3" /> הוסף שורה
        </Button>
      </div>

      {/* Column headers */}
      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 text-[10px] font-semibold text-slate-400 uppercase px-1">
          <span>כמות אוהלים</span>
          <span>אנשים לאוהל</span>
          <span>הערות</span>
          <span className="w-6" />
        </div>
      )}

      {/* Rows */}
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3 border-2 border-dashed border-slate-200 rounded-lg bg-white/60">
          אין שורות חלוקה — לחץ "הוסף שורה"
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, i) => {
            const overPax = Number(row.people_per_tent) > maxPerTent;
            return (
              <div
                key={i}
                className={`grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center border rounded-lg px-3 py-2 bg-white ${
                  overPax ? "border-red-300 bg-red-50" : "border-slate-200"
                }`}
              >
                <Input
                  type="number" min="1"
                  value={row.tent_count ?? ""}
                  onChange={e => updateRow(i, "tent_count", e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-7 text-xs text-center"
                  placeholder="מספר אוהלים"
                />
                <Input
                  type="number" min="1" max={maxPerTent}
                  value={row.people_per_tent ?? ""}
                  onChange={e => updateRow(i, "people_per_tent", e.target.value === "" ? "" : Number(e.target.value))}
                  className={`h-7 text-xs text-center ${overPax ? "border-red-400 bg-red-50" : ""}`}
                  placeholder="אנשים"
                />
                <Input
                  value={row.notes ?? ""}
                  onChange={e => updateRow(i, "notes", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="הערות (אופציונלי)"
                />
                <button
                  onClick={() => removeRow(i)}
                  className="text-slate-300 hover:text-red-400 w-6 flex justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {rows.length > 0 && (
        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs border ${
          overMax
            ? "bg-red-50 border-red-300 text-red-700"
            : mismatch
            ? "bg-amber-50 border-amber-300 text-amber-700"
            : "bg-emerald-50 border-emerald-300 text-emerald-700"
        }`}>
          {overMax
            ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            : mismatch
            ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          }
          <span>
            סה"כ: <strong>{total}</strong> אנשים
            {hasRequired && ` (נדרש: ${required})`}
            {mismatch && !overMax && ` — פער של ${Math.abs(total - required)}`}
            {overMax && ` — יש שורה עם יותר מ-${maxPerTent} אנשים לאוהל`}
          </span>
        </div>
      )}
    </div>
  );
}