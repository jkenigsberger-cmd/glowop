import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import RoleGate from "@/components/RoleGate";

export default function OperationalProfileAction({ groupId, profile, onReady, onOpen, openHref }) {
  const [loading, setLoading] = useState(false);
  if (profile && openHref) return <Button asChild size="sm" variant="outline"><Link to={openHref}><FileText className="w-3.5 h-3.5" />פתח פרופיל תפעולי</Link></Button>;
  if (profile) return <Button size="sm" variant="outline" onClick={onOpen}><FileText className="w-3.5 h-3.5" />פתח פרופיל תפעולי</Button>;

  const createProfile = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await base44.functions.invoke("ensureOperationalGroupProfile", { group_id: groupId });
      if (!response.data?.success || !response.data?.profile) throw new Error(response.data?.message || "יצירת הפרופיל נכשלה");
      onReady(response.data.profile, response.data.group);
      toast.success("הפרופיל התפעולי נוצר בהצלחה");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "יצירת הפרופיל נכשלה");
    } finally {
      setLoading(false);
    }
  };

  return <RoleGate roles={["SUPER_ADMIN", "ADMIN"]}><Button size="sm" variant="outline" onClick={createProfile} disabled={loading}>{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}{loading ? "יוצר פרופיל..." : "צור פרופיל תפעולי"}</Button></RoleGate>;
}