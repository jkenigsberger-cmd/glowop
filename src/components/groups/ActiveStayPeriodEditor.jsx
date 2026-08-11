import { Button } from "@/components/ui/button";
import StayPeriodRow from "@/components/groups/StayPeriodRow";

export default function ActiveStayPeriodEditor({ periods, onChange, disabled }) {
  const update = (id, value) => onChange(periods.map(period => period._draft_id === id ? value : period));
  const remove = id => onChange(periods.filter(period => period._draft_id !== id));
  return (
    <div className="space-y-3">
      {periods.map((period, index) => <StayPeriodRow key={period._draft_id} period={period} index={index} onChange={update} onRemove={remove} />)}
      <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange([...periods, { _draft_id: crypto.randomUUID(), client_key: crypto.randomUUID(), start_date: "", end_date: "", arrival_time: "", departure_time: "" }])}>הוספת תקופת שהייה</Button>
    </div>
  );
}