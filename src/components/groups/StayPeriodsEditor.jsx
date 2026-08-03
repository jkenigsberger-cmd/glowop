import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { deriveStayEnvelope, getOperationalStayDates, normalizeStayPeriods, validateStayPeriods } from "@/lib/groupStayPeriods";
import StayPeriodRow from "@/components/groups/StayPeriodRow";
import StayPeriodsPreview from "@/components/groups/StayPeriodsPreview";

const ERROR_MESSAGES = {
  NO_ACTIVE_PERIODS: "יש להוסיף לפחות תקופת שהייה אחת",
  INVALID_DATE: "יש להזין תאריך התחלה ותאריך סיום",
  END_BEFORE_START: "תאריך הסיום לא יכול להיות לפני תאריך ההתחלה",
  OVERLAPPING_PERIODS: "תקופות השהייה חופפות זו לזו",
  DUPLICATE_PERIOD: "קיימת תקופת שהייה כפולה",
};
const formatDate = value => value ? value.split("-").reverse().join(".") : "—";

export default function StayPeriodsEditor({ groupId, periods, onChange, onPreviewChange }) {
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const normalized = useMemo(() => normalizeStayPeriods(periods), [periods]);
  const envelope = deriveStayEnvelope(normalized);
  const localValidation = validateStayPeriods(normalized);
  const operationalDates = getOperationalStayDates(normalized);
  const update = next => { onChange(next); setPreview(null); onPreviewChange?.(false); };
  const visibleErrors = (preview?.errors || []).filter(error => {
    if (error.code !== "OVERLAPPING_PERIODS") return true;
    const current = preview.normalized_periods?.[error.index];
    const previous = preview.normalized_periods?.[error.previous_index];
    return !current || !previous || current.start_date !== previous.start_date || current.end_date !== previous.end_date;
  });
  const messages = [...new Set(visibleErrors.map(error => ERROR_MESSAGES[error.code] || error.message).filter(Boolean))];
  useEffect(() => { setPreview(null); onPreviewChange?.(false); }, [groupId]);
  const checkPeriods = async () => {
    setChecking(true);
    try {
      const payloadPeriods = normalized.map(({ _draft_id, ...period }) => period);
      const response = await base44.functions.invoke("previewGroupStayPeriods", { group_id: groupId, periods: payloadPeriods });
      setPreview(response.data);
      onPreviewChange?.(response.data?.success === true && response.data?.valid === true);
    } catch (error) {
      setPreview({ valid: false, errors: [{ message: error?.response?.data?.error || "בדיקת התקופות נכשלה" }] });
      onPreviewChange?.(false);
    } finally { setChecking(false); }
  };
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
      <div><h3 className="text-base font-semibold">תקופות שהייה</h3>{envelope && localValidation.valid && <p className="text-xs text-muted-foreground">טווח כללי: {formatDate(envelope.start_date)}–{formatDate(envelope.end_date)} · {operationalDates.length} ימי שהייה</p>}</div>
      {periods.map((period, index) => <StayPeriodRow key={period._draft_id} period={period} index={index} onChange={(id, value) => update(periods.map(item => item._draft_id === id ? value : item))} onRemove={id => update(periods.filter(item => item._draft_id !== id))} />)}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => update([...periods, { _draft_id: crypto.randomUUID(), start_date: "", end_date: "", arrival_time: "", departure_time: "", status: "ACTIVE" }])}>הוספת תקופת שהייה</Button>
        <Button type="button" onClick={checkPeriods} disabled={checking}>{checking ? "בודק..." : "בדיקת תקופות"}</Button>
      </div>
      <StayPeriodsPreview result={preview} messages={messages} />
    </section>
  );
}