import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

const fmtMoney = (n) => `₪${Math.round(Number(n) || 0).toLocaleString("he-IL")}`;

// Line total is always unit_price × quantity
export const calcAdjustmentLine = (r) => (Number(r.unit_price) || 0) * (Number(r.quantity) || 0);

/**
 * Normalize any legacy row into the unified shape:
 *   { description, unit_price, quantity }
 * Legacy rows only had { description, amount } (amount = flat line total).
 * We keep the total identical by putting amount into unit_price and quantity=1.
 */
export function normalizeAdjustmentRow(r, defaultQty = 1) {
  if (r == null) return { description: "", unit_price: 0, quantity: defaultQty };
  const hasNewShape = r.unit_price !== undefined || r.quantity !== undefined;
  if (hasNewShape) {
    return {
      description: r.description || "",
      unit_price: r.unit_price !== undefined ? Number(r.unit_price) || 0 : (Number(r.amount) || 0),
      quantity: r.quantity !== undefined ? Number(r.quantity) || 0 : 1,
    };
  }
  // Legacy { description, amount } → keep same total (unit_price = amount, qty = 1)
  return { description: r.description || "", unit_price: Number(r.amount) || 0, quantity: 1 };
}

/**
 * Unified manual adjustments section.
 * Each row: תיאור | מחיר ליחיד | כמות | סה״כ (= מחיר ליחיד × כמות).
 * New rows default quantity to the quote's total participant count (editable).
 */
export default function AdjustmentsSection({ lines, setLines, defaultQty = 1 }) {
  const update = (idx, field, val) =>
    setLines(prev => prev.map((r, i) => (i !== idx ? r : { ...r, [field]: val })));

  const addRow = () =>
    setLines(p => [...p, { description: "", unit_price: 0, quantity: defaultQty || 1 }]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">מחיר ליחיד שלילי = הנחה. סה״כ = מחיר ליחיד × כמות.</p>
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-xl p-2.5">
          <div className="col-span-5">
            <div className="text-[11px] text-slate-400 font-medium mb-0.5">תיאור</div>
            <Input className="h-8 text-xs bg-white" placeholder="תיאור" value={r.description}
              onChange={e => update(idx, "description", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-[11px] text-slate-400 font-medium mb-0.5">מחיר ליחיד (₪)</div>
            <Input className="h-8 text-xs bg-white" type="number" value={r.unit_price}
              onChange={e => update(idx, "unit_price", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-[11px] text-slate-400 font-medium mb-0.5">כמות</div>
            <Input className="h-8 text-xs bg-white" type="number" min="0" value={r.quantity}
              onChange={e => update(idx, "quantity", e.target.value)} />
          </div>
          <div className="col-span-3 flex items-end justify-end gap-1">
            <div className="text-right">
              <div className="text-[11px] text-slate-400 font-medium mb-0.5">סה״כ</div>
              <div className="text-xs font-semibold text-primary whitespace-nowrap h-8 flex items-center justify-end">
                {fmtMoney(calcAdjustmentLine(r))}
              </div>
            </div>
            <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))}
              className="text-slate-300 hover:text-red-400 mb-2.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs h-7 border-dashed">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>
    </div>
  );
}