import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, CheckCircle2, Clock, AlertTriangle, Users, Star } from "lucide-react";
import { toast } from "sonner";

const VIP_TOTAL_TENTS = 10;
const VIP_CAPACITY_PER_TENT = 3;

function NumberInput({ label, hint, value, onChange, warning }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      <Input
        type="number"
        min="0"
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={`h-8 text-sm ${warning ? "border-amber-400 bg-amber-50" : ""}`}
      />
      {warning && <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{warning}</p>}
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
      />
    </div>
  );
}

function SectionCard({ icon: Icon, title, color, children }) {
  return (
    <div className={`border rounded-xl p-4 space-y-3 ${color}`}>
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Icon className="w-4 h-4" /> {title}
      </h3>
      {children}
    </div>
  );
}

export default function SleepingRequirementsTab({ groupId, profile }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    boys_beds_needed: null,
    girls_beds_needed: null,
    estimated_student_tents_boys: null,
    estimated_student_tents_girls: null,
    staff_men_beds_needed: null,
    staff_women_beds_needed: null,
    vip_tents_men_needed: null,
    vip_tents_women_needed: null,
    student_sleeping_notes: "",
    staff_sleeping_notes: "",
    accessibility_sleeping_notes: "",
    housekeeping_sleeping_notes: "",
    sleeping_requirements_completed: false,
  });

  // Populate from profile when it loads
  useEffect(() => {
    if (!profile) return;
    setForm({
      boys_beds_needed:              profile.boys_beds_needed              ?? profile.boys_count   ?? null,
      girls_beds_needed:             profile.girls_beds_needed             ?? profile.girls_count  ?? null,
      estimated_student_tents_boys:  profile.estimated_student_tents_boys  ?? null,
      estimated_student_tents_girls: profile.estimated_student_tents_girls ?? null,
      staff_men_beds_needed:         profile.staff_men_beds_needed         ?? null,
      staff_women_beds_needed:       profile.staff_women_beds_needed       ?? null,
      vip_tents_men_needed:          profile.vip_tents_men_needed          ?? null,
      vip_tents_women_needed:        profile.vip_tents_women_needed        ?? null,
      student_sleeping_notes:        profile.student_sleeping_notes        ?? "",
      staff_sleeping_notes:          profile.staff_sleeping_notes          ?? "",
      accessibility_sleeping_notes:  profile.accessibility_sleeping_notes  ?? "",
      housekeeping_sleeping_notes:   profile.housekeeping_sleeping_notes   ?? "",
      sleeping_requirements_completed: !!profile.sleeping_requirements_completed,
    });
  }, [profile?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Derived helpers ────────────────────────────────────────────────────────
  const recommendedBoysTents  = form.boys_beds_needed  ? Math.ceil(form.boys_beds_needed  / 8) : null;
  const recommendedGirlsTents = form.girls_beds_needed ? Math.ceil(form.girls_beds_needed / 8) : null;

  const recommendedMenVip   = form.staff_men_beds_needed   ? Math.ceil(form.staff_men_beds_needed   / VIP_CAPACITY_PER_TENT) : null;
  const recommendedWomenVip = form.staff_women_beds_needed ? Math.ceil(form.staff_women_beds_needed / VIP_CAPACITY_PER_TENT) : null;

  const totalVipTents = (form.vip_tents_men_needed ?? 0) + (form.vip_tents_women_needed ?? 0);
  const vipExceedsMax = totalVipTents > VIP_TOTAL_TENTS;

  const vipMenFit   = form.vip_tents_men_needed   != null && form.staff_men_beds_needed   != null
    && (form.vip_tents_men_needed   * VIP_CAPACITY_PER_TENT < form.staff_men_beds_needed);
  const vipWomenFit = form.vip_tents_women_needed != null && form.staff_women_beds_needed != null
    && (form.vip_tents_women_needed * VIP_CAPACITY_PER_TENT < form.staff_women_beds_needed);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (markComplete = null) => {
    if (!profile) { toast.error("אין פרופיל תפעולי"); return; }
    setSaving(true);
    const payload = { ...form };
    if (markComplete !== null) payload.sleeping_requirements_completed = markComplete;
    await base44.entities.OperationalGroupProfile.update(profile.id, payload);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["operationalProfile", groupId] });
    if (markComplete === true) {
      toast.success("דרישות הלינה סומנו כמוכנות למשק בית ✓");
    } else if (markComplete === false) {
      toast.success("דרישות הלינה הוחזרו לעריכה");
    } else {
      toast.success("דרישות הלינה נשמרו");
    }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <p>אין פרופיל תפעולי מאושר לקבוצה זו.</p>
        <p className="text-xs mt-1">יש לאשר טופס קבלה כפרופיל תפעולי תחילה.</p>
      </div>
    );
  }

  const isCompleted = form.sleeping_requirements_completed;

  return (
    <div className="space-y-5" dir="rtl">

      {/* Status banner */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isCompleted ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300"}`}>
        {isCompleted
          ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          : <Clock className="w-5 h-5 text-amber-600 shrink-0" />
        }
        <div>
          <p className={`text-sm font-semibold ${isCompleted ? "text-emerald-800" : "text-amber-800"}`}>
            {isCompleted ? "דרישות לינה מוכנות למשק בית" : "ממתין לשיבוץ משק בית"}
          </p>
          <p className={`text-xs ${isCompleted ? "text-emerald-600" : "text-amber-600"}`}>
            {isCompleted
              ? "משק הבית יוכל להקצות אוהלים בהתאם לדרישות אלו"
              : "יש למלא את דרישות הלינה ולסמן כמוכן לפני שמשק הבית יוכל לשבץ אוהלים"
            }
          </p>
        </div>
        <div className="mr-auto">
          {isCompleted ? (
            <Button size="sm" variant="outline" onClick={() => handleSave(false)} disabled={saving} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-xs">
              חזור לעריכה
            </Button>
          ) : (
            <Button size="sm" onClick={() => handleSave(true)} disabled={saving || vipExceedsMax} className="bg-emerald-700 hover:bg-emerald-800 text-xs gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> סמן כמוכן למשק בית
            </Button>
          )}
        </div>
      </div>

      {/* ── Student requirements ─────────────────────────────────────────────── */}
      <SectionCard icon={Users} title="דרישות לינה — תלמידים / משתתפים" color="bg-blue-50/50 border-blue-200">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="מספר מיטות נדרש — בנים"
            hint={`מהשאלון: ${profile.boys_count ?? "—"}`}
            value={form.boys_beds_needed}
            onChange={v => set("boys_beds_needed", v)}
          />
          <NumberInput
            label="מספר מיטות נדרש — בנות"
            hint={`מהשאלון: ${profile.girls_count ?? "—"}`}
            value={form.girls_beds_needed}
            onChange={v => set("girls_beds_needed", v)}
          />
          <NumberInput
            label="אוהלים מוערכים — בנים (תכנון בלבד)"
            hint={recommendedBoysTents ? `המלצה: ${recommendedBoysTents} (לפי ~8 מיטות לאוהל)` : undefined}
            value={form.estimated_student_tents_boys}
            onChange={v => set("estimated_student_tents_boys", v)}
          />
          <NumberInput
            label="אוהלים מוערכים — בנות (תכנון בלבד)"
            hint={recommendedGirlsTents ? `המלצה: ${recommendedGirlsTents} (לפי ~8 מיטות לאוהל)` : undefined}
            value={form.estimated_student_tents_girls}
            onChange={v => set("estimated_student_tents_girls", v)}
          />
        </div>
        <div className="text-[11px] text-blue-600 bg-blue-100 rounded-lg px-3 py-2">
          ℹ️ בנים ובנות ישכנו בשכונות נפרדות. משק הבית יקצה את השכונות בפועל.
        </div>
        <TextArea
          label="הערות לינה — תלמידים / משק בית"
          value={form.student_sleeping_notes}
          onChange={v => set("student_sleeping_notes", v)}
          placeholder="הפרדה מיוחדת, קבוצות, הגדרות..."
        />
      </SectionCard>

      {/* ── Staff / VIP requirements ────────────────────────────────────────── */}
      <SectionCard icon={Star} title="דרישות לינה — צוות / VIP (אוהלי 80–89)" color="bg-purple-50/50 border-purple-200">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="מספר אנשי צוות — גברים"
            hint={`נהגים גברים: ${profile.drivers_men_count ?? "—"}`}
            value={form.staff_men_beds_needed}
            onChange={v => set("staff_men_beds_needed", v)}
          />
          <NumberInput
            label="מספר אנשי צוות — נשים"
            hint={`נהגות נשים: ${profile.drivers_women_count ?? "—"}`}
            value={form.staff_women_beds_needed}
            onChange={v => set("staff_women_beds_needed", v)}
          />
          <NumberInput
            label="אוהלי VIP נדרשים — גברים"
            hint={recommendedMenVip ? `המלצה: ${recommendedMenVip} אוהלים (עד 3 בני אדם לאוהל)` : "עד 3 בני אדם לאוהל"}
            value={form.vip_tents_men_needed}
            onChange={v => set("vip_tents_men_needed", v)}
            warning={vipMenFit ? `אוהלים אלו מכילים רק ${(form.vip_tents_men_needed ?? 0) * VIP_CAPACITY_PER_TENT} אנשים — לא מספיק לכל הצוות` : null}
          />
          <NumberInput
            label="אוהלי VIP נדרשים — נשים"
            hint={recommendedWomenVip ? `המלצה: ${recommendedWomenVip} אוהלים (עד 3 בני אדם לאוהל)` : "עד 3 בני אדם לאוהל"}
            value={form.vip_tents_women_needed}
            onChange={v => set("vip_tents_women_needed", v)}
            warning={vipWomenFit ? `אוהלים אלו מכילים רק ${(form.vip_tents_women_needed ?? 0) * VIP_CAPACITY_PER_TENT} אנשים — לא מספיק לכל הצוות` : null}
          />
        </div>

        {/* VIP summary + warnings */}
        <div className={`rounded-lg px-3 py-2 text-xs space-y-1 ${vipExceedsMax ? "bg-red-50 border border-red-300 text-red-700" : "bg-purple-100 border border-purple-200 text-purple-700"}`}>
          <p className="font-semibold">
            {vipExceedsMax
              ? `⚠️ סה"כ אוהלי VIP: ${totalVipTents} — חורג מהמקסימום (${VIP_TOTAL_TENTS} אוהלים בסה"כ)!`
              : `✓ סה"כ אוהלי VIP: ${totalVipTents} מתוך ${VIP_TOTAL_TENTS} זמינים`
            }
          </p>
          <p>גברים: {form.vip_tents_men_needed ?? 0} אוהלים · נשים: {form.vip_tents_women_needed ?? 0} אוהלים</p>
          <p className="text-[11px] opacity-75">אוהלי VIP ממוספרים 80–89. שיבוץ ספציפי ייעשה על ידי משק הבית.</p>
        </div>

        <TextArea
          label="הערות לינה — צוות / VIP"
          value={form.staff_sleeping_notes}
          onChange={v => set("staff_sleeping_notes", v)}
          placeholder="העדפות מיוחדות, צרכים רפואיים, הגדרות נוספות..."
        />
      </SectionCard>

      {/* ── Accessibility & general notes ───────────────────────────────────── */}
      <SectionCard icon={AlertTriangle} title="נגישות והערות כלליות" color="bg-amber-50/50 border-amber-200">
        <TextArea
          label="צרכי נגישות (לינה)"
          value={form.accessibility_sleeping_notes}
          onChange={v => set("accessibility_sleeping_notes", v)}
          placeholder="כסא גלגלים, קושי בטיפוס, מיטה נמוכה..."
        />
        <TextArea
          label="הערות כלליות למשק בית"
          value={form.housekeeping_sleeping_notes}
          onChange={v => set("housekeeping_sleeping_notes", v)}
          placeholder="כל הערה נוספת לצוות משק הבית..."
        />
      </SectionCard>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <Button onClick={() => handleSave(null)} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" />
          {saving ? "שומר..." : "שמור דרישות"}
        </Button>
      </div>

    </div>
  );
}