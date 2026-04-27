import { AlertTriangle, Info, Flame } from "lucide-react";

/**
 * Displays capacity warnings or neutral "not configured" notices
 * inside the QuoteFormModal sidebar.
 *
 * Props:
 *   availabilityResult: the object returned by checkSiteAvailability
 *   loading: boolean
 */
export default function CapacityWarningBanner({ availabilityResult, loading }) {
  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-400 animate-pulse">
        בודק זמינות...
      </div>
    );
  }

  if (!availabilityResult) return null;

  const { warnings = [], capacityInfo = {} } = availabilityResult;

  const hardWarnings = warnings.filter(w => w.severity === "WARNING");
  const nearFullWarnings = warnings.filter(w => w.severity === "NEAR_FULL");

  // Collect unconfigured capacity types for neutral notice
  const unconfigured = Object.entries(capacityInfo)
    .filter(([, v]) => v.unconfigured)
    .map(([k]) => {
      if (k === "sleeping") return "לינה";
      if (k === "day_use")  return "יום כיף";
      if (k === "meals")    return "ארוחות";
      return k;
    });

  const hasWarnings = hardWarnings.length > 0;
  const hasNearFull = nearFullWarnings.length > 0;

  return (
    <div className="space-y-2">

      {/* Hard capacity warnings (exceeded) */}
      {hasWarnings && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            חריגת קיבולת
          </div>
          {hardWarnings.map((w, i) => (
            <div key={i} className="text-xs text-red-700">
              {w.message}
              <span className="block text-red-400 mt-0.5">
                תפוס: {w.held} · מבוקש: {w.requested} · מקסימום: {w.max}
              </span>
            </div>
          ))}
          <p className="text-[10px] text-red-500 mt-1">ניתן להמשיך — זוהי אזהרה בלבד</p>
        </div>
      )}

      {/* Near-full informational warning */}
      {hasNearFull && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
            <Flame className="w-3.5 h-3.5 flex-shrink-0" />
            האתר קרוב לתפוסה מלאה
          </div>
          {nearFullWarnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-700">
              {w.message}
              <span className="block text-amber-500 mt-0.5">
                תפוס: {w.held} · מבוקש: {w.requested} · מקסימום: {w.max}
              </span>
            </div>
          ))}
          <p className="text-[10px] text-amber-600 mt-1">מידע בלבד — ניתן להמשיך</p>
        </div>
      )}

      {/* Unconfigured neutral notices */}
      {unconfigured.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-xs">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            קיבולת לא הוגדרה עדיין
          </div>
          <p className="text-xs text-slate-400">{unconfigured.join(", ")}</p>
        </div>
      )}

      {/* All good */}
      {!hasWarnings && !hasNearFull && unconfigured.length === 0 && Object.keys(capacityInfo).length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-xs text-green-700 font-medium">✓ קיבולת פנויה</p>
          {Object.entries(capacityInfo).map(([k, v]) => (
            <p key={k} className="text-[10px] text-green-600 mt-0.5">
              {k === "sleeping" ? "לינה" : k === "day_use" ? "יום כיף" : "ארוחות"}:
              {" "}{v.totalAfter}/{v.max}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}