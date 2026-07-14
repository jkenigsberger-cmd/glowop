import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WORKER_TEAMS } from "@/lib/workScheduleConfig";

const normalize = (value) => value.trim().toLowerCase();
export default function WorkerFormDialog({ worker, onSave, onClose }) {
  const [form, setForm] = useState({ full_name: worker?.full_name || "", phone: worker?.phone || "", email: worker?.email || worker?.internal_user_email || "", default_team: worker?.default_team || "OTHER", notes: worker?.notes || "", is_active: worker?.is_active !== false });
  const [linkedUser, setLinkedUser] = useState(worker?.linked_user ? { id: worker.linked_user.id, name: worker.linked_user.name, email: worker.linked_user.email, role: worker.linked_user.role } : null);
  const [foundUser, setFoundUser] = useState(null); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); if (key === "email") { setFoundUser(null); if (linkedUser && normalize(value) !== normalize(linkedUser.email || "")) setLinkedUser(null); } };
  const search = async () => { setMessage(""); const res = await base44.functions.invoke("manageWorkerProfiles", { action: "search_user", email: normalize(form.email) }); setFoundUser(res.data.user); if (!res.data.user) setMessage("לא נמצא משתמש מערכת עם האימייל הזה"); };
  const submit = async (event) => { event.preventDefault(); if (!form.full_name.trim()) return setMessage("שם מלא הוא שדה חובה"); setSaving(true); try { await onSave({ ...form, email: normalize(form.email), internal_user_id: linkedUser?.id || "" }); } catch (error) { setMessage(error.response?.data?.error || error.message || "שגיאה בשמירה"); setSaving(false); } };
  return <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg" dir="rtl"><DialogHeader><DialogTitle>{worker ? "עריכת עובד" : "עובד חדש"}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-3">
    <div><Label>שם מלא *</Label><Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><Label>טלפון</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div><div><Label>צוות / תפקיד</Label><Select value={form.default_team} onValueChange={(value) => set("default_team", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WORKER_TEAMS.map((team) => <SelectItem key={team.id} value={team.id}>{team.label}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="space-y-2"><Label>אימייל</Label><div className="flex gap-2"><Input dir="ltr" value={form.email} onChange={(e) => set("email", e.target.value)} /><Button type="button" variant="outline" onClick={search}>חפש משתמש מערכת</Button></div>
      {foundUser && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><p>נמצא משתמש מערכת: <b>{foundUser.name}</b> · {foundUser.email} · {foundUser.role}</p><Button type="button" size="sm" className="mt-2" onClick={() => { setLinkedUser(foundUser); setFoundUser(null); setMessage(""); }}>קשר משתמש</Button></div>}
      {linkedUser && <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm"><span>מקושר: {linkedUser.name || linkedUser.email}</span><Button type="button" size="sm" variant="ghost" onClick={() => setLinkedUser(null)}>הסר קישור</Button></div>}
    </div><div><Label>הערות</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} /> פעיל</label>
    {message && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{message}</p>}<div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "שומר..." : "שמירה"}</Button><Button type="button" variant="outline" onClick={onClose}>ביטול</Button></div>
  </form></DialogContent></Dialog>;
}