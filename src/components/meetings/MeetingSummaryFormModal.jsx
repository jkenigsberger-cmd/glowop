import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  buildSearchText, parseTags, OPERATIONAL_AREAS, STATUS_LABELS, VISIBILITY_LABELS,
} from "@/lib/meetingSummaryUtils";

const EMPTY = {
  title: "",
  meeting_date: "",
  relevant_week_start: "",
  participants_text: "",
  meeting_summary_text: "",
  original_transcript_optional: "",
  topics_tags: "",
  mentioned_people_text: "",
  mentioned_groups_text: "",
  mentioned_locations_text: "",
  related_group_ids: "",
  related_event_ids: "",
  internal_notes: "",
  status: "DRAFT",
  visibility: "PRIVATE_OPERATIONS",
};

// Field wrapper
function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

export default function MeetingSummaryFormModal({ open, onClose, record, currentUserEmail, onSaved }) {
  const isEdit = !!record?.id;
  const initialTags = record ? parseTags(record.topics_tags) : [];

  const [form, setForm] = useState(() =>
    record ? { ...EMPTY, ...record, topics_tags: undefined } : { ...EMPTY }
  );
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [showTranscript, setShowTranscript] = useState(!!record?.original_transcript_optional);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addTag = (raw) => {
    const t = (raw ?? tagInput).trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };
  const removeTag = (t) => setTags((prev) => prev.filter((x) => x !== t));

  const handleSave = async () => {
    if (!form.title.trim()) { setError("יש להזין כותרת לפגישה"); return; }
    setError("");
    setSaving(true);
    try {
      const topics_tags = JSON.stringify(tags);
      const payload = {
        ...form,
        topics_tags,
        search_text: buildSearchText({ ...form, topics_tags }),
      };
      if (isEdit) {
        await base44.entities.MeetingSummary.update(record.id, payload);
      } else {
        await base44.entities.MeetingSummary.create({ ...payload, created_by: currentUserEmail || "" });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError("שמירת הסיכום נכשלה. נסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת סיכום פגישה" : "סיכום פגישה חדש"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. פרטי פגישה */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-primary">פרטי פגישה</h3>
            <Field label="כותרת">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="למשל: פגישת תפעול שבועית" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="תאריך פגישה">
                <Input type="date" value={form.meeting_date || ""} onChange={(e) => set("meeting_date", e.target.value)} />
              </Field>
              <Field label="שבוע רלוונטי (יום ראשון)">
                <Input type="date" value={form.relevant_week_start || ""} onChange={(e) => set("relevant_week_start", e.target.value)} />
              </Field>
            </div>
            <Field label="משתתפים">
              <Input value={form.participants_text || ""} onChange={(e) => set("participants_text", e.target.value)} placeholder="שמות המשתתפים, מופרדים בפסיקים" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="סטטוס">
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="הרשאת צפייה">
                <Select value={form.visibility} onValueChange={(v) => set("visibility", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VISIBILITY_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          {/* 2. סיכום פגישה */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-primary">סיכום פגישה</h3>
            <Field label="הדבק כאן את סיכום ה-AI מהפגישה">
              <Textarea
                value={form.meeting_summary_text || ""}
                onChange={(e) => set("meeting_summary_text", e.target.value)}
                rows={12}
                className="font-mono text-sm leading-relaxed"
                placeholder="הדבק את הסיכום שהתקבל מכלי ה-AI..."
              />
            </Field>
          </section>

          {/* 3. חומר גלם אופציונלי */}
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-bold text-primary"
            >
              {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              חומר גלם אופציונלי (Transcript מקורי)
            </button>
            {showTranscript && (
              <Textarea
                value={form.original_transcript_optional || ""}
                onChange={(e) => set("original_transcript_optional", e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="תמלול מקורי / חומר גלם..."
              />
            )}
          </section>

          {/* 4. מטא דאטה לחיפוש */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-primary">מטא דאטה לחיפוש</h3>
            <Field label="נושאים / תגיות">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="hover:text-red-500">✕</button>
                  </span>
                ))}
              </div>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="הקלד נושא ולחץ Enter"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {OPERATIONAL_AREAS.filter((a) => !tags.includes(a)).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => addTag(a)}
                    className="text-xs text-slate-500 border border-slate-200 rounded-full px-2 py-0.5 hover:bg-slate-50"
                  >
                    + {a}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="אנשים שהוזכרו">
              <Input value={form.mentioned_people_text || ""} onChange={(e) => set("mentioned_people_text", e.target.value)} />
            </Field>
            <Field label="קבוצות שהוזכרו">
              <Input value={form.mentioned_groups_text || ""} onChange={(e) => set("mentioned_groups_text", e.target.value)} />
            </Field>
            <Field label="מיקומים שהוזכרו">
              <Input value={form.mentioned_locations_text || ""} onChange={(e) => set("mentioned_locations_text", e.target.value)} />
            </Field>
            <Field label="הערות פנימיות">
              <Textarea value={form.internal_notes || ""} onChange={(e) => set("internal_notes", e.target.value)} rows={3} />
            </Field>
          </section>

          {/* 5. קישורים ידניים */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-primary">קישורים ידניים (אופציונלי)</h3>
            <Field label="מזהי קבוצות מקושרות (Group UUIDs, מופרדים בפסיקים)">
              <Input value={form.related_group_ids || ""} onChange={(e) => set("related_group_ids", e.target.value)} placeholder="לא חובה" />
            </Field>
            <Field label="מזהי אירועים מקושרים (מופרדים בפסיקים)">
              <Input value={form.related_event_ids || ""} onChange={(e) => set("related_event_ids", e.target.value)} placeholder="לא חובה" />
            </Field>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}