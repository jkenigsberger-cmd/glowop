import { useMemo, useState } from "react";
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

export default function StayPeriodsEditor({ groupId, periods, onChange }) {
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const normalized = useMemo(() => normalizeStayPeriods(periods), [periods]);
  const envelope = deriveStayEnvelope(normalized);
  const localValidation = validateStayPeriods(normalized);
  const operationalDates = getOperationalStayDates(normalized);
  const update = next => { onChange(normalizeStayPeriods(next)); setPreview(null); };
  const messages = [...new Set((preview?.errors || []).map(error => ERROR_MESSAGES[error.code] || error.message).filter(Boolean))];
  const checkPeriods = async () => {
    setChecking(true);
    try {
      const response = await base44.functions.invoke("previewGroupStayPeriods", { group_id: groupId, periods: normalized });
      setPreview(response.data);
    } catch (error) {
      setPreview({ valid: false, errors: [{ message: error?.response?.data?.error || "בדיקת התקופות נכשלה" }] });
    } finally { setChecking(false); }
  };
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
      <div><h3 className="text-base font-semibold">תקופות שהייה</h3>{envelope && localValidation.valid && <p className="text-xs text-muted-foreground">טווח כללי: {formatDate(envelope.start_date)}–{formatDate(envelope.end_date)} · {operationalDates.length} ימי שהייה</p>}</div>
      {normalized.map((period, index) => <StayPeriodRow key={`${period.start_date}-${period.end_date}-${index}`} period={period} index={index} onChange={(row, value) => update(normalized.map((item, i) => i === row ? value : item))} onRemove={row => update(normalized.filter((_, i) => i !== row))} />)}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => update([...normalized, { start_date: "", end_date: "", arrival_time: "", departure_time: "", status: "ACTIVE" }])}>הוספת תקופת שהייה</Button>
        <Button type="button" onClick={checkPeriods} disabled={checking}>{checking ? "בודק..." : "בדיקת תקופות"}</Button>
      </div>
      <StayPeriodsPreview result={preview} messages={messages} />
    </section>
  );
}