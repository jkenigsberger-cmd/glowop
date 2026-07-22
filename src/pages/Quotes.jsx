import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRoleContext } from "@/lib/RoleContext";
import { isQuotePreparationEnabled, isQuoteOpen, isQuoteApproved, isQuoteRejected } from "@/lib/quotePreparationFlow";
import { isQuoteMultiOptionEnabled } from "@/lib/quoteMultiOption";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import QuoteFormModal from "@/components/quotes/QuoteFormModal";
import QuoteCenterCard from "@/components/quotes/QuoteCenterCard";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { updateQuotePreparationCache, invalidateQuotePreparationCache } from "@/lib/quotePreparationCache";

export default function Quotes() {
  const { role } = useRoleContext(); const qc = useQueryClient(); const [editing, setEditing] = useState(null); const [creating, setCreating] = useState(false);
  const enabled = isQuotePreparationEnabled(role); const multiOptionEnabled = isQuoteMultiOptionEnabled(role);
  const { data: quotes = [] } = useQuery({ queryKey: ["quoteCenter"], queryFn: () => base44.entities.Quote.list("-updated_date", 500), enabled });
  const { data: groups = [] } = useQuery({ queryKey: ["quoteCenterGroups"], queryFn: () => base44.entities.Group.list("-updated_date", 500), enabled });
  const { data: profiles = [] } = useQuery({ queryKey: ["quoteCenterProfiles"], queryFn: () => base44.entities.OperationalGroupProfile.list("-updated_date", 500), enabled });
  if (!enabled) return <div className="p-10 text-center text-muted-foreground" dir="rtl">מרכז הצעות המחיר עדיין אינו פעיל לתפקיד זה.</div>;
  const refresh = (groupId) => invalidateQuotePreparationCache(qc, groupId);
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g])); const profileMap = Object.fromEntries(profiles.map(p => [p.group_id, p]));
  const decide = async (quote, action, selectedOptionKey = "A") => {
    const group = groupMap[quote.group_id]; const profile = profileMap[quote.group_id];
    if (action === "reject") {
      const reason = window.prompt("סיבת דחייה"); if (!reason) return;
      let rejectedQuote;
      if (quote.preparation_flow_enabled) { const res = await base44.functions.invoke("rejectQuotePreparation", { quote_id: quote.id, rejection_reason: reason }); if (!res.data?.success) return toast.error("דחיית ההצעה נכשלה"); rejectedQuote = { ...quote, status: "REJECTED", rejection_reason: reason }; }
      else rejectedQuote = await base44.entities.Quote.update(quote.id, { status: "REJECTED" });
      updateQuotePreparationCache(qc, { quote: rejectedQuote, group, profile }); refresh(quote.group_id); toast.success("ההצעה נדחתה ונשמרה בהיסטוריה"); return;
    }
    const functionName = quote.preparation_flow_enabled ? "approveQuoteAndActivateGroup" : "approveQuoteAndInitializeGroup";
    const res = await base44.functions.invoke(functionName, { quote_id: quote.id, selected_option_key: selectedOptionKey });
    if (!res.data?.success) { toast.error("אישור ההצעה נכשל"); return false; }
    const groupId = res.data.group_id || quote.group_id;
    updateQuotePreparationCache(qc, { quote: { ...quote, group_id: groupId, status: "APPROVED", approved_option_key: selectedOptionKey }, group: group ? { ...group, status: "CONFIRMED" } : undefined, profile });
    refresh(groupId); toast.success("ההצעה אושרה והקבוצה הופעלה"); return true;
  };
  const sections = [{ key: "open", label: "פתוחות / בתהליך", rows: quotes.filter(isQuoteOpen) }, { key: "approved", label: "מאושרות", rows: quotes.filter(isQuoteApproved) }, { key: "history", label: "נדחו / היסטוריה", rows: quotes.filter(isQuoteRejected) }];
  return <div className="max-w-5xl mx-auto px-4 py-6 space-y-5" dir="rtl"><div className="flex justify-between"><div><h1 className="text-xl font-bold flex gap-2"><FileText className="w-5 h-5" />הצעות מחיר</h1><p className="text-sm text-muted-foreground">מרכז מסחרי והיסטוריית הצעות</p></div><Button onClick={() => setCreating(true)}><Plus className="w-4 h-4" />הצעה חדשה</Button></div><Tabs defaultValue="open"><TabsList>{sections.map(s => <TabsTrigger key={s.key} value={s.key}>{s.label} ({s.rows.length})</TabsTrigger>)}</TabsList>{sections.map(s => <TabsContent key={s.key} value={s.key}><div className="space-y-3">{s.rows.map(q => <QuoteCenterCard key={q.id} quote={q} group={groupMap[q.group_id]} profile={profileMap[q.group_id]} canDecide={["SUPER_ADMIN","ADMIN"].includes(role) && (!q.multi_option_enabled || multiOptionEnabled)} onEdit={() => setEditing(q)} onApprove={(key) => decide(q, "approve", key)} onReject={() => decide(q, "reject")} />)}{!s.rows.length && <p className="text-center py-12 text-muted-foreground">אין הצעות בקטגוריה זו</p>}</div></TabsContent>)}</Tabs>{(creating || editing) && <QuoteFormModal quote={editing} group={editing ? groupMap[editing.group_id] : undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={(savedQuote) => { setCreating(false); setEditing(null); refresh(savedQuote?.group_id); }} />}</div>;
}