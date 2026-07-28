import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOGISTICS_DEFAULTS } from "@/components/schedule/LogisticsFields";
import StandaloneSpaceRow from "./StandaloneSpaceRow";
import { Plus, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";

const emptyAssignment = () => ({ activity_space_id: "", setup_layout: "", notes: "", ...LOGISTICS_DEFAULTS });
const TYPE_LABELS = { WORKSHOP: "סדנה", LECTURE: "הרצאה", MEETING: "פגישה", EVENT: "אירוע", OTHER: "אחר" };

export default function StandaloneActivityModal({ reservation, assignments = [], spaces, canEdit, canDelete, onChanged, onClose }) {
  const [form, setForm] = useState({ title: reservation?.title || "", activity_type: reservation?.activity_type || "OTHER", description: reservation?.description || "", event_date: reservation?.event_date || "", start_time: reservation?.start_time || "", end_time: reservation?.end_time || "", expected_pax: reservation?.expected_pax ?? "", organizer_name: reservation?.organizer_name || "", organizer_phone: reservation?.organizer_phone || "", organizer_email: reservation?.organizer_email || "", general_notes: reservation?.general_notes || "", preparation_notes: reservation?.preparation_notes || "", during_activity_notes: reservation?.during_activity_notes || "", cleanup_notes: reservation?.cleanup_notes || "" });
  const [rows, setRows] = useState(assignments.length ? assignments.map((row) => ({ ...emptyAssignment(), ...row })) : [emptyAssignment()]);
  const [creationToken] = useState(() => reservation?.creation_token || crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateRow = (index, patch) => setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));

  const save = async () => {
    setError("");
    if (!form.title.trim() || !form.event_date || !form.start_time || !form.end_time) return setError("יש למלא שם, תאריך ושעות");
    if (form.start_time >= form.end_time) return setError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
    if (Number(form.expected_pax || 0) < 0) return setError("מספר המשתתפים אינו תקין");
    if (!rows.length || rows.some((row) => !row.activity_space_id)) return setError("יש לבחור לפחות מרחב אחד");
    setSaving(true);
    try {
      const response = await base44.functions.invoke("saveStandaloneActivityReservation", { ...form, id: reservation?.id, expected_pax: Number(form.expected_pax || 0), creation_token: creationToken, assignments: rows });
      if (response.data.calendar_sync_status === "FAILED") toast.warning("הפעילות נשמרה, אך הסנכרון ליומן נכשל");
      else if (response.data.calendar_sync_status === "NOT_CONFIGURED") toast.warning("הפעילות נשמרה, אך היומן אינו מוגדר");
      else toast.success("הפעילות נשמרה בהצלחה");
      await onChanged();
      onClose();
    } catch (caught) {
      const data = caught?.response?.data || {};
      setError(data.error === "SPACE_CONFLICT" ? `המרחב כבר תפוס בשעה שנבחרה${data.conflicting_title ? ` — ${data.conflicting_title} (${data.start_time}–${data.end_time})` : ""}` : data.error === "ACTIVITY_ALREADY_CANCELLED" ? "לא ניתן לערוך פעילות שבוטלה" : "שמירת הפעילות נכשלה");
    } finally { setSaving(false); }
  };

  const cancelReservation = async () => {
    const reason = window.prompt("סיבת ביטול (אופציונלי)", "");
    if (reason === null) return;
    setSaving(true);
    try {
      const response = await base44.functions.invoke("cancelStandaloneActivityReservation", { id: reservation.id, reason });
      await onChanged();
      if (response.data.calendar_sync_status === "FAILED") toast.warning("הפעילות בוטלה, אך הסנכרון ליומן נכשל");
      else toast.success(response.data.already_cancelled ? "הפעילות כבר בוטלה" : "הפעילות בוטלה");
      onClose();
    } finally { setSaving(false); }
  };
  const deleteReservation = async () => {
    if (!window.confirm("למחוק את הפעילות לצמיתות?")) return;
    setSaving(true);
    try {
      const response = await base44.functions.invoke("deleteStandaloneActivityReservation", { id: reservation.id });
      await onChanged();
      if (response.data.calendar_sync_status === "FAILED") toast.warning("הפעילות נמחקה, אך מחיקת האירוע מהיומן נכשלה");
      onClose();
    } finally { setSaving(false); }
  };

  return <Dialog open onOpenChange={onClose}><DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl"><DialogHeader><DialogTitle>{reservation ? "פרטי פעילות כללית" : "פעילות כללית ללא קבוצה"}</DialogTitle></DialogHeader>
    {reservation?.status === "CANCELLED" && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">מבוטלת{reservation.cancellation_reason ? ` — ${reservation.cancellation_reason}` : ""}</div>}
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 space-y-1"><Label>שם הפעילות *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
      <div className="space-y-1"><Label>סוג פעילות</Label><Select value={form.activity_type} onValueChange={(v) => set("activity_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>תאריך *</Label><Input type="date" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} /></div>
      <div className="space-y-1"><Label>שעת התחלה *</Label><Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} /></div>
      <div className="space-y-1"><Label>שעת סיום *</Label><Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} /></div>
      <div className="space-y-1"><Label>מספר משתתפים משוער</Label><Input type="number" min="0" value={form.expected_pax} onChange={(e) => set("expected_pax", e.target.value)} /></div>
      <div className="space-y-1"><Label>אחראי / איש קשר</Label><Input value={form.organizer_name} onChange={(e) => set("organizer_name", e.target.value)} /></div>
      <div className="space-y-1"><Label>טלפון</Label><Input value={form.organizer_phone} onChange={(e) => set("organizer_phone", e.target.value)} /></div>
      <div className="space-y-1"><Label>אימייל</Label><Input type="email" value={form.organizer_email} onChange={(e) => set("organizer_email", e.target.value)} /></div>
      <div className="sm:col-span-2 space-y-1"><Label>תיאור</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
    </div>
    <div className="space-y-3"><div className="flex justify-between items-center"><Label>בחירת מרחבים וציוד נדרש *</Label>{canEdit && <Button type="button" size="sm" variant="outline" onClick={() => setRows((current) => [...current, emptyAssignment()])}><Plus className="w-4 h-4" /> הוסף מרחב</Button>}</div>{rows.map((row,index) => <StandaloneSpaceRow key={index} row={row} index={index} spaces={spaces} onChange={(patch) => updateRow(index, patch)} onRemove={() => setRows((current) => current.filter((_,i) => i !== index))} />)}</div>
    <div className="grid sm:grid-cols-2 gap-3"><div className="space-y-1"><Label>הערות להכנה לפני הפעילות</Label><Textarea value={form.preparation_notes} onChange={(e) => set("preparation_notes", e.target.value)} /></div><div className="space-y-1"><Label>הערות במהלך הפעילות</Label><Textarea value={form.during_activity_notes} onChange={(e) => set("during_activity_notes", e.target.value)} /></div><div className="space-y-1"><Label>הערות לסיום וניקיון</Label><Textarea value={form.cleanup_notes} onChange={(e) => set("cleanup_notes", e.target.value)} /></div><div className="space-y-1"><Label>הערות כלליות</Label><Textarea value={form.general_notes} onChange={(e) => set("general_notes", e.target.value)} /></div></div>
    {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
    <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>ביטול</Button>{reservation?.status === "ACTIVE" && canDelete && <Button variant="outline" onClick={cancelReservation} disabled={saving}><Ban className="w-4 h-4" /> ביטול פעילות</Button>}{reservation && canDelete && <Button variant="destructive" onClick={deleteReservation} disabled={saving}><Trash2 className="w-4 h-4" /></Button>}{canEdit && reservation?.status !== "CANCELLED" && <Button onClick={save} disabled={saving}>{saving ? "שומר..." : "שמירה"}</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}