import { useState } from "react";
import { base44 } from "@/api/base44Client";

const payloadPeriods = periods => periods.map(({ _draft_id, ...period }) => period);
export default function useActiveStayChange(groupId, onApplied) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (name, periods, extra = {}) => {
    setBusy(true); setError("");
    try {
      const response = await base44.functions.invoke(name, { group_id: groupId, periods: payloadPeriods(periods), ...extra });
      return response.data;
    } catch (err) {
      setError(err?.response?.data?.error || "הפעולה נכשלה");
      return null;
    } finally { setBusy(false); }
  };
  const previewChange = async periods => { const data = await run("previewActiveMultiPeriodStayChange", periods); if (data) setPreview(data); };
  const applyChange = async periods => { const data = await run("applyActiveMultiPeriodStayChange", periods, { confirmed: true }); if (data?.success) onApplied?.(data); };
  const resetPreview = () => setPreview(null);
  return { preview, busy, error, previewChange, applyChange, resetPreview };
}