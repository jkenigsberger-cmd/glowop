import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function MultiPeriodActivationAction({ groupId, onActivated }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const activate = async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke("activateMultiPeriodGroup", { group_id: groupId });
      if (!data?.success) throw new Error(data?.error || "ACTIVATION_FAILED");
      toast.success(data.status === "already_activated" ? "המכינה כבר פעילה" : "המכינה אושרה והופעלה");
      setConfirming(false);
      onActivated?.(data);
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || "הפעלת המכינה נכשלה");
    } finally { setLoading(false); }
  };

  return <>
    <Button size="sm" onClick={() => setConfirming(true)} className="gap-1.5"><CheckCircle className="w-3.5 h-3.5" />אישור והפעלת מכינה</Button>
    {confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="font-bold text-slate-800">אישור והפעלת מכינה</h2>
        <div className="text-sm text-slate-600 space-y-2">
          <p>המכינה תהפוך לפעילה במודולים התפעוליים.</p>
          <p>תקופות השהייה השמורות יקבעו את הנוכחות, ובתאריכי הפער המכינה לא תיחשב כנוכחת.</p>
          <p className="font-medium text-amber-700">לאחר ההפעלה עריכת התקופות תהיה נעולה בשלב זה.</p>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={loading} onClick={() => setConfirming(false)}>ביטול</Button><Button size="sm" disabled={loading} onClick={activate}>{loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{loading ? "מפעיל..." : "אישור והפעלה"}</Button></div>
      </div>
    </div>}
  </>;
}