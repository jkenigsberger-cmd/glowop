import { Link } from "react-router-dom";
import { Calendar, Users, FileText, Pencil, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuoteStatusBadge from "@/components/quotes/QuoteStatusBadge";
import QuotePdfButton from "@/components/quotes/QuotePdfButton";

export default function QuoteCenterCard({ quote, group, profile, canDecide, onEdit, onApprove, onReject }) {
  return <div className="bg-card border border-border rounded-xl p-4 space-y-3" dir="rtl">
    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{quote.client_name || group?.group_name || "ללא שם"}</p><p className="text-xs text-muted-foreground">{quote.quote_number || `גרסה ${quote.version}`}</p></div><QuoteStatusBadge status={quote.status} /></div>
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">{quote.arrival_date && <span className="flex gap-1"><Calendar className="w-3 h-3" />{quote.arrival_date}{quote.departure_date ? ` — ${quote.departure_date}` : ""}</span>}<span className="flex gap-1"><Users className="w-3 h-3" />{quote.estimated_pax || 0}</span><span>₪{Math.round(quote.total_price || 0).toLocaleString()}</span></div>
    <div className="text-xs text-muted-foreground">קבוצה: {group ? `${group.group_name} · ${group.status}` : "לא נוצרה"} · פרופיל: {profile ? "קיים" : "חסר"} · עודכן {quote.updated_date?.slice(0, 10) || "—"}</div>
    <div className="flex flex-wrap gap-2">{group && <Button asChild size="sm" variant="outline"><Link to={`/groups/${group.id}`}><FileText className="w-3.5 h-3.5" />פתח קבוצה</Link></Button>}<QuotePdfButton quote={quote} group={group} /><Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="w-3.5 h-3.5" />עריכה</Button>{canDecide && ["DRAFT","SENT"].includes(quote.status) && <><Button size="sm" onClick={onApprove}><CheckCircle className="w-3.5 h-3.5" />אישור</Button><Button size="sm" variant="destructive" onClick={onReject}><XCircle className="w-3.5 h-3.5" />דחייה</Button></>}</div>
  </div>;
}