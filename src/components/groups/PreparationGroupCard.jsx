import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import QuoteOptionApprovalDialog from "@/components/quotes/QuoteOptionApprovalDialog";
import OperationalProfileAction from "@/components/groups/OperationalProfileAction";

export default function PreparationGroupCard({ group, quote, profile, canApprove, onApprove, onProfileReady }) {
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  return <div className="bg-card border border-violet-200 rounded-xl p-4 space-y-2" dir="rtl"><div className="flex justify-between"><div><p className="font-semibold">{group.group_name}</p><span className="text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">הצעת מחיר פתוחה</span></div><span className="text-xs text-muted-foreground">{profile ? "פרופיל בהכנה" : "פרופיל חסר"}</span></div><p className="text-xs text-muted-foreground">{group.arrival_date || "—"} — {group.departure_date || "—"} · {group.total_pax || 0} משתתפים · {group.group_type === "LODGING" ? "לינה" : "פעילות יום"}</p><p className="text-xs text-muted-foreground">עודכן {group.updated_date?.slice(0,10) || "—"}</p><div className="flex gap-2"><OperationalProfileAction groupId={group.id} profile={profile} onReady={onProfileReady} openHref={`/groups/${group.id}#operational-profile`} /><Button asChild size="sm" variant="ghost"><Link to="/quotes">פתח הצעה</Link></Button>{canApprove && <Button size="sm" onClick={() => quote.multi_option_enabled ? setOptionDialogOpen(true) : onApprove("A")}><CheckCircle className="w-3.5 h-3.5" />אישור</Button>}</div><QuoteOptionApprovalDialog quote={quote} open={optionDialogOpen} onClose={() => setOptionDialogOpen(false)} onConfirm={async (key) => { const success = await onApprove(key); if (success === false) throw new Error("APPROVAL_FAILED"); setOptionDialogOpen(false); }} /></div>;
}