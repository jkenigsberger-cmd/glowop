import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

const money = value => `₪${Math.round(Number(value) || 0).toLocaleString("he-IL")}`;

export default function QuoteOptionTabs({ active, hasB, totals, onSelect, onAdd, onDelete, busy }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {["A", ...(hasB ? ["B"] : [])].map(key => <button key={key} type="button" onClick={() => onSelect(key)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>אפשרות {key === "A" ? "א׳" : "ב׳"} — {money(totals[key])}</button>)}
        </div>
        {!hasB && <Button type="button" size="sm" variant="outline" onClick={onAdd} disabled={busy}><Plus className="h-3.5 w-3.5" />הוסף אפשרות ב׳</Button>}
      </div>
      {hasB && active === "B" && <button type="button" onClick={onDelete} disabled={busy} className="flex items-center gap-1 text-xs text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />מחק אפשרות ב׳</button>}
    </div>
  );
}