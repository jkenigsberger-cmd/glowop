import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { buildStayDates } from "@/lib/mealDuplication";
import PrisaCopyChoose from "@/components/prisa/PrisaCopyChoose";
import PrisaDateSelector from "@/components/prisa/PrisaDateSelector";
import PrisaCopyConfirm from "@/components/prisa/PrisaCopyConfirm";

export default function PrisaCopyModal({ sourcePrisa, arrivalDate, departureDate, existingRequests, onClose, onDone }) {
  const [step, setStep] = useState("choose");
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const hasStayDates = !!arrivalDate && !!departureDate && departureDate >= arrivalDate;
  const dates = useMemo(() => hasStayDates ? buildStayDates(arrivalDate, departureDate).filter((date) => date !== sourcePrisa.date) : [], [arrivalDate, departureDate, hasStayDates, sourcePrisa.date]);
  const taken = useMemo(() => new Set(existingRequests.filter((item) => item.status !== "CANCELLED" && item.type === sourcePrisa.type && item.pickup_slot === sourcePrisa.pickup_slot).map((item) => item.date)), [existingRequests, sourcePrisa]);
  const available = dates.filter((date) => !taken.has(date));
  const createCopies = async (targetDates) => {
    setCreating(true);
    try {
      const { data } = await base44.functions.invoke("copyPrisaToDates", { source_prisa_id: sourcePrisa.id, target_dates: targetDates });
      if (!data?.success) throw new Error(data?.error || "העתקת הפריסה נכשלה");
      const created = data.created?.length || 0;
      const skipped = data.skipped_existing?.length || 0;
      toast.success(created ? `נוצרו ${created} פריסות${skipped ? ` · ${skipped} תאריכים כבר כללו פריסה ולא שונו` : ""}` : "לא נוצרו פריסות חדשות — בכל התאריכים כבר קיימת פריסה");
      await onDone(data);
      onClose();
    } catch (error) { toast.error(error?.message || "העתקת הפריסה נכשלה"); setCreating(false); }
  };
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-md" dir="rtl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Copy className="w-4 h-4" /> להעתיק את הפריסה לתאריכים נוספים?</DialogTitle></DialogHeader>
    {step === "choose" && <PrisaCopyChoose availableCount={available.length} candidateCount={dates.length} hasStayDates={hasStayDates} onAll={() => setStep("confirm")} onSelect={() => { setSelected(available); setStep("select"); }} onClose={onClose} />}
    {step === "select" && <PrisaDateSelector dates={dates} takenDates={taken} selectedDates={selected} onToggle={(date) => setSelected((prev) => prev.includes(date) ? prev.filter((item) => item !== date) : [...prev, date])} onSelectAll={() => setSelected(selected.length === available.length ? [] : available)} onBack={() => setStep("choose")} onConfirm={() => createCopies(selected)} creating={creating} />}
    {step === "confirm" && <PrisaCopyConfirm createCount={available.length} skippedCount={dates.length - available.length} creating={creating} onBack={() => setStep("choose")} onConfirm={() => createCopies(dates)} />}
  </DialogContent></Dialog>;
}