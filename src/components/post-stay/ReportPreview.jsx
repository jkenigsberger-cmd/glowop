import { format } from "date-fns";
import { INCIDENT_CATEGORY_LABELS, INCIDENT_LOCATION_TYPE_LABELS, parsePhotoUrls } from "@/lib/postStayLabels";

const fmt = (d) => (d ? format(new Date(d), "dd/MM/yyyy") : "");

// Official branding — reused from the quote PDF (QuotePdfTemplate.jsx)
const LOGO_URL = "https://media.base44.com/images/public/69ea08de3791d203c52ea3cc/107796e98_quote-logo.png";
const HEADING_FONT = '"Kav16", "Arial Hebrew", Arial, sans-serif';
const BODY_FONT = '"SimplerPro", "Arial Hebrew", Arial, sans-serif';
const BLUE = "#1a56a0";

// Official foundation header — mirrors the quote document identity
function BrandHeader({ group }) {
  return (
    <div className="post-stay-header" style={{ direction: "rtl", marginBottom: 18 }}>
      {/* Top identity row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#555", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontFamily: HEADING_FONT }}>בית הדור הבא - מקום לחוויות ישראליות</span>
        <span style={{ direction: "ltr" }}>www.keren-hador.org • aharonsonhome@keren-hador.com</span>
      </div>

      {/* Logo + title */}
      <div style={{ textAlign: "center", borderBottom: `2px solid ${BLUE}`, paddingBottom: 12 }}>
        <img
          src={LOGO_URL}
          alt="בית הדור הבא"
          style={{ height: 84, width: "auto", display: "block", margin: "0 auto 10px auto" }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, letterSpacing: "-0.5px" }}>
          סיכום שהייה
        </div>
        <div style={{ fontSize: 13, fontFamily: BODY_FONT, color: "#333", marginTop: 3 }}>
          {group?.group_name}
        </div>
        {group?.arrival_date && (
          <div style={{ fontSize: 11, fontFamily: BODY_FONT, color: "#777", marginTop: 2 }}>
            {fmt(group.arrival_date)}{group?.departure_date ? ` – ${fmt(group.departure_date)}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// Official legal footer / blue bar — identical text & style to the quote PDF
function LegalFooter() {
  return (
    <div className="post-stay-legal-footer" style={{ direction: "rtl", marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 4px", borderTop: "1px solid #dde8f5", fontSize: 9.5, fontFamily: BODY_FONT, color: "#555", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontFamily: HEADING_FONT }}>בית הדור הבא - מקום לחוויות ישראליות</span>
        <span style={{ direction: "ltr" }}>www.keren-hador.org • aharonsonhome@keren-hador.com</span>
      </div>
      <div
        className="post-stay-legal-bar"
        style={{
          background: BLUE, color: "#fff", padding: "6px 14px", fontSize: 9,
          fontFamily: BODY_FONT, textAlign: "center", lineHeight: 1.5, borderRadius: 4,
          WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
        }}
      >
        כל המסמכים שהועברו על ידי העמותה, הם רכושה הבלעדי של העמותה ואסור להעתיק ו/או להשתמש בהם, כולם או מקצתם, ללא הסכמת העמותה.
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 13, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, borderBottom: "1px solid #dde8f5", paddingBottom: 3, marginBottom: 8 }}>
      {children}
    </h2>
  );
}

// Client-facing preview — renders ONLY client-visible content.
// Used both for the on-screen preview and the print/export view (print CSS targets #post-stay-print).
export default function ReportPreview({ group, report, participantCount, activities, meals, coffee, prisa, visibleIncidents, forPrint = false }) {
  return (
    <div id={forPrint ? "post-stay-print" : undefined} dir="rtl" style={{ background: "#fff", color: "#1a1a1a", fontFamily: BODY_FONT }}>
      <div className={forPrint ? "post-stay-print-page" : "p-1"} style={forPrint ? { padding: "0", maxWidth: "210mm", margin: "0 auto" } : { padding: 20 }}>
        <BrandHeader group={group} />

        {/* Thank you */}
        {report?.thank_you_text && (
          <p style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 16 }}>{report.thank_you_text}</p>
        )}

        {/* Stay summary */}
        <div style={{ background: "#f5f8ff", border: "1px solid #dde8f5", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <SectionTitle>סיכום השהייה</SectionTitle>
          <ul style={{ fontSize: 12.5, lineHeight: 1.8, listStyle: "none", padding: 0, margin: 0 }}>
            <li>שם הקבוצה: <strong>{group?.group_name}</strong></li>
            <li>
              תאריכי שהייה: <strong>{fmt(group?.arrival_date)}{group?.departure_date ? ` – ${fmt(group?.departure_date)}` : ""}</strong>
            </li>
            <li>מספר משתתפים: <strong>{participantCount || 0}</strong></li>
          </ul>
        </div>

        {/* Activities */}
        {report?.include_activities && activities?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>פעילויות</SectionTitle>
            <ul style={{ fontSize: 12.5, lineHeight: 1.8, listStyle: "none", padding: 0, margin: 0 }}>
              {activities.map((a) => (
                <li key={a.id} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#999", flexShrink: 0 }}>{fmt(a.date)} {a.start_time || ""}</span>
                  <strong>{a.activity_name}</strong>
                  {a.location_display && <span style={{ color: "#777" }}>· {a.location_display}</span>}
                  {a.is_shared_activity && <span style={{ fontSize: 11, color: BLUE }}>פעילות משותפת</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Meals */}
        {report?.include_meals && meals?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>ארוחות</SectionTitle>
            <p style={{ fontSize: 12.5, color: "#555" }}>{meals.length} ארוחות במהלך השהייה</p>
          </div>
        )}

        {/* Coffee corner */}
        {report?.include_coffee_corner && coffee?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>פינות קפה</SectionTitle>
            <ul style={{ fontSize: 12.5, lineHeight: 1.8, listStyle: "none", padding: 0, margin: 0 }}>
              {coffee.map((c) => (
                <li key={c.id}>{fmt(c.date)} {c.start_time || ""} · {c.pax || 0} משתתפים</li>
              ))}
            </ul>
          </div>
        )}

        {/* Prisa */}
        {report?.include_prisa && prisa?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>פריסה</SectionTitle>
            <ul style={{ fontSize: 12.5, lineHeight: 1.8, listStyle: "none", padding: 0, margin: 0 }}>
              {prisa.map((p) => (
                <li key={p.id}>{fmt(p.date)} · כמות להכנה: {p.effective_quantity}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary notes (client-visible) */}
        {report?.summary_notes && (
          <p style={{ fontSize: 12.5, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 16 }}>{report.summary_notes}</p>
        )}

        {/* Incidents — client-visible only */}
        {report?.include_incidents && visibleIncidents?.length > 0 && (
          <div style={{ background: "#fffaf0", border: "1px solid #f0e0c0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <SectionTitle>נושאים לטיפול</SectionTitle>
            <p style={{ fontSize: 12.5, marginBottom: 8 }}>במהלך בדיקת הסיום נמצאו מספר נושאים לטיפול:</p>
            <ul style={{ fontSize: 12.5, lineHeight: 1.7, listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleIncidents.map((inc) => {
                const photos = parsePhotoUrls(inc.photo_urls);
                return (
                  <li key={inc.id} style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                    <p style={{ margin: 0 }}>
                      {inc.location_name && `ב${INCIDENT_LOCATION_TYPE_LABELS[inc.location_type] || ""} ${inc.location_name} `}
                      {inc.description || INCIDENT_CATEGORY_LABELS[inc.category]}
                    </p>
                    {photos.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                        {photos.map((url) => (
                          <img key={url} src={url} alt="" className="post-stay-incident-photo" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 4, border: "1px solid #f0e0c0" }} />
                        ))}
                        <p style={{ width: "100%", fontSize: 11, color: "#777", margin: 0 }}>מצורפת תמונה לתיעוד.</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p style={{ fontSize: 12.5, marginTop: 10, color: "#555" }}>נשמח להסדיר את הנושא מולכם במידת הצורך.</p>
          </div>
        )}

        {/* Closing block — invitation + signature + legal footer kept together so
            they never split onto a near-empty second page */}
        <div className="post-stay-closing">
          {report?.return_invitation_text && (
            <p style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line", marginTop: 16, fontWeight: 600 }}>{report.return_invitation_text}</p>
          )}

          <p style={{ fontSize: 12.5, marginTop: 20 }}>בברכה,<br />צוות בית הדור הבא</p>

          <LegalFooter />
        </div>
      </div>
    </div>
  );
}