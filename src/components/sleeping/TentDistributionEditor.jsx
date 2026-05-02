import { AlertTriangle, CheckCircle2, Plus, Trash2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Balanced suggestion algorithm.
 *
 * Step 1: minimum tents = ceil(total / capacity)
 * Step 2: fill as many full tents as possible
 * Step 3: if remainder is "tiny" (< half capacity), rebalance the last few tents
 *         by spreading their people more evenly, so no tent has a very small count.
 *
 * Examples (capacity 8):
 *   90 → 10×8, 2×5          (remainder 2 → rebalance last 3 tents: 2+8+8=18 → 3 tents of 6? No: 18/3=6 → 3×6. But 10-3=7 full + 3×6 = 56+18=74≠90. Let's redo: 11 tents min. 11×8=88. rem=2 → tiny. Rebalance 2 tents at end: (8+2)=10 across 2 → 5+5 → 9×8 + 2×5 = 72+10=82≠90. Correct: 10×8+2×5=90 ✓)
 *   33 → 3×8, 1×5, 1×4      (4 tents min. rem=1 → tiny. Rebalance last 2: 8+1=9 across 2 → 5+4)
 *   25 → 2×8, 1×5, 1×4      (4 tents min. 3×8=24 rem=1 → tiny. Rebalance last 2: 8+1=9 → 5+4)
 *
 * Examples (capacity 3):
 *   4  → 2×2                 (ceil(4/3)=2, rem=1 → tiny. Rebalance 2 tents: 4/2=2 → 2×2)
 *   5  → 1×3, 1×2            (rem=2, not tiny → keep as is)
 */
export function buildSuggestion(total, capacityPerTent) {
  if (!total || total <= 0) return [];

  const numTents = Math.ceil(total / capacityPerTent);
  const fullTents = Math.floor(total / capacityPerTent);
  const remainder = total % capacityPerTent;

  // "Tiny" threshold: remainder < half capacity (but not zero)
  const tinyThreshold = Math.floor(capacityPerTent / 2);
  const isTiny = remainder > 0 && remainder <= tinyThreshold;

  if (!isTiny) {
    // Simple case: all full tents + one remainder tent
    const rows = [];
    if (fullTents > 0) rows.push({ tent_count: fullTents, people_per_tent: capacityPerTent });
    if (remainder > 0) rows.push({ tent_count: 1, people_per_tent: remainder });
    return rows;
  }

  // Rebalance: spread the last (remainder + capacityPerTent) people across 2 tents evenly
  // i.e. take one full tent back and rebalance (capacityPerTent + remainder) across 2 tents
  const rebalancePeople = capacityPerTent + remainder; // e.g. 8+1=9, 8+2=10, 3+1=4
  const high = Math.ceil(rebalancePeople / 2);
  const low  = Math.floor(rebalancePeople / 2);

  // Remaining full tents (excluding the 2 rebalanced)
  const remainingFullTents = fullTents - 1; // we "borrowed" one full tent

  const rows = [];
  if (remainingFullTents > 0) rows.push({ tent_count: remainingFullTents, people_per_tent: capacityPerTent });
  if (high === low) {
    rows.push({ tent_count: 2, people_per_tent: high });
  } else {
    rows.push({ tent_count: 1, people_per_tent: high });
    rows.push({ tent_count: 1, people_per_tent: low });
  }
  return rows;
}

function CountdownBadge({ required, rows, maxPerTent }) {
  const distributed = rows.reduce((s, r) => s + (r.tent_count || 0) * (r.people_per_tent || 0), 0);
  const totalTents   = rows.reduce((s, r) => s + (r.tent_count || 0), 0);
  const remaining    = (required ?? 0) - distributed;
  const overCapacity = rows.some(r => r.people_per_tent > maxPerTent);

  let statusColor, statusText, statusIcon;
  if (required == null) {
    statusColor = "bg-slate-100 border-slate-200 text-slate-500";
    statusText  = `חולק: ${distributed} · ${totalTents} אוהלים`;
    statusIcon  = null;
  } else if (remaining === 0) {
    statusColor = "bg-emerald-50 border-emerald-300 text-emerald-700";
    statusText  = `✓ מאוזן · ${distributed} אנשים · ${totalTents} אוהלים`;
    statusIcon  = <CheckCircle2 className="w-3.5 h-3.5" />;
  } else if (remaining > 0) {
    statusColor = "bg-amber-50 border-amber-300 text-amber-700";
    statusText  = `⚠️ חסרים ${remaining} אנשים בחלוקה (${distributed}/${required})`;
    statusIcon  = <AlertTriangle className="w-3.5 h-3.5" />;
  } else {
    statusColor = "bg-red-50 border-red-300 text-red-700";
    statusText  = `⚠️ חולקו ${-remaining} יותר מדי (${distributed}/${required})`;
    statusIcon  = <AlertTriangle className="w-3.5 h-3.5" />;
  }

  return (
    <div className="space-y-1">
      <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-1.5 ${statusColor}`}>
        {statusIcon}{statusText}
      </div>
      {overCapacity && (
        <p className="text-[11px] text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> יש שורה עם יותר מ-{maxPerTent} אנשים לאוהל — חריגה מהמותר
        </p>
      )}
    </div>
  );
}

export default function TentDistributionEditor({
  title,
  required,
  rows,
  onChange,
  maxPerTent,
  capacityPerTent,
  color = "bg-white",
  hint,
}) {
  const add    = () => onChange([...rows, { tent_count: 1, people_per_tent: capacityPerTent }]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val === "" ? 0 : Number(val) };
    onChange(next);
  };

  const suggestion = buildSuggestion(required, capacityPerTent);

  const handleUseSuggestion = () => {
    if (rows.length > 0 && !window.confirm("האם למחוק את החלוקה הנוכחית ולהשתמש בהמלצה?")) return;
    onChange(suggestion);
  };

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${color}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        <div className="flex items-center gap-2">
          {suggestion.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleUseSuggestion} className="text-xs gap-1 h-7 border-blue-300 text-blue-600 hover:bg-blue-50">
              <Lightbulb className="w-3 h-3" /> השתמש בהמלצה
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={add} className="text-xs gap-1 h-7">
            <Plus className="w-3 h-3" /> הוסף שורה
          </Button>
        </div>
      </div>

      {/* Smart suggestion display */}
      {suggestion.length > 0 && (
        <div className="text-[11px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 space-y-0.5">
          <p className="font-semibold">💡 המלצה ({required} אנשים, {capacityPerTent} לאוהל):</p>
          {suggestion.map((s, i) => (
            <p key={i}>{s.tent_count} × {s.people_per_tent} = {s.tent_count * s.people_per_tent}</p>
          ))}
          <p className="text-[10px] text-blue-400 mt-0.5">המלצה מאוזנת בלבד — משק הבית יקבע את האוהלים בפועל</p>
        </div>
      )}

      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}

      {/* Distribution rows */}
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">אין שורות חלוקה — לחץ "הוסף שורה" או "השתמש בהמלצה"</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-1 text-[11px] text-slate-400 px-1">
            <span className="col-span-4">כמות אוהלים</span>
            <span className="col-span-4">אנשים לאוהל</span>
            <span className="col-span-3">סה"כ</span>
          </div>
          {rows.map((row, i) => {
            const total = (row.tent_count || 0) * (row.people_per_tent || 0);
            const overMax = row.people_per_tent > maxPerTent;
            return (
              <div key={i} className="grid grid-cols-12 gap-1 items-center">
                <Input
                  type="number" min="1"
                  value={row.tent_count || ""}
                  onChange={e => update(i, "tent_count", e.target.value)}
                  className="col-span-4 h-7 text-xs text-center"
                />
                <Input
                  type="number" min="1"
                  value={row.people_per_tent || ""}
                  onChange={e => update(i, "people_per_tent", e.target.value)}
                  className={`col-span-4 h-7 text-xs text-center ${overMax ? "border-red-400 bg-red-50" : ""}`}
                />
                <span className={`col-span-3 text-xs font-medium text-center ${overMax ? "text-red-600" : "text-slate-600"}`}>
                  = {total}
                  {overMax && <span className="text-red-500 mr-0.5">⚠</span>}
                </span>
                <button onClick={() => remove(i)} className="col-span-1 text-slate-300 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Countdown */}
      <CountdownBadge required={required} rows={rows} maxPerTent={maxPerTent} />
    </div>
  );
}