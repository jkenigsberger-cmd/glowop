import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, CheckCircle2, Clock, AlertTriangle, Users, Star, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import PeopleSummaryCard from "./PeopleSummaryCard";
import TentDistributionEditor from "./TentDistributionEditor";

const VIP_TOTAL_TENTS = 10;
const VIP_CAPACITY    = 3;
const STUDENT_CAPACITY = 8;

// ── small helpers ──────────────────────────────────────────────────────────
function parseDist(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function distTotal(rows) {
  return rows.reduce((s, r) => s + (r.tent_count || 0) * (r.people_per_tent || 0), 0);
}

function distTents(rows) {
  return rows.reduce((s, r) => s + (r.tent_count || 0), 0);
}

function hasOverMaxRow(rows, max) {
  return rows.some(r => r.people_per_tent > max);
}

// ── small UI helpers ───────────────────────────────────────────────────────
function NumberInput({ label, hint, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      <Input
        type="number" min="0"
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="h-8 text-sm"
      />
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
        className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
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

// ── main component ─────────────────────────────────────────────────────────
export default function SleepingRequirementsTab({ groupId, profile }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    boys_beds_needed:    null,
    girls_beds_needed:   null,
    staff_men_beds_needed:   null,
    staff_women_beds_needed: null,
    vip_tents_men_needed:    null,
    vip_tents_women_needed:  null,
    student_sleeping_notes:      "",
    staff_sleeping_notes:        "",
    accessibility_sleeping_notes:"",
    housekeeping_sleeping_notes: "",
    sleeping_requirements_completed: false,
  });

  const [boysDist,      setBoysDist]      = useState([]);
  const [girlsDist,     setGirlsDist]     = useState([]);
  const [staffMenDist,  setStaffMenDist]  = useState([]);
  const [staffWomenDist,setStaffWomenDist]= useState([]);

  useEffect(() => {
    if (!profile) return;
    setForm({
      boys_beds_needed:    profile.boys_beds_needed  ?? profile.boys_count  ?? null,
      girls_beds_needed:   profile.girls_beds_needed ?? profile.girls_count ?? null,
      staff_men_beds_needed:   profile.staff_men_beds_needed   ?? profile.drivers_men_count   ?? null,
      staff_women_beds_needed: profile.staff_women_beds_needed ?? profile.drivers_women_count ?? null,
      vip_tents_men_needed:    profile.vip_tents_men_needed    ?? null,
      vip_tents_women_needed:  profile.vip_tents_women_needed  ?? null,
      student_sleeping_notes:       profile.student_sleeping_notes       ?? "",
      staff_sleeping_notes:         profile.staff_sleeping_notes         ?? "",
      accessibility_sleeping_notes: profile.accessibility_sleeping_notes ?? "",
      housekeeping_sleeping_notes:  profile.housekeeping_sleeping_notes  ?? "",
      sleeping_requirements_completed: !!profile.sleeping_requirements_completed,
    });
    setBoysDist(      parseDist(profile.boys_tent_distribution_json));
    setGirlsDist(     parseDist(profile.girls_tent_distribution_json));
    setStaffMenDist(  parseDist(profile.staff_men_tent_distribution_json));
    setStaffWomenDist(parseDist(profile.staff_women_tent_distribution_json));
  }, [profile?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── derived ───────────────────────────────────────────────────────────────
  const totalVipTents = (form.vip_tents_men_needed ?? 0) + (form.vip_tents_women_needed ?? 0);
  const vipExceedsMax = totalVipTents > VIP_TOTAL_TENTS;

  const studentOverMax = hasOverMaxRow(boysDist, STUDENT_CAPACITY) || hasOverMaxRow(girlsDist, STUDENT_CAPACITY);
  const vipRowOverMax  = hasOverMaxRow(staffMenDist, VIP_CAPACITY) || hasOverMaxRow(staffWomenDist, VIP_CAPACITY);

  // Hard blocks for "סמן כמוכן"
  const hardBlocked = vipExceedsMax || studentOverMax || vipRowOverMax;

  // Soft warnings (distribution mismatch)
  const boysDistMismatch  = form.boys_beds_needed   != null && distTotal(boysDist)      !== form.boys_beds_needed;
  const girlsDistMismatch = form.girls_beds_needed  != null && distTotal(girlsDist)     !== form.girls_beds_needed;
  const menDistMismatch   = form.staff_men_beds_needed   != null && distTotal(staffMenDist)   !== form.staff_men_beds_needed;
  const womenDistMismatch = form.staff_women_beds_needed != null && distTotal(staffWomenDist) !== form.staff_women_beds_needed;
  const hasSoftWarnings   = boysDistMismatch || girlsDistMismatch || menDistMismatch || womenDistMismatch;

  // ── save ──────────────────────────────────────────────────────────────────
  const handleSave = async (markComplete = null) => {
    if (!profile) { toast.error("אין פרופיל תפעולי"); return; }

    if (markComplete === true) {
      if (hardBlocked) { toast.error("יש שגיאות קריטיות — לא ניתן לסמן כמוכן"); return; }
      if (hasSoftWarnings) {
        if (!window.confirm("יש פערים בחלוקת האוהלים. האם לסמן כמוכן בכל זאת?")) return;
      }
    }

    setSaving(true);
    const payload = {
      ...form,
      boys_tent_distribution_json:       JSON.stringify(boysDist),
      girls_tent_distribution_json:      JSON.stringify(girlsDist),
      staff_men_tent_distribution_json:  JSON.stringify(staffMenDist),
      staff_women_tent_distribution_json:JSON.stringify(staffWomenDist),
    };
    if (markComplete !== null) payload.sleeping_requirements_completed = markComplete;

    await base44.entities.OperationalGroupProfile.update(profile.id, payload);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["operationalProfile", groupId] });

    if (markComplete === true)       toast.success("דרישות הלינה סומנו כמוכנות למשק בית ✓");
    else if (markComplete === false) toast.success("דרישות הלינה הוחזרו לעריכה");
    else                             toast.success("דרישות הלינה נשמרו");
  };

  // ── guard ─────────────────────────────────────────────────────────────────
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
              : "יש למלא דרישות לינה ולסמן כמוכן לפני שמשק הבית יוכל לשבץ אוהלים"
            }
          </p>
        </div>
        <div className="mr-auto flex gap-2">
          {isCompleted ? (
            <Button size="sm" variant="outline" onClick={() => handleSave(false)} disabled={saving}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-xs">
              חזור לעריכה
            </Button>
          ) : (
            <Button size="sm" onClick={() => handleSave(true)}
              disabled={saving || hardBlocked}
              className="bg-emerald-700 hover:bg-emerald-800 text-xs gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> סמן כמוכן למשק בית
            </Button>
          )}
        </div>
      </div>

      {/* Hard-block warnings */}
      {hardBlocked && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> שגיאות קריטיות — חסום סימון כמוכן
          </p>
          {vipExceedsMax    && <p className="text-xs text-red-600">• סה"כ אוהלי VIP ({totalVipTents}) חורג מהמקסימום ({VIP_TOTAL_TENTS})</p>}
          {studentOverMax   && <p className="text-xs text-red-600">• יש שורת חלוקה עם יותר מ-{STUDENT_CAPACITY} תלמידים לאוהל</p>}
          {vipRowOverMax    && <p className="text-xs text-red-600">• יש שורת VIP עם יותר מ-{VIP_CAPACITY} אנשים לאוהל</p>}
        </div>
      )}

      {/* Part A — People summary */}
      <PeopleSummaryCard profile={profile} />

      {/* Part B+C+D — Students */}
      <SectionCard icon={Users} title="דרישות לינה — תלמידים / משתתפים" color="bg-blue-50/50 border-blue-200">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="מיטות נדרשות — בנים"
            hint={`מהשאלון: ${profile.boys_count ?? "—"}`}
            value={form.boys_beds_needed}
            onChange={v => set("boys_beds_needed", v)}
          />
          <NumberInput
            label="מיטות נדרשות — בנות"
            hint={`מהשאלון: ${profile.girls_count ?? "—"}`}
            value={form.girls_beds_needed}
            onChange={v => set("girls_beds_needed", v)}
          />
        </div>

        <TentDistributionEditor
          title="חלוקת אוהלים — בנים"
          required={form.boys_beds_needed}
          rows={boysDist}
          onChange={setBoysDist}
          maxPerTent={STUDENT_CAPACITY}
          capacityPerTent={STUDENT_CAPACITY}
          color="bg-blue-50"
        />

        <TentDistributionEditor
          title="חלוקת אוהלים — בנות"
          required={form.girls_beds_needed}
          rows={girlsDist}
          onChange={setGirlsDist}
          maxPerTent={STUDENT_CAPACITY}
          capacityPerTent={STUDENT_CAPACITY}
          color="bg-pink-50/70"
        />

        <div className="text-[11px] text-blue-600 bg-blue-100 rounded-lg px-3 py-2">
          ℹ️ בנים ובנות ישכנו באוהלים נפרדים. משק הבית יקצה את האוהלים הספציפיים בפועל.
        </div>

        <TextArea
          label="הערות לינה — תלמידים"
          value={form.student_sleeping_notes}
          onChange={v => set("student_sleeping_notes", v)}
          placeholder="הפרדה מיוחדת, קבוצות, הגדרות..."
        />
      </SectionCard>

      {/* Part B+C+D — Staff / VIP */}
      <SectionCard icon={Star} title="דרישות לינה — צוות / VIP (אוהלי 80–89)" color="bg-purple-50/50 border-purple-200">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="אנשי צוות — גברים"
            hint={`מהשאלון: ${profile.drivers_men_count ?? "—"}`}
            value={form.staff_men_beds_needed}
            onChange={v => set("staff_men_beds_needed", v)}
          />
          <NumberInput
            label="אנשי צוות — נשים"
            hint={`מהשאלון: ${profile.drivers_women_count ?? "—"}`}
            value={form.staff_women_beds_needed}
            onChange={v => set("staff_women_beds_needed", v)}
          />
          <NumberInput
            label="אוהלי VIP — גברים"
            hint={form.staff_men_beds_needed ? `המלצה: ${Math.ceil(form.staff_men_beds_needed / VIP_CAPACITY)} (עד ${VIP_CAPACITY} לאוהל)` : `עד ${VIP_CAPACITY} לאוהל`}
            value={form.vip_tents_men_needed}
            onChange={v => set("vip_tents_men_needed", v)}
          />
          <NumberInput
            label="אוהלי VIP — נשים"
            hint={form.staff_women_beds_needed ? `המלצה: ${Math.ceil(form.staff_women_beds_needed / VIP_CAPACITY)} (עד ${VIP_CAPACITY} לאוהל)` : `עד ${VIP_CAPACITY} לאוהל`}
            value={form.vip_tents_women_needed}
            onChange={v => set("vip_tents_women_needed", v)}
          />
        </div>

        {/* VIP counter */}
        <div className={`rounded-lg px-3 py-2 text-xs space-y-0.5 border ${vipExceedsMax ? "bg-red-50 border-red-300 text-red-700" : "bg-purple-100 border-purple-200 text-purple-700"}`}>
          <p className="font-semibold">
            {vipExceedsMax
              ? `⚠️ סה"כ VIP: ${totalVipTents} — חורג מהמקסימום (${VIP_TOTAL_TENTS})!`
              : `✓ סה"כ VIP: ${totalVipTents} / ${VIP_TOTAL_TENTS} אוהלים`
            }
          </p>
          <p>גברים: {form.vip_tents_men_needed ?? 0} · נשים: {form.vip_tents_women_needed ?? 0} · אוהלי VIP 80–89. שיבוץ ספציפי ייעשה ע"י משק הבית.</p>
        </div>

        <TentDistributionEditor
          title="חלוקת אוהלי VIP — גברים"
          required={form.staff_men_beds_needed}
          rows={staffMenDist}
          onChange={setStaffMenDist}
          maxPerTent={VIP_CAPACITY}
          capacityPerTent={VIP_CAPACITY}
          color="bg-purple-50"
          hint={`מקסימום ${VIP_CAPACITY} אנשים לאוהל VIP`}
        />

        <TentDistributionEditor
          title="חלוקת אוהלי VIP — נשים"
          required={form.staff_women_beds_needed}
          rows={staffWomenDist}
          onChange={setStaffWomenDist}
          maxPerTent={VIP_CAPACITY}
          capacityPerTent={VIP_CAPACITY}
          color="bg-fuchsia-50/70"
          hint={`מקסימום ${VIP_CAPACITY} אנשים לאוהל VIP`}
        />

        <TextArea
          label="הערות לינה — צוות / VIP"
          value={form.staff_sleeping_notes}
          onChange={v => set("staff_sleeping_notes", v)}
          placeholder="העדפות מיוחדות, צרכים רפואיים..."
        />
      </SectionCard>

      {/* Accessibility & general */}
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

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button onClick={() => handleSave(null)} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" />
          {saving ? "שומר..." : "שמור דרישות"}
        </Button>
      </div>
    </div>
  );
}