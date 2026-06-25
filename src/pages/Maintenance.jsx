import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Wrench, Home, Droplets, Star, Layers,
  ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Settings
} from "lucide-react";
import { useRoleContext } from "@/lib/RoleContext";
import LocationManagerPanel from "@/components/maintenance/LocationManagerPanel";
import { Button } from "@/components/ui/button";

// ── Section config ────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    key: "neighborhoods",
    label: "שכונות",
    sublabel: "אוהלים לפי שכונה",
    icon: Home,
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
    iconBg: "bg-emerald-100",
    types: ["NEIGHBORHOOD_TENT"],
  },
  {
    key: "bathrooms",
    label: "שירותים",
    sublabel: "שירותים לפי מיקום",
    icon: Droplets,
    color: "bg-blue-50 border-blue-200 text-blue-700",
    iconBg: "bg-blue-100",
    types: ["BATHROOM"],
  },
  {
    key: "showers",
    label: "מקלחות",
    sublabel: "מקלחות לפי מיקום",
    icon: Droplets,
    color: "bg-cyan-50 border-cyan-200 text-cyan-700",
    iconBg: "bg-cyan-100",
    types: ["SHOWER"],
  },
  {
    key: "vip",
    label: "VIP",
    sublabel: "אוהלי VIP + שירותים + מקלחות",
    icon: Star,
    color: "bg-purple-50 border-purple-200 text-purple-700",
    iconBg: "bg-purple-100",
    types: ["VIP_TENT", "VIP_BATHROOM", "VIP_SHOWER"],
  },
  {
    key: "common-spaces",
    label: "מרחבים משותפים",
    sublabel: "חדרים ומרחבי פעילות",
    icon: Layers,
    color: "bg-amber-50 border-amber-200 text-amber-700",
    iconBg: "bg-amber-100",
    types: ["COMMON_SPACE"],
  },
];

// ── Section overview ──────────────────────────────────────────────────────────
function SectionOverview({ locations, onSelectSection, isAdmin, onSyncClick, syncing, syncResult, onManageLocations }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            תחזוקה
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            דיווח תקלות, מעקב תיקונים וסטטוס מתקנים
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={onManageLocations}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors shrink-0"
          >
            <Settings className="w-3.5 h-3.5" /> ניהול מיקומים
          </button>
        )}
      </div>

      {locations.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-sm text-amber-700 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">טרם הוגדרו מיקומי תחזוקה</p>
              <p className="text-xs mt-0.5">
                {isAdmin
                  ? "לחץ על הכפתור למטה לסנכרון אוהלים ומרחבים קיימים."
                  : "מנהל המערכת צריך להגדיר מיקומים (אוהלים, שירותים, מקלחות)."}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={onSyncClick}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "מסנכרן..." : "סנכרן מיקומים קיימים"}
            </Button>
          )}
        </div>
      )}

      {syncResult && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${syncResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {syncResult.success ? syncResult.summary : `שגיאה: ${syncResult.error}`}
          {syncResult.vip_message && (
            <p className="text-xs mt-1 opacity-80">{syncResult.vip_message}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map(sec => {
          const count = locations.filter(l => sec.types.includes(l.location_type)).length;
          const Icon = sec.icon;
          return (
            <button
              key={sec.key}
              onClick={() => onSelectSection(sec.key)}
              className={`w-full text-right flex items-center gap-4 p-4 rounded-xl border ${sec.color} hover:opacity-80 active:opacity-60 transition-opacity`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${sec.iconBg}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-tight">{sec.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{sec.sublabel}</p>
                <p className="text-xs font-semibold mt-1.5 opacity-80">
                  {count > 0 ? `${count} מיקומים` : "טרם הוגדרו מיקומים"}
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 opacity-40 shrink-0" />
            </button>
          );
        })}
      </div>

      {isAdmin && locations.length > 0 && (
        <Button variant="outline" size="sm" onClick={onSyncClick} disabled={syncing} className="gap-2 w-full sm:w-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "מסנכרן..." : "סנכרן מחדש (אוהלים + מרחבים)"}
        </Button>
      )}
    </div>
  );
}

// ── Location list for a section ───────────────────────────────────────────────
function SectionView({ sectionKey, locations, onBack, onSelectLocation }) {
  const sec = SECTIONS.find(s => s.key === sectionKey);
  if (!sec) return null;

  const sectionLocations = locations
    .filter(l => sec.types.includes(l.location_type))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.display_name || "").localeCompare(b.display_name || ""));

  const Icon = sec.icon;

  // VIP: show parent tents, then their children grouped beneath
  if (sectionKey === "vip") {
    const vipTents = sectionLocations.filter(l => l.location_type === "VIP_TENT")
      .sort((a, b) => (a.location_number ?? 0) - (b.location_number ?? 0));
    const subByParent = {};
    sectionLocations.filter(l => l.location_type !== "VIP_TENT").forEach(l => {
      if (!subByParent[l.parent_location_id]) subByParent[l.parent_location_id] = [];
      subByParent[l.parent_location_id].push(l);
    });

    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-4 h-4" /> חזרה לתחזוקה
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sec.iconBg} shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold">{sec.label}</h2>
        </div>

        {vipTents.length === 0 && <EmptyLocations />}

        <div className="space-y-3">
          {vipTents.map(tent => {
            const subs = subByParent[tent.id] || [];
            return (
              <div key={tent.id} className="border border-purple-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => onSelectLocation(tent)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors text-right"
                >
                  <Star className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="font-semibold text-purple-800 flex-1">{tent.display_name}</span>
                  <ChevronLeft className="w-4 h-4 text-purple-400" />
                </button>
                {subs.length > 0 && (
                  <div className="divide-y divide-purple-100">
                    {subs.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => onSelectLocation(sub)}
                        className="w-full flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-purple-50/50 transition-colors text-right"
                      >
                        <span className="text-xs text-purple-400 w-16 shrink-0">
                          {sub.location_type === "VIP_BATHROOM" ? "שירותים" : "מקלחת"}
                        </span>
                        <span className="text-sm text-slate-700 flex-1">{sub.display_name}</span>
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Group by section field for non-VIP
  const grouped = {};
  sectionLocations.forEach(loc => {
    const key = loc.section || "כללי";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(loc);
  });
  const groupKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="w-4 h-4" /> חזרה לתחזוקה
      </button>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sec.iconBg} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold">{sec.label}</h2>
      </div>

      {sectionLocations.length === 0 && <EmptyLocations />}

      {groupKeys.map(groupKey => (
        <div key={groupKey} className="space-y-1.5">
          {groupKeys.length > 1 && (
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">{groupKey}</p>
          )}
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-card">
            {grouped[groupKey].map(loc => (
              <button
                key={loc.id}
                onClick={() => onSelectLocation(loc)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors text-right"
              >
                <span className="flex-1 text-sm font-medium">{loc.display_name}</span>
                <ChevronLeft className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Location detail (Phase 2 placeholder) ────────────────────────────────────
function LocationDetail({ location, onBack }) {
  const sec = SECTIONS.find(s => s.types.includes(location.location_type));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="w-4 h-4" /> חזרה
      </button>

      <div className="bg-card border border-border rounded-xl p-4 space-y-1">
        <div className="flex items-center gap-3">
          {sec && (
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${sec.iconBg} shrink-0`}>
              <sec.icon className="w-4 h-4" />
            </div>
          )}
          <div>
            <h2 className="font-bold text-base leading-tight">{location.display_name}</h2>
            {location.section && (
              <p className="text-xs text-muted-foreground">{location.section}</p>
            )}
          </div>
        </div>
      </div>

      {/* Issue list — Phase 2 */}
      <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-2">
        <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-sm font-semibold text-slate-400">עדיין אין תקלות רשומות למיקום זה</p>
        <p className="text-xs text-slate-400">דיווח תקלות יתווסף בשלב הבא</p>
        <div className="mt-3">
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary/50 rounded-lg text-sm font-semibold cursor-not-allowed"
          >
            + פתח תקלה חדשה
            <span className="text-[10px] bg-amber-100 text-amber-600 rounded-full px-2 py-0.5">בקרוב</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyLocations() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-5 text-center space-y-1">
      <p className="text-sm font-semibold text-slate-500">לא הוגדרו מיקומים בקטגוריה זו</p>
      <p className="text-xs text-slate-400">ניתן להוסיף מיקומים מדף הניהול</p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Maintenance() {
  const [activeSection, setActiveSection] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const qc = useQueryClient();
  const { role } = useRoleContext();
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"].includes(role);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["siteLocations"],
    queryFn: () => base44.entities.SiteLocation.filter({ is_active: true }),
    staleTime: 60_000,
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await base44.functions.invoke("syncMaintenanceLocations", {});
    const data = res.data;
    setSyncResult(data);
    setSyncing(false);
    qc.invalidateQueries({ queryKey: ["siteLocations"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleBack = () => {
    if (activeLocation) {
      setActiveLocation(null);
    } else if (showManager) {
      setShowManager(false);
    } else {
      setActiveSection(null);
    }
  };

  // Manager view
  if (showManager) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" /> חזרה לתחזוקה
          </button>
          <LocationManagerPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {!activeSection && (
          <SectionOverview
            locations={locations}
            onSelectSection={setActiveSection}
            isAdmin={isAdmin}
            onSyncClick={handleSync}
            syncing={syncing}
            syncResult={syncResult}
            onManageLocations={() => setShowManager(true)}
          />
        )}
        {activeSection && !activeLocation && (
          <SectionView
            sectionKey={activeSection}
            locations={locations}
            onBack={handleBack}
            onSelectLocation={setActiveLocation}
          />
        )}
        {activeLocation && (
          <LocationDetail location={activeLocation} onBack={handleBack} />
        )}
      </div>
    </div>
  );
}