import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";
import EffectiveReassignmentDialog from "./EffectiveReassignmentDialog";

export default function EffectiveReassignmentPanel({ group, allocations, tents, neighborhoods, onSaved }) {
  const [selected, setSelected] = useState(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  if (group?.stay_mode !== "CONTINUOUS" || today < group.arrival_date) return null;
  const rows = allocations.filter(a => a.status === "CONFIRMED" && a.arrival_date <= today && a.departure_date > today);
  if (!rows.length) return null;
  const tentName = id => tents.find(t => t.id === id)?.code || id;
  const hoodName = id => neighborhoods.find(n => n.id === id)?.name || "";
  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2" dir="rtl"><h3 className="text-sm font-semibold text-blue-800">שינוי מקום לינה במהלך השהייה</h3>
    <p className="text-xs text-blue-700">השינוי מפצל את השיבוץ ושומר את ההיסטוריה עד התאריך הנבחר.</p>
    {rows.map(row => <div key={row.id} className="flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2"><span className="text-xs flex-1">אוהל {tentName(row.tent_id)} · {hoodName(row.neighborhood_id)} · {row.arrival_date}–{row.departure_date}</span><Button size="sm" variant="outline" className="gap-1" onClick={() => setSelected(row)}><ArrowLeftRight className="w-3.5 h-3.5" />שנה החל מתאריך</Button></div>)}
    {selected && <EffectiveReassignmentDialog allocation={selected} tents={tents.filter(t => t.working_status === "WORKING")} today={today} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); onSaved(); }} />}
  </section>;
}