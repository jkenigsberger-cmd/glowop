/**
 * NewIssueModal — mobile-first issue creation with camera capture.
 */
import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Camera, ImagePlus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import MaintenanceSpaceBlockFields from "./MaintenanceSpaceBlockFields";

const CATEGORIES = ["חשמל", "אינסטלציה", "מזגן", "שירותים", "מקלחת", "דלת / חלון", "תאורה", "בטיחות", "אחר"];

const PRIORITIES = [
  { value: "LOW",    label: "נמוכה",  color: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "MEDIUM", label: "בינונית", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "HIGH",   label: "גבוהה",  color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "URGENT", label: "דחוף",   color: "bg-red-50 text-red-700 border-red-200" },
];

// Default category based on location type
const DEFAULT_CATEGORY = {
  BATHROOM:    "שירותים",
  VIP_BATHROOM: "שירותים",
  SHOWER:      "מקלחת",
  VIP_SHOWER:  "מקלחת",
};

export default function NewIssueModal({ location, user, onClose, onCreated, canManageBlocks = false }) {
  const defaultCat = DEFAULT_CATEGORY[location.location_type] || "";
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const canBlockSpace = canManageBlocks && location.source_entity_type === "ACTIVITY_SPACE" && !!location.source_entity_id;
  const qc = useQueryClient();

  const [form, setForm] = useState({
    title: "", description: "", category: defaultCat, priority: "MEDIUM",
    can_block_space: canBlockSpace, block_space: false, block_open_ended: true,
    block_start_date: localDate, block_start_time: localTime, block_end_date: localDate, block_end_time: "18:00",
  });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [blockConflicts, setBlockConflicts] = useState(null);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    setUploadError(false);
    const urls = [];
    let failed = false;
    for (const file of files) {
      try {
        const res = await base44.integrations.Core.UploadFile({ file });
        urls.push(res.file_url);
      } catch {
        failed = true;
      }
    }
    if (urls.length) setPhotos(prev => [...prev, ...urls]);
    if (failed) setUploadError(true);
    setUploading(false);
  };

  const getTitle = () => {
    const t = form.title.trim();
    if (t) return t;
    if (form.category) return `${form.category} - ${location.display_name}`;
    return location.display_name;
  };

  const buildBlock = issueId => ({
    activity_space_id: location.source_entity_id,
    start_date: form.block_start_date,
    start_time: form.block_start_time,
    end_date: form.block_open_ended ? null : form.block_end_date,
    end_time: form.block_open_ended ? null : form.block_end_time,
    is_open_ended: form.block_open_ended,
    reason_type: "REPAIR",
    reason_notes: form.description.trim() || getTitle(),
    created_from_maintenance_issue_id: issueId || null,
  });

  const handleSubmit = async (e, confirmConflicts = false) => {
    e?.preventDefault();
    if (!form.category) { setError("יש לבחור קטגוריה"); return; }
    setSaving(true); setError(null);
    try {
      if (form.block_space && !confirmConflicts) {
        const preview = await base44.functions.invoke("manageActivitySpaceBlock", { action: "preview", block: buildBlock(null) });
        if (preview.data?.conflicts?.length) { setBlockConflicts(preview.data.conflicts); setSaving(false); return; }
      }
      const reportingUser = user?.id ? user : await base44.auth.me();
      const issue = await base44.entities.MaintenanceIssue.create({
        title: getTitle(), description: form.description.trim() || null, category: form.category,
        priority: form.priority, status: "OPEN", site_location_id: location.id,
        activity_space_id: canBlockSpace ? location.source_entity_id : null,
        location_type: location.location_type, location_name: location.display_name,
        location_section: location.section || null, reported_by_user_id: reportingUser.id,
        reported_by_name: reportingUser.full_name || reportingUser.email,
        photo_urls: photos.length ? JSON.stringify(photos) : null,
      });
      if (form.block_space) {
        await base44.functions.invoke("manageActivitySpaceBlock", { action: "save", block: buildBlock(issue.id), confirm_conflicts: confirmConflicts });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["activity-space-blocks"] }),
          qc.invalidateQueries({ queryKey: ["activity-space-blocks-active"] }),
        ]);
      }
      setBlockConflicts(null); onCreated();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "שגיאה בשמירת התקלה");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[95vh]">

        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-white rounded-t-2xl z-10 shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-base leading-tight">פתח תקלה חדשה</h2>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{location.display_name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* PART A — Camera-first photo section */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">תמונה</label>

            {/* Camera button — opens camera directly on mobile */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={e => handleFiles(Array.from(e.target.files))}
              disabled={uploading}
            />
            {/* Gallery fallback */}
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleFiles(Array.from(e.target.files))}
              disabled={uploading}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary font-semibold text-sm active:bg-primary/10 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                <span className="text-xs">{uploading ? "מעלה..." : "צלם תמונה"}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-500 font-semibold text-sm active:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-xs">בחר מהגלריה</span>
              </button>
            </div>

            {uploadError && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                התמונה לא עלתה, ניתן לפתוח תקלה בלי תמונה
              </p>
            )}

            {photos.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {photos.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-16 h-16 object-cover rounded-xl border border-border" />
                    <button
                      type="button"
                      onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Title — optional, auto-generated */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
              כותרת <span className="normal-case font-normal text-slate-400">(אופציונלי — יווצר אוטומטית)</span>
            </label>
            <input
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder={form.category ? `${form.category} - ${location.display_name}` : `תיאור קצר...`}
            />
          </div>

          {/* Category chips */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">קטגוריה *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => set("category", cat)}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors min-h-[40px]
                    ${form.category === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Priority quick buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">דחיפות</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set("priority", p.value)}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-colors min-h-[44px]
                    ${form.priority === p.value
                      ? p.value === "URGENT"
                        ? "bg-red-500 text-white border-red-500"
                        : `${p.color} ring-2 ring-offset-1 ring-primary/40`
                      : `${p.color} opacity-60`
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <MaintenanceSpaceBlockFields form={form} set={set} />

          {/* Description — optional */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
              תיאור <span className="normal-case font-normal text-slate-400">(אופציונלי)</span>
            </label>
            <textarea
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="פרטים נוספים על התקלה..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </p>
          )}
          {blockConflicts && <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2 text-sm"><p className="font-bold text-red-700">קיימות פעילויות קיימות בטווח החסימה</p><p className="text-xs text-red-600">נמצאו {blockConflicts.length} התנגשויות ב-30 הימים הקרובים. הפעילויות לא יימחקו ולא יוזזו.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setBlockConflicts(null)}>חזור</Button><Button type="button" onClick={event => handleSubmit(event, true)}>צור תקלה וחסימה בכל זאת</Button></div></div>}

          {/* Spacer so content isn't hidden behind sticky button */}
          <div className="h-2" />
        </form>

        {/* Sticky submit button */}
        <div className="shrink-0 px-4 pb-4 pt-3 border-t border-border bg-white">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="w-full bg-primary text-primary-foreground font-bold text-base rounded-xl py-4 min-h-[52px] flex items-center justify-center gap-2 disabled:opacity-60 active:opacity-80 transition-opacity"
          >
            {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> שומר...</> : "פתח תקלה"}
          </button>
        </div>
      </div>
    </div>
  );
}