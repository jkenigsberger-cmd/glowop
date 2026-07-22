import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OperationalActivationAction({ groupId, onActivated }) {
  const [loading, setLoading] = useState(false);
  const activate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await base44.functions.invoke("activatePreparationGroupOperationally", { group_id: groupId });
      if (!response.data?.success) throw new Error(response.data?.error || "OPERATIONAL_ACTIVATION_FAILED");
      onActivated(response.data);
      toast.success("הקבוצה אושרה לתפעול");
    } catch (error) {
      const code = error?.response?.data?.error || error?.message;
      const messages = { DUPLICATE_OPERATIONAL_PROFILE: "נמצאו מספר פרופילים תפעוליים", MULTIPLE_PREPARATION_QUOTES_FOR_GROUP: "נמצאו מספר הצעות הכנה לקבוצה", OPERATIONAL_PROFILE_QUOTE_CONFLICT: "הפרופיל התפעולי מקושר להצעה אחרת" };
      toast.error(messages[code] || "אישור הקבוצה לתפעול נכשל");
    } finally {
      setLoading(false);
    }
  };
  return <Button size="sm" onClick={activate} disabled={loading}>{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}{loading ? "מאשר..." : "אשר קבוצה לתפעול"}</Button>;
}