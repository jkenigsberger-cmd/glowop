import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  FileText, Save, CheckCircle2, Send, Copy, Check, Printer, AlertTriangle, Eye,
} from "lucide-react";
import RoleGate from "@/components/RoleGate";
import IncidentEditor from "@/components/post-stay/IncidentEditor";
import ReportPreview from "@/components/post-stay/ReportPreview";
import {
  REPORT_STATUS_LABELS, REPORT_STATUS_STYLES,
  DEFAULT_THANK_YOU, DEFAULT_RETURN_INVITATION, buildCopyMessage,
} from "@/lib/postStayLabels";

const fmt = (d) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

function Toggle({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border ${
        checked ? "bg-primary/10 border-primary/30 text-primary" : "bg-slate-50 border-slate-200 text-slate-500"
      }`}
    >
      <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-slate-300"}`}>
        {checked && <Check className="w-2.5 h-2.5 text-white" />}
      </span>
      {label}
    </button>
  );
}

export default function PostStayTab({ groupId, profile, group }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(null); // local editable copy of the report

  const departed = useMemo(() => {
    const dep = group?.departure_date;
    if (!dep) return false;
    return new Date(dep) < new Date(new Date().toDateString());
  }, [group]);
  const isCompleted = group?.status === "COMPLETED" || group?.status === "ARCHIVED";
  const canActUnlocked = departed || isCompleted;

  // ── Data ────────────────────────────────────────────────────────────
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["postStayReport", groupId],
    queryFn: () => base44.entities.PostStayReport.filter({ group_id: groupId }),
    enabled: !!groupId,
  });
  const report = reports.find((r) => r.status !== "CANCELLED") || null;

  const { data: incidents = [] } = useQuery({
    queryKey: ["postStayIncidents", groupId],
    queryFn: () => base44.entities.PostStayIncident.filter({ group_id: groupId, status: "ACTIVE" }),
    enabled: !!groupId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["postStayActivities", groupId],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ group_id: groupId, status: "ACTIVE" }, "date"),
    enabled: !!groupId,
  });
  const { data: meals = [] } = useQuery({
    queryKey: ["postStayMeals", groupId],
    queryFn: () => base44.entities.MealReservation.filter({ group_id: groupId, status: "ACTIVE" }),
    enabled: !!groupId,
  });
  const { data: coffee = [] } = useQuery({
    queryKey: ["postStayCoffee", groupId],
    queryFn: () => base44.entities.CoffeeCornerRequest.filter({ group_id: groupId, status: "ACTIVE" }),
    enabled: !!groupId,
  });
  const { data: prisa = [] } = useQuery({
    queryKey: ["postStayPrisa", groupId],
    queryFn: () => base44.entities.PrisaRequest.filter({ group_id: groupId, status: "ACTIVE" }),
    enabled: !!groupId,
  });

  const participantCount = profile?.total_pax || group?.total_pax || 0;
  const activityNames = useMemo(() => [...new Set(activities.map((a) => a.activity_name).filter(Boolean))], [activities]);
  const visibleIncidents = useMemo(() => incidents.filter((i) => i.client_visible), [incidents]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["postStayReport", groupId] });
    queryClient.invalidateQueries({ queryKey: ["postStayIncidents", groupId] });
  };

  // Effective report used by the form/preview: local draft if editing, else saved report
  const current = draft || report;

  // ── Create ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (report) return; // open existing — never duplicate
    setCreating(true);
    let me = null;
    try { me = await base44.auth.me(); } catch { /* ignore */ }
    const payload = {
      group_id: groupId,
      operational_group_profile_id: profile?.id || null,
      status: "DRAFT",
      report_date: new Date().toISOString().split("T")[0],
      generated_date: new Date().toISOString(),
      thank_you_text: DEFAULT_THANK_YOU,
      return_invitation_text: DEFAULT_RETURN_INVITATION,
      summary_notes: "",
      internal_notes: "",
      include_activities: true,
      include_meals: false,
      include_coffee_corner: false,
      include_prisa: false,
      include_sleeping_summary: false,
      include_incidents: true,
      recipient_name: group?.contact_name || "",
      recipient_email: group?.contact_email || "",
      recipient_phone: group?.contact_phone || "",
      created_by: me?.email || "",
      updated_by: me?.email || "",
      last_generated_snapshot_date: new Date().toISOString(),
    };
    await base44.entities.PostStayReport.create(payload);
    toast.success("נוצרה טיוטת סיכום שהייה");
    setCreating(false);
    invalidate();
  };

  const startEdit = () => setDraft({ ...report });

  const handleSave = async (overrideStatus) => {
    if (!current?.id) return;
    setSaving(true);
    let me = null;
    try { me = await base44.auth.me(); } catch { /* ignore */ }
    const updates = {
      thank_you_text: current.thank_you_text,
      return_invitation_text: current.return_invitation_text,
      summary_notes: current.summary_notes,
      internal_notes: current.internal_notes,
      recipient_name: current.recipient_name,
      recipient_email: current.recipient_email,
      recipient_phone: current.recipient_phone,
      include_activities: current.include_activities,
      include_meals: current.include_meals,
      include_coffee_corner: current.include_coffee_corner,
      include_prisa: current.include_prisa,
      include_sleeping_summary: current.include_sleeping_summary,
      include_incidents: current.include_incidents,
      updated_by: me?.email || "",
    };
    if (overrideStatus) {
      updates.status = overrideStatus;
      if (overrideStatus === "SENT") updates.sent_date = new Date().toISOString();
    }
    await base44.entities.PostStayReport.update(current.id, updates);
    toast.success(overrideStatus ? "הסטטוס עודכן" : "הטיוטה נשמרה");
    setDraft(null);
    setSaving(false);
    invalidate();
  };

  const handleCopy = () => {
    const msg = buildCopyMessage({ group, report: current, participantCount, activityNames, visibleIncidents });
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("ההודעה הועתקה");
  };

  const handlePrint = () => {
    document.body.classList.add("post-stay-print-mode");
    const cleanup = () => {
      document.body.classList.remove("post-stay-print-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Fallback in case afterprint doesn't fire
    setTimeout(cleanup, 1000);
    window.print();
  };

  const setField = (key, value) => setDraft((d) => ({ ...(d || report), [key]: value }));
  const editing = !!draft;

  if (!profile && !group) return null;

  // ── No report yet ───────────────────────────────────────────────────
  if (!isLoading && !report) {
    return (
      <RoleGate permission="MANAGE_POST_STAY" fallback={<p className="text-sm text-muted-foreground text-center py-8">אין לך הרשאה לסיכום שהייה</p>}>
        <div dir="rtl" className="space-y-4">
          {!canActUnlocked && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              הקבוצה עדיין לא עזבה — ניתן להכין טיוטה בלבד
            </div>
          )}
          <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">עדיין לא נוצר סיכום שהייה לקבוצה זו</p>
            <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
              <FileText className="w-4 h-4" /> {creating ? "יוצר..." : "צור סיכום שהייה"}
            </Button>
          </div>
        </div>
      </RoleGate>
    );
  }

  if (isLoading || !current) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const isSent = report?.status === "SENT";

  return (
    <RoleGate permission="MANAGE_POST_STAY" fallback={<p className="text-sm text-muted-foreground text-center py-8">אין לך הרשאה לסיכום שהייה</p>}>
      <div dir="rtl" className="space-y-4">
        {/* Print-only view */}
        <div className="hidden print:block">
          <ReportPreview
            group={group} report={current} participantCount={participantCount}
            activities={activities} meals={meals} coffee={coffee} prisa={prisa}
            visibleIncidents={visibleIncidents} forPrint
          />
        </div>

        {/* Everything below hidden when printing */}
        <div className="print:hidden space-y-4">
          {!canActUnlocked && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              הקבוצה עדיין לא עזבה — ניתן להכין טיוטה בלבד
            </div>
          )}

          {/* Header */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> {group?.group_name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmt(group?.arrival_date)} – {fmt(group?.departure_date)} · {participantCount} משתתפים · {group?.status}
                </p>
              </div>
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${REPORT_STATUS_STYLES[report?.status]}`}>
                {REPORT_STATUS_LABELS[report?.status]}
              </span>
            </div>

            {isSent && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                הסיכום כבר סומן כנשלח — שינוי ייצור גרסה מעודכנת
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!editing && <Button size="sm" variant="outline" onClick={startEdit} className="gap-1"><FileText className="w-3.5 h-3.5" /> ערוך</Button>}
              {editing && <Button size="sm" onClick={() => handleSave()} disabled={saving} className="gap-1"><Save className="w-3.5 h-3.5" /> {saving ? "שומר..." : "שמור טיוטה"}</Button>}
              {report?.status === "DRAFT" && <Button size="sm" variant="outline" onClick={() => handleSave("READY")} disabled={saving} className="gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> סמן כמוכן לשליחה</Button>}
              {report?.status === "READY" && <Button size="sm" variant="outline" onClick={() => handleSave("SENT")} disabled={saving} className="gap-1 text-emerald-700 border-emerald-300"><Send className="w-3.5 h-3.5" /> סמן כנשלח</Button>}
              <Button size="sm" variant="outline" onClick={handleCopy} className={`gap-1 ${copied ? "border-green-400 text-green-600 bg-green-50" : ""}`}>
                {copied ? <><Check className="w-3.5 h-3.5" /> הועתק!</> : <><Copy className="w-3.5 h-3.5" /> העתק הודעה</>}
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1"><Printer className="w-3.5 h-3.5" /> הדפס / יצוא</Button>
            </div>
          </div>

          {/* Two columns: editor | preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Editor side */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold">טקסט הסיכום</p>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">הודעת תודה</label>
                  <Textarea value={current.thank_you_text || ""} disabled={!editing} rows={3} onChange={(e) => setField("thank_you_text", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">הזמנה לחזור</label>
                  <Textarea value={current.return_invitation_text || ""} disabled={!editing} rows={2} onChange={(e) => setField("return_invitation_text", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">הערות סיכום (גלוי ללקוח)</label>
                  <Textarea value={current.summary_notes || ""} disabled={!editing} rows={2} onChange={(e) => setField("summary_notes", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">הערות פנימיות (לא מוצג ללקוח)</label>
                  <Textarea value={current.internal_notes || ""} disabled={!editing} rows={2} onChange={(e) => setField("internal_notes", e.target.value)} className="bg-amber-50/40" />
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold">פרטי נמען</p>
                <div className="grid grid-cols-1 gap-2">
                  <Input value={current.recipient_name || ""} disabled={!editing} placeholder="שם איש קשר" onChange={(e) => setField("recipient_name", e.target.value)} />
                  <Input value={current.recipient_email || ""} disabled={!editing} placeholder="אימייל" onChange={(e) => setField("recipient_email", e.target.value)} />
                  <Input value={current.recipient_phone || ""} disabled={!editing} placeholder="טלפון" onChange={(e) => setField("recipient_phone", e.target.value)} />
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold">מה לכלול בסיכום</p>
                <div className="flex flex-wrap gap-2">
                  <Toggle checked={current.include_activities} onChange={(v) => setField("include_activities", v)} label="פעילויות" />
                  <Toggle checked={current.include_meals} onChange={(v) => setField("include_meals", v)} label="ארוחות" />
                  <Toggle checked={current.include_coffee_corner} onChange={(v) => setField("include_coffee_corner", v)} label="פינות קפה" />
                  <Toggle checked={current.include_prisa} onChange={(v) => setField("include_prisa", v)} label="פריסה" />
                  <Toggle checked={current.include_incidents} onChange={(v) => setField("include_incidents", v)} label="אירועים" />
                </div>
                {editing && <p className="text-[11px] text-slate-400">שינויי הכללה נשמרים עם "שמור טיוטה"</p>}
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <IncidentEditor groupId={groupId} reportId={report.id} incidents={incidents} onChanged={invalidate} />
              </div>
            </div>

            {/* Preview side */}
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5 text-slate-600"><Eye className="w-4 h-4" /> תצוגה מקדימה ללקוח</p>
              <div className="border border-border rounded-xl overflow-hidden">
                <ReportPreview
                  group={group} report={current} participantCount={participantCount}
                  activities={activities} meals={meals} coffee={coffee} prisa={prisa}
                  visibleIncidents={visibleIncidents}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGate>
  );
}