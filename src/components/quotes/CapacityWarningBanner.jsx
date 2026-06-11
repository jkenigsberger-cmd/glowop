import { AlertTriangle, Info, Flame, CheckCircle2, Users, Home, BookOpen } from "lucide-react";

/**
 * Displays capacity warnings inside the QuoteFormModal sidebar.
 * Supports both legacy (warnings[]) and new structured (lodging_people, vip_tents, student_tents) response shapes.
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

  const { warnings = [], capacityInfo = {}, status, lodging_people, vip_tents, student_tents } = availabilityResult;

  // ── New structured display ────────────────────────────────────────────────
  const hasStructured = !!lodging_people;

  if (hasStructured) {
    const lodgingOk    = lodging_people.capacity > 0 && lodging_people.max_used > 0;
    const lodgingPct   = lodging_people.capacity > 0 ? Math.round((lodging_people.max_used / lodging_people.capacity) * 100) : 0;
    const lodgingExceeded = lodging_people.capacity > 0 && lodging_people.max_used > lodging_people.capacity;
    const lodgingNearFull = !lodgingExceeded && lodgingPct >= 85;

    const showVip     = vip_tents && vip_tents.total > 0 && lodging_people.per_night?.length > 0;
    const showStudent = student_tents && student_tents.required > 0;

    // If nothing to show at all
    if (!lodgingOk && !showVip && !showStudent && status === "OK") {
      if (lodging_people.capacity === 0) {
        return (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Info className="w-3.5 h-3.5" /> קיבולת לינה לא הוגדרה
            </div>
          </div>
        );
      }
      return null;
    }

    // Determine outer border color
    const borderColor = lodgingExceeded || (vip_tents?.warning && vip_tents.required_by_current_quote > vip_tents.min_available) || (student_tents?.warning && !student_tents.needs_neighborhood_combination)
      ? "border-red-300 bg-red-50"
      : (lodgingNearFull || vip_tents?.warning || student_tents?.warning)
        ? "border-amber-300 bg-amber-50"
        : "border-green-200 bg-green-50";

    return (
      <div className={`rounded-xl border px-4 py-3 space-y-3 ${borderColor}`}>
        {/* Header */}
        {lodging_people.per_night?.length > 0 && (
          <div className="text-xs font-semibold text-slate-600">
            זמינות לינה
          </div>
        )}

        {/* Lodging people */}
        {lodgingOk && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-700">סה״כ לינה</span>
            </div>
            <div className={`text-xs font-bold ${lodgingExceeded ? "text-red-700" : lodgingNearFull ? "text-amber-700" : "text-green-700"}`}>
              {lodging_people.max_used} / {lodging_people.capacity} אנשים בלילה העמוס ביותר
            </div>
            {lodgingExceeded && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="w-3 h-3" />
                חריגה מהתפוסה המקסימלית
              </div>
            )}
            {lodgingNearFull && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <Flame className="w-3 h-3" />
                האתר קרוב לתפוסה מלאה ({lodgingPct}%)
              </div>
            )}
          </div>
        )}

        {/* VIP tents */}
        {showVip && (
          <div className="space-y-1 border-t border-black/5 pt-2">
            <div className="flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-700">אוהלי VIP</span>
            </div>
            <div className={`text-xs ${vip_tents.warning && vip_tents.required_by_current_quote > vip_tents.min_available ? "text-red-700 font-bold" : vip_tents.warning ? "text-amber-700" : "text-green-700"}`}>
              זמינות מינימלית: {vip_tents.min_available} מתוך {vip_tents.total} אוהלי VIP
            </div>
            {vip_tents.warning && (
              <div className={`text-xs whitespace-pre-line ${vip_tents.required_by_current_quote > vip_tents.min_available ? "text-red-600" : "text-amber-600"}`}>
                {vip_tents.warning}
              </div>
            )}
            {!vip_tents.warning && vip_tents.min_available > 0 && (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> VIP פנוי
              </div>
            )}
          </div>
        )}

        {/* Student tents */}
        {showStudent && (
          <div className="space-y-1 border-t border-black/5 pt-2">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-700">אוהלי תלמידים</span>
            </div>
            <div className="text-xs text-slate-600">
              נדרשים לפחות <span className="font-bold">{student_tents.required}</span> אוהלי תלמידים
            </div>
            {student_tents.available_min !== null && (
              <div className={`text-xs ${student_tents.required > student_tents.available_min ? "text-red-700 font-bold" : "text-green-700"}`}>
                זמינים {student_tents.available_min} אוהלים
              </div>
            )}
            {student_tents.warning && (
              <div className={`text-xs ${student_tents.needs_neighborhood_combination ? "text-amber-600" : "text-red-600"}`}>
                {student_tents.warning}
              </div>
            )}
          </div>
        )}

        {status === "OK" && lodgingOk && !lodgingExceeded && !lodgingNearFull && !vip_tents?.warning && !student_tents?.warning && (
          <div className="text-[10px] text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> קיבולת פנויה
          </div>
        )}
        <p className="text-[10px] text-slate-400">זוהי אזהרה בלבד — ניתן להמשיך</p>
      </div>
    );
  }

  // ── Legacy fallback display (for backward compat) ─────────────────────────
  const hardWarnings  = warnings.filter(w => w.severity === "WARNING");
  const nearFullWarnings = warnings.filter(w => w.severity === "NEAR_FULL");
  const unconfigured  = Object.entries(capacityInfo)
    .filter(([, v]) => v.unconfigured)
    .map(([k]) => k === "sleeping" ? "לינה" : k === "day_use" ? "יום כיף" : k === "meals" ? "ארוחות" : k);

  const hasWarnings = hardWarnings.length > 0;
  const hasNearFull = nearFullWarnings.length > 0;

  return (
    <div className="space-y-2">
      {hasWarnings && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> חריגת קיבולת
          </div>
          {hardWarnings.map((w, i) => (
            <div key={i} className="text-xs text-red-700 whitespace-pre-line">
              {w.message}
              {w.held !== undefined && (
                <span className="block text-red-400 mt-0.5">תפוס: {w.held} · מבוקש: {w.requested} · מקסימום: {w.max}</span>
              )}
            </div>
          ))}
          <p className="text-[10px] text-red-500 mt-1">ניתן להמשיך — זוהי אזהרה בלבד</p>
        </div>
      )}
      {hasNearFull && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
            <Flame className="w-3.5 h-3.5 flex-shrink-0" /> האתר קרוב לתפוסה מלאה
          </div>
          {nearFullWarnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-700 whitespace-pre-line">{w.message}</div>
          ))}
          <p className="text-[10px] text-amber-600 mt-1">מידע בלבד — ניתן להמשיך</p>
        </div>
      )}
      {unconfigured.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-xs">
            <Info className="w-3.5 h-3.5 flex-shrink-0" /> קיבולת לא הוגדרה
          </div>
          <p className="text-xs text-slate-400">{unconfigured.join(", ")}</p>
        </div>
      )}
      {!hasWarnings && !hasNearFull && unconfigured.length === 0 && Object.keys(capacityInfo).length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-xs text-green-700 font-medium">✓ קיבולת פנויה</p>
        </div>
      )}
    </div>
  );
}