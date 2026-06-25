/**
 * LocationManagerPanel — admin-only panel to add/edit/deactivate SiteLocation records.
 * Used inside Maintenance page for manual bathrooms, showers, VIP sub-locations, etc.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, EyeOff, Eye, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOCATION_TYPE_LABELS = {
  NEIGHBORHOOD_TENT: "אוהל שכונה",
  BATHROOM: "שירותים",
  SHOWER: "מקלחת",
  VIP_TENT: "אוהל VIP",
  VIP_BATHROOM: "שירותים VIP",
  VIP_SHOWER: "מקלחת VIP",
  COMMON_SPACE: "מרחב משותף",
  OTHER: "אחר",
};

const MANUAL_TYPES = ["BATHROOM", "SHOWER", "VIP_TENT", "VIP_BATHROOM", "VIP_SHOWER", "OTHER"];

const EMPTY_FORM = {
  display_name: "",
  location_type: "BATHROOM",
  section: "",
  location_number: "",
  sort_order: "",
  notes: "",
};

function LocationForm({ initial, vipTents, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.display_name.trim()) { setError("שם תצוגה חובה"); return; }
    setSaving(true);
    setError(null);
    const data = {
      display_name: form.display_name.trim(),
      location_type: form.location_type,
      source_entity_type: "MANUAL",
      section: form.section.trim() || null,
      location_number: form.location_number ? Number(form.location_number) : null,
      sort_order: form.sort_order ? Number(form.sort_order) : 0,
      notes: form.notes.trim() || null,
      is_active: true,
    };
    // Set parent_location_id for VIP sub-types
    if ((form.location_type === "VIP_BATHROOM" || form.location_type === "VIP_SHOWER") && form.parent_location_id) {
      data.parent_location_id = form.parent_location_id;
    }
    await onSave(data);
    setSaving(false);
  };

  const isVipSub = form.location_type === "VIP_BATHROOM" || form.location_type === "VIP_SHOWER";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 block mb-1">שם תצוגה *</label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={form.display_name}
            onChange={e => set("display_name", e.target.value)}
            placeholder="לדוגמה: שירותים 3, מקלחת 2..."
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">סוג מיקום *</label>
          <select
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={form.location_type}
            onChange={e => set("location_type", e.target.value)}
          >
            {MANUAL_TYPES.map(t => (
              <option key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">אזור / שכונה</label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={form.section}
            onChange={e => set("section", e.target.value)}
            placeholder="לדוגמה: שכונה 1"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">מספר</label>
          <input
            type="number"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={form.location_number}
            onChange={e => set("location_number", e.target.value)}
            placeholder="3"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">סדר תצוגה</label>
          <input
            type="number"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={form.sort_order}
            onChange={e => set("sort_order", e.target.value)}
            placeholder="0"
          />
        </div>
        {isVipSub && vipTents.length > 0 && (
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-600 block mb-1">אוהל VIP הורה</label>
            <select
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={form.parent_location_id || ""}
              onChange={e => set("parent_location_id", e.target.value)}
            >
              <option value="">-- בחר אוהל VIP --</option>
              {vipTents.map(t => (
                <option key={t.id} value={t.id}>{t.display_name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 block mb-1">הערות</label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="הערה אופציונלית..."
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>ביטול</Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "שומר..." : <><Check className="w-3.5 h-3.5" /> שמור</>}
        </Button>
      </div>
    </form>
  );
}

export default function LocationManagerPanel() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["siteLocations", "all"],
    queryFn: () => base44.entities.SiteLocation.list("-created_date", 500),
    staleTime: 30_000,
  });

  const manualLocations = locations.filter(l => l.source_entity_type === "MANUAL");
  const vipTents = locations.filter(l => l.location_type === "VIP_TENT");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["siteLocations"] });
  };

  const handleAdd = async (data) => {
    await base44.entities.SiteLocation.create(data);
    refresh();
    setShowForm(false);
  };

  const handleEdit = async (id, data) => {
    await base44.entities.SiteLocation.update(id, data);
    refresh();
    setEditingId(null);
  };

  const toggleActive = async (loc) => {
    await base44.entities.SiteLocation.update(loc.id, { is_active: !loc.is_active });
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">ניהול מיקומים ידניים</h3>
          <p className="text-xs text-muted-foreground">שירותים, מקלחות, ומיקומים שאינם מסונכרנים אוטומטית</p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); }}>
          <Plus className="w-3.5 h-3.5" /> הוסף מיקום
        </Button>
      </div>

      {showForm && (
        <LocationForm
          initial={{}}
          vipTents={vipTents}
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && manualLocations.length === 0 && !showForm && (
        <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-slate-200 rounded-xl">
          אין מיקומים ידניים. לחץ "הוסף מיקום" להוספת שירותים, מקלחות וכד'.
        </div>
      )}

      {manualLocations.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-card">
          {manualLocations.map(loc => (
            <div key={loc.id}>
              {editingId === loc.id ? (
                <div className="p-3">
                  <LocationForm
                    initial={{
                      display_name: loc.display_name,
                      location_type: loc.location_type,
                      section: loc.section || "",
                      location_number: loc.location_number || "",
                      sort_order: loc.sort_order || "",
                      notes: loc.notes || "",
                      parent_location_id: loc.parent_location_id || "",
                    }}
                    vipTents={vipTents}
                    onSave={(data) => handleEdit(loc.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className={`flex items-center gap-3 px-4 py-3 ${!loc.is_active ? "opacity-40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{loc.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {LOCATION_TYPE_LABELS[loc.location_type] || loc.location_type}
                      {loc.section ? ` · ${loc.section}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditingId(loc.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      title="ערוך"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleActive(loc)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                        loc.is_active
                          ? "text-slate-400 hover:bg-red-50 hover:text-red-500"
                          : "text-emerald-500 hover:bg-emerald-50"
                      }`}
                      title={loc.is_active ? "השבת" : "הפעל"}
                    >
                      {loc.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}