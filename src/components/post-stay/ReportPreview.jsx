import { format } from "date-fns";
import { INCIDENT_CATEGORY_LABELS, INCIDENT_LOCATION_TYPE_LABELS, parsePhotoUrls } from "@/lib/postStayLabels";

const fmt = (d) => (d ? format(new Date(d), "dd/MM/yyyy") : "");

// Client-facing preview — renders ONLY client-visible content.
// Used both for the on-screen preview and the print/export view (print CSS targets #post-stay-print).
export default function ReportPreview({ group, report, participantCount, activities, meals, coffee, prisa, visibleIncidents, forPrint = false }) {
  return (
    <div id={forPrint ? "post-stay-print" : undefined} dir="rtl" className="bg-white text-slate-800">
      <div className={forPrint ? "p-8 max-w-3xl mx-auto" : "p-5"}>
        {/* Header */}
        <div className="text-center border-b border-slate-200 pb-4 mb-4">
          <h1 className="text-xl font-bold">בית הדור הבא</h1>
          <p className="text-sm text-slate-500 mt-1">סיכום שהייה — {group?.group_name}</p>
        </div>

        {/* Thank you */}
        {report?.thank_you_text && (
          <p className="text-sm leading-relaxed whitespace-pre-line mb-4">{report.thank_you_text}</p>
        )}

        {/* Stay summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-bold mb-2">סיכום השהייה</h2>
          <ul className="text-sm space-y-1">
            <li>שם הקבוצה: <span className="font-medium">{group?.group_name}</span></li>
            <li>
              תאריכי שהייה: <span className="font-medium">{fmt(group?.arrival_date)}{group?.departure_date ? ` – ${fmt(group?.departure_date)}` : ""}</span>
            </li>
            <li>מספר משתתפים: <span className="font-medium">{participantCount || 0}</span></li>
          </ul>
        </div>

        {/* Activities */}
        {report?.include_activities && activities?.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold mb-2">פעילויות</h2>
            <ul className="text-sm space-y-1">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="text-slate-400 shrink-0">{fmt(a.date)} {a.start_time || ""}</span>
                  <span className="font-medium">{a.activity_name}</span>
                  {a.activity_space_code && <span className="text-slate-500">· {a.activity_space_code}</span>}
                  {a.is_shared_activity && <span className="text-[11px] text-blue-600">פעילות משותפת</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Meals */}
        {report?.include_meals && meals?.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold mb-2">ארוחות</h2>
            <p className="text-sm text-slate-600">{meals.length} ארוחות במהלך השהייה</p>
          </div>
        )}

        {/* Coffee corner */}
        {report?.include_coffee_corner && coffee?.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold mb-2">פינות קפה</h2>
            <ul className="text-sm space-y-1">
              {coffee.map((c) => (
                <li key={c.id}>{fmt(c.date)} {c.start_time || ""} · {c.pax || 0} משתתפים</li>
              ))}
            </ul>
          </div>
        )}

        {/* Prisa */}
        {report?.include_prisa && prisa?.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold mb-2">פריסה</h2>
            <ul className="text-sm space-y-1">
              {prisa.map((p) => (
                <li key={p.id}>{fmt(p.date)} · כמות להכנה: {p.effective_quantity}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary notes */}
        {report?.summary_notes && (
          <p className="text-sm leading-relaxed whitespace-pre-line mb-4">{report.summary_notes}</p>
        )}

        {/* Incidents — client-visible only */}
        {report?.include_incidents && visibleIncidents?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm mb-2">במהלך בדיקת הסיום נמצאו מספר נושאים לטיפול:</p>
            <ul className="text-sm space-y-3">
              {visibleIncidents.map((inc) => {
                const photos = parsePhotoUrls(inc.photo_urls);
                return (
                  <li key={inc.id}>
                    <p>
                      {inc.location_name && `ב${INCIDENT_LOCATION_TYPE_LABELS[inc.location_type] || ""} ${inc.location_name} `}
                      {inc.description || INCIDENT_CATEGORY_LABELS[inc.category]}
                    </p>
                    {photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {photos.map((url) => (
                          <img key={url} src={url} alt="" className="w-28 h-28 object-cover rounded border border-amber-200" />
                        ))}
                        <p className="w-full text-xs text-slate-500">מצורפת תמונה לתיעוד.</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-sm mt-3 text-slate-600">נשמח להסדיר את הנושא מולכם במידת הצורך.</p>
          </div>
        )}

        {/* Return invitation */}
        {report?.return_invitation_text && (
          <p className="text-sm leading-relaxed whitespace-pre-line mt-4 font-medium">{report.return_invitation_text}</p>
        )}

        <p className="text-sm mt-6">בברכה,<br />צוות בית הדור הבא</p>
      </div>
    </div>
  );
}