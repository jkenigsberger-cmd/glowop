/**
 * NewIssueModal — modal to create a new MaintenanceIssue for a SiteLocation.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["חשמל", "אינסטלציה", "מזגן", "מיטה", "דלת / חלון", "שירותים", "מקלחת", "מקרר", "תאורה", "ציוד שבור", "בטיחות", "אחר"];

const PRIORITIES = [
  { value: "LOW",    label: "נמוכה" },
  { value: "MEDIUM", label: "בינונית" },
  { value: "HIGH",   label: "גבוהה" },
  { value: "URGENT", label: "דחוף" },
];

export default function NewIssueModal({ location, user, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    priority: "MEDIUM",
    internal_notes: "",
  });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const res = await base44.integrations.Core.UploadFile({ file });
      urls.push(res.file_url);
    }
    setPhotos(prev => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("יש להזין כותרת"); return; }
    if (!form.category) { setError("יש לבחור קטגוריה"); return; }
    setSaving(true);
    setError(null);
    await base44.entities.MaintenanceIssue.create({
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      priority: form.priority,
      status: "OPEN",
      site_location_id: location.id,
      location_type: location.location_type,
      location_name: location.display_name,
      location_section: location.section || null,
      reported_by_user_id: user.id,
      reported_by_name: user.full_name || user.email,
      photo_urls: photos.length ? JSON.stringify(photos) : null,
      internal_notes: form.internal_notes.trim() || null,
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" dir="rtl">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-bold text-base">פתח תקלה חדשה</h2>
          <div className="text-xs text-muted-foreground text-left flex-1 mr-3 truncate">{location.display_name}</div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">כותרת *</label>
            <input
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="תיאור קצר של התקלה..."
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">קטגוריה *</label>
              <select
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={form.category}
                onChange={e => set("category", e.target.value)}
              >
                <option value="">-- בחר --</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">דחיפות</label>
              <select
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={form.priority}
                onChange={e => set("priority", e.target.value)}
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">תיאור התקלה</label>
            <textarea
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="פרטים נוספים..."
            />
          </div>

          {/* Photos */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">תמונות (אופציונלי)</label>
            <label className="flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
              <Upload className="w-4 h-4" />
              {uploading ? "מעלה..." : "העלה תמונה"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} disabled={uploading} />
            </label>
            {photos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {photos.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-border" />
                    <button
                      type="button"
                      onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Internal notes */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">הערות פנימיות (אופציונלי)</label>
            <textarea
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={form.internal_notes}
              onChange={e => set("internal_notes", e.target.value)}
              placeholder="הערות לצוות..."
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving || uploading} className="flex-1">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> שומר...</> : "פתח תקלה"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </form>
      </div>
    </div>
  );
}