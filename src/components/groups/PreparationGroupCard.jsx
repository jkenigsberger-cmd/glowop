import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import OperationalActivationAction from "@/components/groups/OperationalActivationAction";

export default function PreparationGroupCard({ group, quote, profile, canActivate, onActivated }) {
  const canActivateOperationally = canActivate && group.quote_preparation_flow === true && ["DRAFT", "PENDING_APPROVAL"].includes(group.status);
  return <div className="bg-card border border-violet-200 rounded-xl p-4 space-y-2" dir="rtl">
    <div className="flex justify-between"><div><p className="font-semibold">{group.group_name}</p>{quote?.client_name && quote.client_name !== group.group_name && <p className="text-xs text-muted-foreground">לקוח: {quote.client_name}</p>}</div><span className="text-xs text-muted-foreground">{profile ? "פרופיל קיים" : "פרופיל ייווצר באישור"}</span></div>
    <p className="text-xs text-muted-foreground">{group.arrival_date || "—"}{group.arrival_time ? ` · ${group.arrival_time}` : ""} — {group.departure_date || "—"}{group.departure_time ? ` · ${group.departure_time}` : ""} · {group.total_pax || 0} משתתפים · {group.group_type === "LODGING" ? "לינה" : "פעילות יום"}</p>
    <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to={`/groups/${group.id}${profile ? "#operational-profile" : ""}`}>{profile ? "פתח פרופיל תפעולי" : "פתח קבוצה"}</Link></Button>{canActivateOperationally && <OperationalActivationAction groupId={group.id} onActivated={onActivated} />}</div>
  </div>;
}