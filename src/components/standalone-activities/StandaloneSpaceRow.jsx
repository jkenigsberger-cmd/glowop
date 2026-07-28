import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LogisticsFields from "@/components/schedule/LogisticsFields";
import { Trash2 } from "lucide-react";

export default function StandaloneSpaceRow({ row, index, spaces, onChange, onRemove }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex gap-2 items-center">
        <Select value={row.activity_space_id || "none"} onValueChange={(value) => onChange({ activity_space_id: value === "none" ? "" : value })}>
          <SelectTrigger className="bg-white"><SelectValue placeholder="בחר מרחב" /></SelectTrigger>
          <SelectContent><SelectItem value="none">בחר מרחב</SelectItem>{spaces.map((space) => <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} disabled={index === 0}><Trash2 className="w-4 h-4 text-red-500" /></Button>
      </div>
      <Input value={row.setup_layout || ""} onChange={(event) => onChange({ setup_layout: event.target.value })} placeholder="סידור המקום" />
      <LogisticsFields value={row} onChange={onChange} compact />
      <Input value={row.notes || ""} onChange={(event) => onChange({ notes: event.target.value })} placeholder="הערות למרחב זה" />
    </div>
  );
}