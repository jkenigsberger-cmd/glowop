import { AlertTriangle, Ban, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BLOCK_REASON_LABELS } from "@/lib/activitySpaceBlocks";

export default function SpaceBlockList({ blocks, canManage, onEdit, onCancel, onConflicts }) {
  if (!blocks.length) return <div className="border border-dashed rounded-xl p-8 text-center text-sm text-slate-400">אין חסימות מרחבים</div>;
  return <div className="space-y-2" dir="rtl">{blocks.map(block => (
    <div key={block.id} className={`border rounded-xl px-4 py-3 flex gap-3 items-center flex-wrap ${block.status === "ACTIVE" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200 opacity-70"}`}>
      <Ban className={block.status === "ACTIVE" ? "text-amber-600 w-5 h-5" : "text-slate-400 w-5 h-5"} />
      <div className="flex-1 min-w-[220px]"><p className="font-semibold text-sm">{block.activity_space_name} — {BLOCK_REASON_LABELS[block.reason_type] || block.reason_type}</p><p className="text-xs text-slate-500">{block.start_date} עד {block.end_date} · {block.start_time}–{block.end_time}</p>{block.reason_notes && <p className="text-xs text-slate-600 mt-1">{block.reason_notes}</p>}</div>
      {block.conflict_acknowledged && <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => onConflicts(block)}><AlertTriangle className="w-3.5 h-3.5" /> הצג התנגשויות</Button>}
      {block.status === "ACTIVE" && canManage && <><Button size="sm" variant="outline" onClick={() => onEdit(block)}><Pencil className="w-3.5 h-3.5" /> ערוך</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => onCancel(block)}><Ban className="w-3.5 h-3.5" /> בטל חסימה</Button></>}
      {block.status === "CANCELLED" && <span className="text-xs rounded-full bg-slate-200 px-2 py-1">בוטל</span>}
    </div>
  ))}</div>;
}