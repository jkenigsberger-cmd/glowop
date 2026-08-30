import { Button } from "@/components/ui/button";

export default function AdminSpaceStatusControl({ space, active, saving, onToggle }) {
  return (
    <div className="mt-1 flex flex-col items-center gap-1">
      <span className={`text-[10px] font-semibold ${active ? "text-emerald-700" : "text-slate-500"}`}>
        {active ? "פעיל" : "לא פעיל"}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 px-2 text-[10px]"
        disabled={saving}
        onClick={() => onToggle(space)}
      >
        {saving ? "..." : active ? "השבת מרחב" : "הפעל מרחב"}
      </Button>
    </div>
  );
}