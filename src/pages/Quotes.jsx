import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const tabForStatus = status => status === "APPROVED" ? "approved" : ["REJECTED", "EXPIRED"].includes(status) ? "history" : "open";

export default function Quotes() {
  const { role } = useRoleContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("open");
  const enabled = isQuotePreparationEnabled(role);
  const multiOptionEnabled = isQuoteMultiOptionEnabled(role);
  const { data: quotes = [] } = useQuery({ queryKey: ["quoteCenter"], queryFn: () => base44.entities.Quote.list("-updated_date", 500), enabled });
  const { data: groups = [] } = useQuery({ queryKey: ["quoteCenterGroups"], queryFn: () => base44.entities.Group.list("-updated_date", 500), enabled });
  const { data: profiles = [] } = useQuery({ queryKey: ["quoteCenterProfiles"], queryFn: () => base44.entities.OperationalGroupProfile.list("-updated_date", 500), enabled });
  const { data: quoteOptions = [], isError: optionLoadFailed } = useQuery({ queryKey: ["quoteCenterOptions"], queryFn: async () => { try { return await base44.entities.QuoteOption.list("-updated_date", 1000); } catch (error) { console.error("[Quotes] failed to load QuoteOption prices", error); throw error; } }, enabled });

  const optionPricingMap = useMemo(() => {
    const grouped = quoteOptions.reduce((map, option) => { (map[option.quote_id] ||= []).push(option); return map; }, {});
    return Object.fromEntries(quotes.map(quote => {
      const rows = grouped[quote.id] || [];
      if (!rows.length) return [quote.id, quote.multi_option_enabled && optionLoadFailed ? { error: true } : { kind: "legacy" }];
      const optionA = rows.filter(row => row.option_key === "A");
      const optionB = rows.filter(row => row.option_key === "B");
      const validAOnly = rows.length === 1 && optionA.length === 1;
      const validAB = rows.length === 2 && optionA.length === 1 && optionB.length === 1;
      if (!validAOnly && !validAB) {
        console.error("[Quotes] invalid QuoteOption cardinality", { quoteId: quote.id, optionIds: rows.map(row => row.id) });
        return [quote.id, { error: true }];
      }
      return [quote.id, validAB
        ? { kind: "multi", A: Number(optionA[0].total_price || 0), B: Number(optionB[0].total_price || 0) }
        : { kind: "single", A: Number(optionA[0].total_price || 0) }];
    }));
  }, [quotes, quoteOptions, optionLoadFailed]);

  if (!enabled) return <div className="p-10 text-center text-muted-foreground" dir="rtl">מרכז הצעות המחיר עדיין אינו פעיל לתפקיד זה.</div>;
  const refresh = groupId => { invalidateQuotePreparationCache(qc, groupId); qc.invalidateQueries({ queryKey: ["quoteCenterOptions"] }); };
  const groupMap = Object.fromEntries(groups.map(group => [group.id, group]));
  const profileMap = Object.fromEntries(profiles.map(profile => [profile.group_id, profile]));
  const decide = async (quote, action, selectedOptionKey = "A") => {
    const group = groupMap[quote.group_id]; const profile = profileMap[quote.group_id];
    if (action === "reject") {
      const reason = window.prompt("סיבת דחייה"); if (!reason) return;
      let rejectedQuote;
      if (quote.preparation_flow_enabled) { const res = await base44.functions.invoke("rejectQuotePreparation", { quote_id: quote.id, rejection_reason: reason }); if (!res.data?.success) return toast.error("דחיית ההצעה נכשלה"); rejectedQuote = { ...quote, status: "REJECTED", rejection_reason: reason }; }
      else rejectedQuote = await base44.entities.Quote.update(quote.id, { status: "REJECTED" });
      updateQuotePreparationCache(qc, { quote: rejectedQuote, group, profile }); refresh(quote.group_id); setActiveTab("history"); toast.success("ההצעה נדחתה ונשמרה בהיסטוריה"); return;
    }
    const functionName = quote.preparation_flow_enabled ? "approveQuoteAndActivateGroup" : "approveQuoteAndInitializeGroup";
    const res = await base44.functions.invoke(functionName, { quote_id: quote.id, selected_option_key: selectedOptionKey });
    if (!res.data?.success) { toast.error("אישור ההצעה נכשל"); return false; }
    const { quote: approvedQuote, group: confirmedGroup, profile: operationalProfile } = res.data;
    updateQuotePreparationCache(qc, { quote: approvedQuote, group: confirmedGroup, profile: operationalProfile });
    refresh(confirmedGroup?.id); setActiveTab("approved"); toast.success("הצעת המחיר אושרה"); return true;
  };
  const sections = [{ key: "open", label: "פתוחות / בתהליך", rows: quotes.filter(isQuoteOpen) }, { key: "approved", label: "מאושרות", rows: quotes.filter(isQuoteApproved) }, { key: "history", label: "נדחו / היסטוריה", rows: quotes.filter(isQuoteRejected) }];
  const handleSaved = (savedQuote, savedOptions = []) => {
    updateQuotePreparationCache(qc, { quote: savedQuote });
    if (savedOptions.length) qc.setQueryData(["quoteCenterOptions"], rows => [...(rows || []).filter(option => option.quote_id !== savedQuote.id), ...savedOptions]);
    setCreating(false); setEditing(null); setActiveTab(tabForStatus(savedQuote.status));
    refresh(savedQuote.group_id); navigate("/quotes");
  };

  return <div className="max-w-5xl mx-auto px-4 py-6 space-y-5" dir="rtl"><div className="flex justify-between"><div><h1 className="text-xl font-bold flex gap-2"><FileText className="w-5 h-5" />הצעות מחיר</h1><p className="text-sm text-muted-foreground">מרכז מסחרי והיסטוריית הצעות</p></div><Button onClick={() => setCreating(true)}><Plus className="w-4 h-4" />הצעה חדשה</Button></div><Tabs value={activeTab} onValueChange={setActiveTab}><TabsList>{sections.map(section => <TabsTrigger key={section.key} value={section.key}>{section.label} ({section.rows.length})</TabsTrigger>)}</TabsList>{sections.map(section => <TabsContent key={section.key} value={section.key}><div className="space-y-3">{section.rows.map(quote => <QuoteCenterCard key={quote.id} quote={quote} group={groupMap[quote.group_id]} profile={profileMap[quote.group_id]} optionPricing={optionPricingMap[quote.id]} canDecide={["SUPER_ADMIN","ADMIN"].includes(role) && (!quote.multi_option_enabled || multiOptionEnabled)} onEdit={() => setEditing(quote)} onApprove={key => decide(quote, "approve", key)} onReject={() => decide(quote, "reject")} />)}{!section.rows.length && <p className="text-center py-12 text-muted-foreground">אין הצעות בקטגוריה זו</p>}</div></TabsContent>)}</Tabs>{(creating || editing) && <QuoteFormModal quote={editing} group={editing ? groupMap[editing.group_id] : undefined} returnToQuotes onClose={() => { setCreating(false); setEditing(null); }} onSaved={handleSaved} />}</div>;
}