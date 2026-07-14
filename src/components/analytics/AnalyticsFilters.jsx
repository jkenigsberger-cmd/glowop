import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";

export default function AnalyticsFilters({ initial, onApply, onPrint }) {
  const [form, setForm] = useState(initial);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <div className="analytics-no-print rounded-xl border bg-card p-4 space-y-3">
    <div className="flex gap-4 flex-wrap">{[["single","חודש יחיד"],["range","טווח חודשים"],["compare","השוואה"]].map(([value,label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" checked={form.mode === value} onChange={() => set("mode", value)} />{label}</label>)}</div>
    <div className="flex items-end gap-3 flex-wrap">
      {form.mode !== "range" && <label className="text-xs text-muted-foreground">{form.mode === "compare" ? "חודש א׳" : "חודש"}<input type="month" value={form.monthA} onChange={e => set("monthA", e.target.value)} className="block mt-1 h-9 rounded-md border bg-background px-3 text-foreground" /></label>}
      {form.mode === "range" && <><label className="text-xs text-muted-foreground">מחודש<input type="month" value={form.rangeStart} onChange={e => set("rangeStart", e.target.value)} className="block mt-1 h-9 rounded-md border bg-background px-3 text-foreground" /></label><label className="text-xs text-muted-foreground">עד חודש<input type="month" value={form.rangeEnd} onChange={e => set("rangeEnd", e.target.value)} className="block mt-1 h-9 rounded-md border bg-background px-3 text-foreground" /></label></>}
      {form.mode === "compare" && <label className="text-xs text-muted-foreground">חודש ב׳<input type="month" value={form.monthB} onChange={e => set("monthB", e.target.value)} className="block mt-1 h-9 rounded-md border bg-background px-3 text-foreground" /></label>}
      <Button onClick={() => onApply({ ...form })}><RefreshCw className="h-4 w-4" />רענן</Button><Button variant="outline" onClick={onPrint}><Download className="h-4 w-4" />הורד PDF</Button>
    </div>
  </div>;
}