import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SpaceBlockForm from "./SpaceBlockForm";
import SpaceBlockList from "./SpaceBlockList";

export default function ActivitySpaceBlocksPanel({ spaces, blocks, role }) {
  const queryClient = useQueryClient();
  const canManage = ["SUPER_ADMIN", "ADMIN"].includes(role);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const [error, setError] = useState("");
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["activity-space-blocks"] }),
      queryClient.invalidateQueries({ queryKey: ["activity-space-blocks-active"] }),
    ]);
  };
  const invoke = async payload => (await base44.functions.invoke("manageActivitySpaceBlock", payload)).data;
  const errorMessage = err => err?.response?.data?.error || err?.message || "שגיאה בשמירת החסימה";
  const save = async form => {
    setSaving(true);
    setError("");
    try {
      const preview = await invoke({ action: "preview", block: form });
      if (preview.conflicts?.length) setConflicts({ rows: preview.conflicts, pending: { form, id: editing?.id } });
      else { await invoke({ action: "save", id: editing?.id, block: form }); setEditing(null); await refresh(); }
    } catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };
  const confirmSave = async () => {
    setSaving(true); setError("");
    try { await invoke({ action: "save", id: conflicts.pending.id, block: conflicts.pending.form, confirm_conflicts: true }); setConflicts(null); setEditing(null); await refresh(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };
  const cancel = async block => {
    if (!window.confirm("לשחרר את החסימה? ההיסטוריה תישמר.")) return;
    const resolutionNotes = window.prompt("סיבת שחרור / הערת סיום", "") || "";
    setError("");
    try { await invoke({ action: "cancel", id: block.id, resolution_notes: resolutionNotes }); await refresh(); }
    catch (err) { setError(errorMessage(err)); }
  };
  const showConflicts = async block => {
    setError("");
    try { const result = await invoke({ action: "list_conflicts", block }); setConflicts({ rows: result.conflicts || [] }); }
    catch (err) { setError(errorMessage(err)); }
  };
  return <div className="space-y-4" dir="rtl">
    <div className="flex justify-between items-center"><div><h2 className="font-semibold">ניהול חסימות מרחבים</h2><p className="text-xs text-slate-500">חסימות פיזיות זמניות שאינן פעילויות קבוצה</p></div>{canManage && !editing && <Button onClick={() => { setError(""); setEditing({}); }}><Plus className="w-4 h-4" /> חסום מרחב</Button>}</div>
    {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {editing && <SpaceBlockForm spaces={spaces} initial={editing.id ? editing : null} saving={saving} onSubmit={save} onClose={() => setEditing(null)} />}
    <SpaceBlockList blocks={blocks} canManage={canManage} onEdit={setEditing} onCancel={cancel} onConflicts={showConflicts} />
    {conflicts && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-xl max-w-2xl w-full p-5 space-y-4 max-h-[80vh] overflow-auto"><h3 className="font-semibold flex gap-2"><AlertTriangle className="text-red-500" /> קיימות פעילויות קיימות בטווח החסימה</h3>{conflicts.rows.length === 0 ? <p className="text-sm text-slate-500">אין התנגשויות פעילות כרגע</p> : conflicts.rows.map((row, i) => <div key={i} className="text-sm border rounded-lg p-3"><b>{row.group_name}</b> · {row.activity_name}<br/><span className="text-slate-500">{row.date} · {row.start_time}–{row.end_time} · {row.space_name}</span>{row.group_schedule_item_id && <p className="text-xs text-slate-400">GroupScheduleItem: {row.group_schedule_item_id}</p>}{row.common_space_booking_request_id && <p className="text-xs text-slate-400">Request: {row.common_space_booking_request_id}</p>}{row.calendar_sync_id && <p className="text-xs text-slate-400">CalendarSync: {row.calendar_sync_id}</p>}</div>)}<div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setConflicts(null)}>חזור</Button>{conflicts.pending && <Button disabled={saving} onClick={confirmSave}>צור חסימה בכל זאת</Button>}</div></div></div>}
  </div>;
}