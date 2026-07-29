import { Button } from "@/components/ui/button";

export default function PrisaCopyConfirm({ createCount, skippedCount, creating, onBack, onConfirm }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
        <p>ייווצרו <span className="font-bold">{createCount}</span> פריסות חדשות.</p>
        {skippedCount > 0 && <p className="text-amber-700">{skippedCount} תאריכים כבר כוללים פריסה זהה ולכן ידולגו.</p>}
      </div>
      <div className="flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={onBack}>חזרה</Button><Button size="sm" onClick={onConfirm} disabled={creating || createCount === 0}>{creating ? "יוצר..." : "צור פריסות"}</Button></div>
    </div>
  );
}