import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useRoleContext } from "@/lib/RoleContext";
import { buildDailyBriefMessage } from "@/lib/dailyBriefMessage";
import AutoSummaryPreview from "./AutoSummaryPreview";
import {
  MessageSquare, RefreshCw, Save, Copy, Send, Loader2, ChevronDown, ChevronUp, Sparkles, CheckCircle2, Trash2
} from "lucide-react";

const EDIT_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

const MANUAL_FIELDS = [
  { key: "manual_general_notes", label: "דגשים כלליים" },
  { key: "manual_logistics_tasks", label: "לוגיסטיקה" },
  { key: "manual_housekeeping_tasks", label: "משק בית" },
  { key: "manual_maintenance_tasks", label: "תחזוקה" },
  { key: "manual_duty_students_notes", label: "תורנים / מדריכים" },
  { key: "manual_meals_notes", label: "ארוחות / חדר אוכל" },
  { key: "manual_activity_spaces_notes", label: "מרחבי פעילות" },
  { key: "manual_final_notes", label: "הערות אחרונות" },
];

const emptyManual = () => Object.fromEntries(MANUAL_FIELDS.map((f) => [f.key, ""]));

const STATUS_LABELS = {
  DRAFT: { label: "טיוטה", cls: "bg-slate-100 text-slate-600" },
  READY: { label: "מוכן", cls: "bg-blue-100 text-blue-700" },
  SENT_MANUALLY: { label: "נשלח ידנית", cls: "bg-emerald-100 text-emerald-700" },
  ARCHIVED: { label: "בארכיון", cls: "bg-slate-100 text-slate-400" },
};

export default function DailyStaffBrief({ selectedDate }) {
  const { role, internalUser } = useRoleContext();
  const { toast } = useToast();
  const canEdit = EDIT_ROLES.has(role);

  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState(null);          // saved DailyStaffBrief record (or null)
  const [manual, setManual] = useState(emptyManual());
  const [summary, setSummary] = useState(null);      // parsed auto_summary_json
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");              // which action is running
  const [includeSummary, setIncludeSummary] = useState(true); // include auto system data in the message

  // Load existing brief for the date (does NOT generate)
  const loadBrief = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await base44.entities.DailyStaffBrief.filter({ date: selectedDate });
      const rec = existing?.[0] || null;
      setBrief(rec);
      if (rec) {
        const m = emptyManual();
        MANUAL_FIELDS.forEach((f) => { m[f.key] = rec[f.key] || ""; });
        setManual(m);
        setStatus(rec.status || "DRAFT");
        setMessage(rec.generated_message || "");
        try { setSummary(rec.auto_summary_json ? JSON.parse(rec.auto_summary_json) : null); }
        catch (_e) { setSummary(null); }
      } else {
        setManual(emptyManual());
        setStatus("DRAFT");
        setMessage("");
        setSummary(null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { if (open) loadBrief(); }, [open, loadBrief]);

  const nowIso = () => new Date().toISOString();
  const saveBrief = async (payload) => {
    const response = await base44.functions.invoke("manageDailyStaffBrief", { action: "save", date: selectedDate, brief_id: brief?.id, payload });
    return response.data.brief;
  };

  // Fetch fresh operational data (read-only backend call)
  const fetchSummary = async () => {
    const res = await base44.functions.invoke("generateDailyBriefData", { date: selectedDate });
    return res?.data?.summary || null;
  };

  // צור תדריך יומי — create if none, generate snapshot, preserve manual fields
  const handleCreate = async () => {
    setBusy("create");
    try {
      const freshSummary = await fetchSummary();
      const jsonStr = freshSummary ? JSON.stringify(freshSummary) : "";
      const rec = await saveBrief({ auto_summary_json: jsonStr, status: brief?.status || "DRAFT", last_generated_at: nowIso() });
      setBrief(rec);
      setSummary(freshSummary);
      toast({ title: "התדריך נוצר", description: "נשלפו נתונים עדכניים מהמערכת." });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  // רענן נתונים מהמערכת — refresh only auto_summary_json, preserve manual + message
  const handleRefresh = async () => {
    if (!brief) return handleCreate();
    setBusy("refresh");
    try {
      const freshSummary = await fetchSummary();
      const jsonStr = freshSummary ? JSON.stringify(freshSummary) : "";
      const rec = await saveBrief({ auto_summary_json: jsonStr, last_generated_at: nowIso() });
      setBrief(rec);
      setSummary(freshSummary);
      toast({ title: "הנתונים רועננו", description: "ההערות הידניות נשמרו ללא שינוי." });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  // שמור טיוטה — save manual fields, status DRAFT
  const handleSaveDraft = async () => {
    setBusy("save");
    try {
      const rec = await saveBrief({ ...manual, status: "DRAFT" });
      setBrief(rec);
      setStatus("DRAFT");
      toast({ title: "הטיוטה נשמרה" });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  // צור הודעת WhatsApp — build message, save, status READY
  const handleGenerateMessage = async () => {
    setBusy("message");
    try {
      const msg = buildDailyBriefMessage(summary, manual, selectedDate, includeSummary);
      setMessage(msg);
      const rec = await saveBrief({ ...manual, generated_message: msg, status: "READY", auto_summary_json: summary ? JSON.stringify(summary) : "" });
      setBrief(rec);
      setStatus("READY");
      toast({ title: "ההודעה נוצרה", description: "ניתן לערוך לפני העתקה." });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  // מחק הודעה — clear generated message, revert to DRAFT
  const handleClearMessage = async () => {
    setBusy("clear");
    try {
      setMessage("");
      if (brief) {
        const rec = await saveBrief({ generated_message: "", status: "DRAFT" });
        setBrief(rec);
      }
      setStatus("DRAFT");
      toast({ title: "ההודעה נמחקה" });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  // העתק הודעה — clipboard + update last_copied_at only
  const handleCopy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "ההודעה הועתקה" });
      if (brief) {
        const rec = await saveBrief({ last_copied_at: nowIso() });
        setBrief(rec);
      }
    } catch (_e) {
      toast({ title: "לא ניתן להעתיק אוטומטית", description: "בחרו את הטקסט והעתיקו ידנית.", variant: "destructive" });
    }
  };

  // סמן כנשלח ידנית — status only
  const handleMarkSent = async () => {
    if (!brief) return;
    setBusy("sent");
    try {
      const rec = await saveBrief({ status: "SENT_MANUALLY" });
      setBrief(rec);
      setStatus("SENT_MANUALLY");
      toast({ title: "סומן כנשלח ידנית" });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  if (!canEdit) return null;

  const st = STATUS_LABELS[status] || STATUS_LABELS.DRAFT;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" dir="rtl">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-bold text-base">תדריך יומי לצוות</span>
          <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5 border-t border-slate-100 pt-4">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : (
            <>
              {/* Action bar */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleCreate} disabled={!!busy} className="gap-1.5">
                  {busy === "create" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  צור תדריך יומי
                </Button>
                <Button size="sm" variant="outline" onClick={handleRefresh} disabled={!!busy} className="gap-1.5">
                  {busy === "refresh" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  רענן נתונים מהמערכת
                </Button>
                <Button size="sm" variant="outline" onClick={handleSaveDraft} disabled={!!busy} className="gap-1.5">
                  {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  שמור טיוטה
                </Button>
              </div>

              {/* 1. Auto summary */}
              <section className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-bold text-slate-700 mb-3">מידע מהמערכת</h3>
                <AutoSummaryPreview summary={summary} />
              </section>

              {/* 2. Manual tasks */}
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">משימות ידניות</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {MANUAL_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">{f.label}</label>
                      <Textarea
                        rows={3}
                        value={manual[f.key]}
                        onChange={(e) => setManual((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder="הקלד שורה לכל משימה..."
                        className="text-sm resize-y"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. WhatsApp message */}
              <section className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer w-fit">
                  <Switch checked={includeSummary} onCheckedChange={setIncludeSummary} />
                  כלול את המידע מהמערכת (התדריך היומי) בהודעה
                </label>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-700">הודעת WhatsApp</h3>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleGenerateMessage} disabled={!!busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      {busy === "message" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                      צור הודעת WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCopy} disabled={!message} className="gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> העתק הודעה
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleClearMessage} disabled={!message || !!busy} className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50">
                      {busy === "clear" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      מחק הודעה
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleMarkSent} disabled={!brief || !!busy} className="gap-1.5">
                      {busy === "sent" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      סמן כנשלח ידנית
                    </Button>
                  </div>
                </div>
                <Textarea
                  rows={12}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder='לחצו "צור הודעת WhatsApp" כדי לבנות הודעה מוכנה להעתקה.'
                  className="text-sm font-mono leading-relaxed whitespace-pre-wrap"
                />
                {status === "SENT_MANUALLY" && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> סומן כנשלח ידנית</p>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}