import { createPortal } from "react-dom";
import { format } from "date-fns";
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_LOCATION_TYPE_LABELS,
  parsePhotoUrls,
} from "@/lib/postStayLabels";

const fmt = (d) => (d ? format(new Date(d), "dd/MM/yyyy") : "");

// Official branding — reused from the quote PDF
const LOGO_URL = "https://media.base44.com/images/public/69ea08de3791d203c52ea3cc/107796e98_quote-logo.png";
const BLUE = "#1a56a0";

/**
 * Isolated, print-only A4 document for סיכום שהייה.
 *
 * Rendered through a portal directly under <body> into #post-stay-print-root,
 * completely OUTSIDE the React app layout (#root). During print, CSS sets
 * #root { display:none } and #post-stay-print-root { display:block }, so the
 * printed output is ONLY this clean A4 paper — no app-layout spacing leaks,
 * no hidden-content height, no absolute-positioning fragility.
 *
 * On screen this element is display:none (CSS), so it never affects the page.
 */
export default function PostStayPrintDocument({
  group, report, participantCount, activities, meals, coffee, prisa, visibleIncidents,
}) {
  const root = typeof document !== "undefined" ? document.getElementById("post-stay-print-root") : null;
  if (!root) return null;

  const doc = (
    <div className="post-stay-a4-page" dir="rtl">
      {/* ── Letterhead ─────────────────────────────────────────── */}
      <div className="psp-header">
        <div className="psp-contact-line">
          <span className="psp-org">בית הדור הבא - מקום לחוויות ישראליות</span>
          <span className="psp-ltr">www.keren-hador.org • aharonsonhome@keren-hador.com</span>
        </div>
        <div className="psp-title-block">
          <img src={LOGO_URL} alt="בית הדור הבא" className="psp-logo" onError={(e) => { e.target.style.display = "none"; }} />
          <div className="psp-title">סיכום שהייה</div>
          <div className="psp-group-name">{group?.group_name}</div>
          {group?.arrival_date && (
            <div className="psp-dates">
              {fmt(group.arrival_date)}{group?.departure_date ? ` – ${fmt(group.departure_date)}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* ── Main body (flex:1 pushes footer down) ─────────────────── */}
      <div className="psp-main">
        {report?.thank_you_text && (
          <p className="psp-paragraph">{report.thank_you_text}</p>
        )}

        {/* Stay summary */}
        <div className="psp-section psp-section--accent">
          <h2 className="psp-section-title">סיכום השהייה</h2>
          <ul className="psp-list">
            <li>שם הקבוצה: <strong>{group?.group_name}</strong></li>
            <li>תאריכי שהייה: <strong>{fmt(group?.arrival_date)}{group?.departure_date ? ` – ${fmt(group?.departure_date)}` : ""}</strong></li>
            <li>מספר משתתפים: <strong>{participantCount || 0}</strong></li>
          </ul>
        </div>

        {/* Activities — compact table */}
        {report?.include_activities && activities?.length > 0 && (
          <div className="psp-section">
            <h2 className="psp-section-title">פעילויות</h2>
            <table className="psp-table">
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td className="psp-td-time">{fmt(a.date)} {a.start_time || ""}</td>
                    <td className="psp-td-name">
                      {a.activity_name}
                      {a.is_shared_activity && <span className="psp-shared"> · פעילות משותפת</span>}
                    </td>
                    <td className="psp-td-loc">{a.location_display || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Meals */}
        {report?.include_meals && meals?.length > 0 && (
          <div className="psp-section">
            <h2 className="psp-section-title">ארוחות</h2>
            <p className="psp-muted">{meals.length} ארוחות במהלך השהייה</p>
          </div>
        )}

        {/* Coffee corner */}
        {report?.include_coffee_corner && coffee?.length > 0 && (
          <div className="psp-section">
            <h2 className="psp-section-title">פינות קפה</h2>
            <ul className="psp-list">
              {coffee.map((c) => (
                <li key={c.id}>{fmt(c.date)} {c.start_time || ""} · {c.pax || 0} משתתפים</li>
              ))}
            </ul>
          </div>
        )}

        {/* Prisa */}
        {report?.include_prisa && prisa?.length > 0 && (
          <div className="psp-section">
            <h2 className="psp-section-title">פריסה</h2>
            <ul className="psp-list">
              {prisa.map((p) => (
                <li key={p.id}>{fmt(p.date)} · כמות להכנה: {p.effective_quantity}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary notes (client-visible) */}
        {report?.summary_notes && (
          <p className="psp-paragraph">{report.summary_notes}</p>
        )}

        {/* Incidents — client-visible only */}
        {report?.include_incidents && visibleIncidents?.length > 0 && (
          <div className="psp-section psp-section--warn">
            <h2 className="psp-section-title">נושאים לטיפול</h2>
            <p className="psp-paragraph psp-mb">במהלך בדיקת הסיום נמצאו מספר נושאים לטיפול:</p>
            <ul className="psp-incident-list">
              {visibleIncidents.map((inc) => {
                const photos = parsePhotoUrls(inc.photo_urls);
                return (
                  <li key={inc.id} className="psp-incident">
                    <p className="psp-incident-text">
                      {inc.location_name && `ב${INCIDENT_LOCATION_TYPE_LABELS[inc.location_type] || ""} ${inc.location_name} `}
                      {inc.description || INCIDENT_CATEGORY_LABELS[inc.category]}
                    </p>
                    {photos.length > 0 && (
                      <div className="psp-photos">
                        {photos.map((url) => (
                          <img key={url} src={url} alt="" className="psp-photo" />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="psp-muted psp-mt">נשמח להסדיר את הנושא מולכם במידת הצורך.</p>
          </div>
        )}
      </div>

      {/* ── Footer pinned to bottom of the A4 page ──────────────────── */}
      <div className="psp-footer">
        {report?.return_invitation_text && (
          <p className="psp-invitation">{report.return_invitation_text}</p>
        )}
        <p className="psp-signature">בברכה,<br />צוות בית הדור הבא</p>

        <div className="psp-footer-contact">
          <span className="psp-org">בית הדור הבא - מקום לחוויות ישראליות</span>
          <span className="psp-ltr">www.keren-hador.org • aharonsonhome@keren-hador.com</span>
        </div>
        <div className="psp-legal-bar">
          כל המסמכים שהועברו על ידי העמותה, הם רכושה הבלעדי של העמותה ואסור להעתיק ו/או להשתמש בהם, כולם או מקצתם, ללא הסכמת העמותה.
        </div>
      </div>
    </div>
  );

  return createPortal(doc, root);
}