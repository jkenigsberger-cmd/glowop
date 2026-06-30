import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, X, Eye, EyeOff, Upload, Trash2, AlertTriangle, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_LOCATION_TYPE_LABELS,
  parsePhotoUrls,
} from "@/lib/postStayLabels";

const EMPTY_FORM = () => ({
  category: "OTHER",
  severity: "LOW",
  date: "",
  location_type: "TENT",
  location_name: "",
  title: "",
  description: "",
  client_visible: false,
  photo_urls: [],
});

export default function IncidentEditor({ groupId, reportId, incidents, onChanged }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM());
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (inc) => {
    setEditingId(inc.id);
    setForm({
      category: inc.category || "OTHER",
      severity: inc.severity || "LOW",
      date: inc.date || "",
      location_type: inc.location_type || "TENT",
      location_name: inc.location_name || "",
      title: inc.title || "",
      description: inc.description || "",
      client_visible: !!inc.client_visible,
      photo_urls: parsePhotoUrls(inc.photo_urls),
    });
    setError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setError(null);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, photo_urls: [...f.photo_urls, file_url] }));
    } catch (err) {
      toast.error("העלאת התמונה נכשלה");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (url) => {
    setForm((f) => ({ ...f, photo_urls: f.photo_urls.filter((u) => u !== url) }));
  };

  const handleSave = async () => {
    if (!form.category) { setError("יש לבחור קטגוריה"); return; }
    if (!form.description && !form.title) { setError("יש למלא כותרת או תיאור"); return; }
    setSaving(true);
    const payload = {
      group_id: groupId,
      post_stay_report_id: reportId,
      date: form.date || null,
      location_type: form.location_type,
      location_name: form.location_name || null,
      category: form.category,
      severity: form.severity,
      title: form.title || null,
      description: form.description || null,
      photo_urls: JSON.stringify(form.photo_urls),
      client_visible: form.client_visible,
      status: "ACTIVE",
      source_type: "MANUAL",
    };
    try {
      if (editingId) {
        await base44.entities.PostStayIncident.update(editingId, payload);
        toast.success("האירוע עודכן");
      } else {
        await base44.entities.PostStayIncident.create(payload);
        toast.success("האירוע נוסף");
      }
      closeForm();
      onChanged?.();
    } catch (err) {
      setError("שמירת האירוע נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (inc) => {
    if (!window.confirm("למחוק אירוע זה?")) return;
    await base44.entities.PostStayIncident.delete(inc.id);
    toast.success("האירוע נמחק");
    onChanged?.();
  };

  const toggleVisible = async (inc) => {
    await base44.entities.PostStayIncident.update(inc.id, { client_visible: !inc.client_visible });
    onChanged?.();
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600" /> אירועים / נזקים
        </h4>
        <Button size="sm" variant="outline" onClick={formOpen ? closeForm : openAdd} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> הוסף אירוע
        </Button>
      </div>

      {formOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-800">{editingId ? "עריכת אירוע" : "אירוע חדש"}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">קטגוריה *</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INCIDENT_CATEGORY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">חומרה</label>
              <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INCIDENT_SEVERITY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">סוג מיקום</label>
              <Select value={form.location_type} onValueChange={(v) => setForm((f) => ({ ...f, location_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INCIDENT_LOCATION_TYPE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">שם מיקום</label>
              <Input value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} placeholder="לדוגמה: אוהל 84" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">תאריך</label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">כותרת</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="כותרת קצרה" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs text-slate-500">תיאור</label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="תיאור האירוע..." rows={2} />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <label className="text-xs text-slate-500">תמונות</label>
            <div className="flex flex-wrap gap-2">
              {form.photo_urls.map((url) => (
                <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(url)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 text-slate-400">
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <><Upload className="w-4 h-4" /><span className="text-[10px]">העלה</span></>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          {/* Client visible toggle */}
          <button
            onClick={() => setForm((f) => ({ ...f, client_visible: !f.client_visible }))}
            className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border w-full ${
              form.client_visible ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"
            }`}
          >
            {form.client_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {form.client_visible ? "גלוי ללקוח — יופיע בתצוגה ובייצוא" : "פנימי בלבד — לא יופיע ללקוח"}
          </button>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={closeForm}>ביטול</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? "שומר..." : editingId ? "עדכן" : "הוסף"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {incidents.length === 0 && !formOpen ? (
        <p className="text-sm text-muted-foreground text-center py-5 border-2 border-dashed border-amber-100 rounded-xl">
          אין אירועים — ניתן להוסיף ידנית
        </p>
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => {
            const photos = parsePhotoUrls(inc.photo_urls);
            return (
              <div key={inc.id} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">
                        {INCIDENT_CATEGORY_LABELS[inc.category] || inc.category}
                      </span>
                      <span className="text-xs text-slate-400">חומרה: {INCIDENT_SEVERITY_LABELS[inc.severity] || inc.severity}</span>
                      {inc.location_name && (
                        <span className="text-xs text-slate-500">
                          · {INCIDENT_LOCATION_TYPE_LABELS[inc.location_type] || ""} {inc.location_name}
                        </span>
                      )}
                    </div>
                    {inc.title && <p className="text-sm font-medium text-slate-800">{inc.title}</p>}
                    {inc.description && <p className="text-sm text-slate-600">{inc.description}</p>}
                    {photos.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <ImageIcon className="w-3 h-3" /> {photos.length} תמונות
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={() => toggleVisible(inc)}
                      title={inc.client_visible ? "גלוי ללקוח" : "פנימי בלבד"}
                      className={`flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border ${
                        inc.client_visible ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {inc.client_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {inc.client_visible ? "ללקוח" : "פנימי"}
                    </button>
                    <div className="flex gap-0.5">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(inc)} className="h-7 w-7 p-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(inc)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}