/**
 * NeighborhoodOnlyCard — shown in Housekeeping when a group has a NeighborhoodReservation
 * but no specific SleepingAllocation rows yet.
 *
 * Props:
 *   reservation     - NeighborhoodReservation record
 *   neighborhood    - Neighborhood record (may be undefined)
 *   profile         - OperationalGroupProfile record (may be undefined, for dist JSON)
 *   type            - "checkin" | "checkout" | "occupied"
 */

const GENDER_LABEL = { BOYS: "בנים", GIRLS: "בנות", MIXED: "מעורב / כללי" };

function parseDist(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export default function NeighborhoodOnlyCard({ reservation, neighborhood, profile, type }) {
  if (!reservation) return null;

  const nhoodName     = neighborhood?.name || "שכונה לא ידועה";
  const plannedTents  = reservation.planned_tents || 0;
  const genderLabel   = GENDER_LABEL[reservation.gender_group] || reservation.gender_group || "";

  // Try to derive per-tent distribution from profile dist JSON (boys/girls)
  let distRows = [];
  if (profile) {
    if (reservation.gender_group === "BOYS" || reservation.gender_group === "MIXED") {
      distRows = parseDist(profile.boys_tent_distribution_json);
    } else if (reservation.gender_group === "GIRLS") {
      distRows = parseDist(profile.girls_tent_distribution_json);
    }
  }

  // Total beds from distribution rows; fallback to tent×capacity average
  const totalFromDist = distRows.reduce((s, r) => s + (r.tent_count || 0) * (r.people_per_tent || 0), 0);

  const isCheckout = type === "checkout";

  return (
    <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-3 space-y-2">
      {/* Neighborhood header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-800">{nhoodName}</span>
          {genderLabel && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {genderLabel}
            </span>
          )}
        </div>
        {isCheckout && (
          <span className="text-[10px] font-bold text-orange-700 bg-orange-100 border border-orange-200 rounded px-2 py-0.5">
            CHECK OUT / לניקוי
          </span>
        )}
      </div>

      {/* Preparation instructions */}
      {plannedTents > 0 && (
        <p className="text-xs font-semibold text-blue-800">
          {isCheckout ? `לנקות ${plannedTents} אוהלים` : `להכין ${plannedTents} אוהלים`}
          {totalFromDist > 0 && ` · סה״כ ${totalFromDist} מיטות`}
        </p>
      )}

      {/* Per-tent distribution if available */}
      {distRows.length > 0 ? (
        <div className="space-y-1">
          {distRows.map((row, idx) => {
            const count = row.tent_count || 0;
            const ppt   = row.people_per_tent || 0;
            if (!count || !ppt) return null;
            return Array.from({ length: count }).map((_, i) => (
              <div key={`${idx}-${i}`} className="flex items-center gap-2 text-xs text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span>
                  {isCheckout ? "לנקות אוהל עם" : "להכין אוהל עם"}{" "}
                  <strong>{ppt} מיטות</strong>
                </span>
              </div>
            ));
          })}
        </div>
      ) : plannedTents > 0 ? (
        <p className="text-xs text-blue-700">
          {isCheckout ? "לנקות" : "להכין"} {plannedTents} אוהלים בשכונה זו
        </p>
      ) : null}

      {/* Warning: no exact tents */}
      {!isCheckout && (
        <p className="text-[10px] text-blue-500 italic">
          טרם נבחרו אוהלים ספציפיים
        </p>
      )}

      {reservation.notes && (
        <p className="text-xs text-slate-500">📝 {reservation.notes}</p>
      )}
    </div>
  );
}