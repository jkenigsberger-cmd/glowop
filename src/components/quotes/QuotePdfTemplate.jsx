/**
 * QuotePdfTemplate — matches the reference PDF as closely as possible.
 * Logo centered + large on Page 1. Table-style client/activity rows.
 * Printable A4 RTL Hebrew via window.print().
 */

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("he-IL");
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("he-IL"); } catch { return d; }
};
const parse = (str, fb = []) => { try { const r = JSON.parse(str); return Array.isArray(r) ? r : fb; } catch { return fb; } };

const LOGO_URL_FALLBACK   = "https://media.base44.com/images/public/69ea08de3791d203c52ea3cc/107796e98_quote-logo.png";
const FOOTER_URL_FALLBACK = "https://media.base44.com/images/public/69ea08de3791d203c52ea3cc/c500ec249_quote-footer-photo.jpg";

// ── Safe resolvers ────────────────────────────────────────────────────────────
function resolveData(quote, group) {
  let snap = null;
  try { snap = quote?.snapshot ? JSON.parse(quote.snapshot) : null; } catch {}

  const studentLines  = parse(quote?.student_lodging_lines);
  const adultLines    = parse(quote?.adult_lodging_lines);
  const workshopLines = parse(quote?.workshop_lines);
  const lectureLines  = parse(quote?.lecture_lines);
  const addonLines    = parse(quote?.addon_lines);
  const adjustLines   = parse(quote?.adjustment_lines);
  const coffeeCornerPax = Number(quote?.coffee_corner_pax || 0);

  const isDayUse  = (group?.group_type === "DAY_USE") || (studentLines.length > 0 && studentLines[0].rate_type === "day_activity");
  const arrival   = quote?.arrival_date   || snap?.startDate   || group?.arrival_date   || "";
  const departure = isDayUse ? arrival : (quote?.departure_date || snap?.endDate || group?.departure_date || "");
  const nights    = isDayUse ? 0 : (arrival && departure)
    ? Math.max(0, Math.round((new Date(departure) - new Date(arrival)) / 86400000))
    : (quote?.nights ?? 0);

  const STUDENT_RATES = {
    day_activity:    { label: "יום פעילות",        rate: 125 },
    midweek_lodging: { label: "לינה אמצע שבוע",    rate: 190 },
    weekend_lodging: { label: "לינה סוף שבוע",      rate: 250 },
  };
  const ADULT_RATES = {
    BED3:  { label: "אוהל 3 מיטות",   rate: 340 },
    BED68: { label: "אוהל 6/8 מיטות", rate: 250 },
  };

  const lineItems = [];

  studentLines.forEach(r => {

    const rateInfo = STUDENT_RATES[r.rate_type];
    const isDay = r.rate_type === "day_activity";
    const unitRate = rateInfo?.rate ?? Number(r.rate ?? 0);
    const qty = isDay ? Number(r.pax) : Number(r.pax) * Number(r.nights);
    const total = qty * unitRate;
    // Label matches reference: "לינה אמצע שבוע - אירוח"
    const label = (rateInfo?.label || r.rate_type) + " - אירוח";
    lineItems.push({ name: label, qty, unitPrice: unitRate, total, vatAmount: null });
  });

  adultLines.forEach(r => {
    const rateInfo = ADULT_RATES[r.tent_type];
    const rate = rateInfo?.rate ?? Number(r.rate_per_tent_per_night ?? 0);
    const qty = Number(r.tent_count) * Number(r.nights);
    const total = qty * rate;
    lineItems.push({ name: rateInfo?.label || r.tent_type, qty: r.tent_count, unitPrice: rate, total, vatAmount: null });
  });

  workshopLines.forEach(r => {
    lineItems.push({ name: `סדנה: ${r.name}`, qty: 1, unitPrice: Number(r.rate ?? 0), total: Number(r.rate ?? 0), vatAmount: null });
  });

  lectureLines.forEach(r => {
    const base = Number(r.base_price ?? 0);
    const vatAmount = r.vat_included ? Math.round(base * 0.18) : null;
    const total = r.vat_included ? base + vatAmount : base;
    const label = r.vat_included ? `הרצאה: ${r.name} (+ מע״מ)` : `הרצאה: ${r.name}`;
    lineItems.push({ name: label, qty: 1, unitPrice: base, total, vatAmount });
  });

  if (coffeeCornerPax > 0) {
    lineItems.push({ name: "פינת קפה ועוגיות", qty: coffeeCornerPax, unitPrice: 15, total: coffeeCornerPax * 15, vatAmount: null });
  }

  addonLines.forEach(r => {
    const qty = Number(r.quantity ?? 1);
    const unit = Number(r.unit_price ?? 0);
    lineItems.push({ name: r.description || "תוספת", qty, unitPrice: unit, total: qty * unit, vatAmount: null });
  });

  adjustLines.forEach(r => {
    const amt = Number(r.amount || 0);
    lineItems.push({ name: r.description || "התאמה", qty: 1, unitPrice: amt, total: amt, vatAmount: null, isAdjustment: true });
  });

  const subtotal    = Number(quote?.subtotal ?? 0);
  const discountPct = Number(quote?.discount_percent ?? 0);
  const discountAmt = Number(quote?.discount_amount ?? 0);
  const totalPrice  = Number(quote?.total_price ?? 0);
  const advance     = Number(quote?.advance_payment ?? Math.round(totalPrice * 0.3));
  const balance     = Number(quote?.balance_payment ?? (totalPrice - advance));

  // Activity type label from first student lodging line
  const activityTypeLabel = studentLines.length > 0
    ? (STUDENT_RATES[studentLines[0].rate_type]?.label || studentLines[0].rate_type)
    : (group?.group_type === "DAY_USE" ? "יום כיף" : "לינה");

  // Audience
  const audienceLabel = (quote?.participant_count ?? group?.participant_count)
    ? "תלמידים"
    : (quote?.staff_count ?? group?.staff_count) ? "מבוגרים" : "תלמידים";

  const STATUS_HE = { DRAFT: "טיוטה", SENT: "נשלח", APPROVED: "מאושר", REJECTED: "נדחה", EXPIRED: "פג תוקף" };

  return {
    clientName:   snap?.clientName  || quote?.client_name  || group?.contact_name  || "—",
    clientOrg:    snap?.clientOrg   || group?.group_name   || quote?.client_name   || "—",
    clientPhone:  snap?.clientPhone || quote?.client_phone || group?.contact_phone || "—",
    clientEmail:  snap?.clientEmail || quote?.client_email || group?.contact_email || "—",
    clientTaxId:  snap?.clientTaxId || quote?.client_tax_id || "",
    contactName:  snap?.clientName  || quote?.client_name  || group?.contact_name  || "—",
    groupName:    snap?.groupName   || snap?.group_name    || group?.group_name    || quote?.client_name || "—",
    activityTypeLabel,
    audienceLabel,
    arrival,
    departure,
    nights,
    totalPax:     snap?.totalPax ?? quote?.estimated_pax ?? group?.total_pax ?? "—",
    lineItems,
    subtotal,
    discountPct,
    discountAmt,
    totalPrice,
    advance,
    balance,
    paymentTerms: quote?.payment_terms || "",
    quoteNumber:  quote?.quote_number || "",
    version:      quote?.version ?? 1,
    status:       STATUS_HE[quote?.status] || quote?.status || "",
    validUntil:   quote?.valid_until || "",
  };
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const HEADING_FONT = '"Arial Hebrew", "Noto Sans Hebrew", "Heebo", "Rubik", Arial, sans-serif';
const BODY_FONT = '"Arial Hebrew", "Noto Sans Hebrew", "Heebo", "Rubik", Arial, sans-serif';
const BLUE = "#1a56a0";

const pageStyle = {
  width: "210mm",
  minHeight: "297mm",
  padding: "14mm 16mm 20mm 16mm",
  boxSizing: "border-box",
  fontFamily: BODY_FONT,
  fontSize: 12,
  lineHeight: 1.6,
  direction: "rtl",
  backgroundColor: "#fff",
  position: "relative",
  color: "#1a1a1a",
};

// Centered logo + title used on Page 1 only
function CoverHeader({ quoteNumber, logoUrl }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 32, direction: "ltr" }}>
      <img
        src={logoUrl || LOGO_URL_FALLBACK}
        alt="בית הדור הבא"
        style={{ height: 160, width: "auto", marginBottom: 24, display: "block", margin: "0 auto 24px auto" }}
        onError={e => { e.target.style.display = "none"; }}
      />
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, marginBottom: 8, direction: "rtl", letterSpacing: "-0.5px" }}>
        בית הדור הבא – חוות אהרונסון
      </div>
      {quoteNumber && (
        <div style={{ fontSize: 11, color: "#666", marginTop: 4, direction: "rtl", fontFamily: BODY_FONT }}>מס׳ הצעה: {quoteNumber}</div>
      )}
    </div>
  );
}

// Compact header for pages 2 & 3
function CompactHeader({ quoteNumber, logoUrl }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${BLUE}`, paddingBottom: 10, marginBottom: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE }}>בית הדור הבא – חוות אהרונסון</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {quoteNumber && <span style={{ fontSize: 11, color: "#666", fontFamily: BODY_FONT }}>מס׳ הצעה: {quoteNumber}</span>}
        <img
          src={logoUrl || LOGO_URL_FALLBACK}
          alt=""
          style={{ height: 48, width: "auto" }}
          onError={e => { e.target.style.display = "none"; }}
        />
      </div>
    </div>
  );
}

// Section heading matching reference (blue text + full-width bottom border)
function SectionHeading({ children }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, borderBottom: `2px solid ${BLUE}`, paddingBottom: 6, marginTop: 20, marginBottom: 10 }}>
      {children}
    </div>
  );
}

// Table row for client/activity details — matches the bordered row style in the PDF
function DetailTable({ rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, lineHeight: 1.8 }}>
      <tbody>
        {rows.filter(r => r.value && r.value !== "—").map(({ label, value }, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #dde8f5" }}>
            <td style={{ padding: "9px 10px", fontWeight: 700, fontFamily: HEADING_FONT, color: "#333", width: "35%", textAlign: "right" }}>{label}:</td>
            <td style={{ padding: "9px 10px", fontFamily: BODY_FONT, color: "#1a1a1a", textAlign: "right" }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page 1 ────────────────────────────────────────────────────────────────────
function Page1({ d, logoUrl }) {
  return (
    <div style={{ ...pageStyle, pageBreakAfter: "always" }}>
      <CoverHeader quoteNumber={d.quoteNumber} logoUrl={logoUrl} />

      {/* Intro */}
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, marginBottom: 10 }}>
        הצעת מחיר לסמינרים וימי עיון לצוותי חינוך
      </div>
      <p style={{ fontSize: 12, fontFamily: BODY_FONT, color: "#2a2a2a", lineHeight: 1.8, textAlign: "center", marginBottom: 20 }}>
        בית הדור הבא מציע מרחב לחיבור, העמקה ודיאלוג. בהמשך לשיחתנו, להלן הצעתנו עבור פעילות לצוותי חינוך:
      </p>

      {/* Principles */}
      <SectionHeading>עקרונות החוויה בבית הדור הבא:</SectionHeading>
      <div style={{ fontSize: 12, fontFamily: BODY_FONT, lineHeight: 1.9, color: "#2a2a2a", textAlign: "center", marginTop: 10, marginBottom: 12 }}>
        {[
          "– חיבור בין עשייה להעמקה — שילוב בין פעילות מעשית לשיח משמעותי",
          "– מרחב לקול האישי — יצירת הזדמנויות לביטוי אישי ולהקשבה",
          "– רב-מימדיות — שילוב מגוון החושים ליצירת חוויה עמוקה ועוצמתית",
          "– חיבור לערכי הליבה — אהבת המדינה ואנשיה, זיקה ליהדות וערכים ליברליים",
        ].map((t, i) => <div key={i} style={{ marginBottom: 4 }}>{t}</div>)}
      </div>

      {/* Tracks */}
      <SectionHeading>יש לנו שלושה מסלולי תוכן אפשריים:</SectionHeading>
      <div style={{ fontSize: 12, fontFamily: BODY_FONT, lineHeight: 1.9, color: "#2a2a2a", textAlign: "center", marginTop: 10, marginBottom: 12 }}>
        <div style={{ marginBottom: 6 }}><strong style={{ fontFamily: HEADING_FONT, color: BLUE, fontSize: 13 }}>שיבולת</strong> — תוכן מלא של הגוף המתארח, השתלבות בסדר היום של בית הדור הבא</div>
        <div style={{ marginBottom: 6 }}><strong style={{ fontFamily: HEADING_FONT, color: BLUE, fontSize: 13 }}>אלומה</strong> — תוכן של הגוף המתארח, עם סדנה מלאה אחת של בית הדור הבא ביום, והשתלבות בסדר היום של בית הדור הבא</div>
        <div><strong style={{ fontFamily: HEADING_FONT, color: BLUE, fontSize: 13 }}>שדה</strong> — תוכן מלא ומותאם אישית של בית הדור הבא</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, textAlign: "center", marginBottom: 20 }}>עלויות פעילות:</div>

      {/* Client details */}
      <SectionHeading>פרטי לקוח</SectionHeading>
      <DetailTable rows={[
        { label: "שם לקוח",   value: d.clientName },
        { label: "ארגון",     value: d.clientOrg },
        { label: "טלפון",     value: d.clientPhone },
        { label: 'דוא"ל',    value: d.clientEmail },
        { label: "איש קשר",   value: d.contactName },
        ...(d.clientTaxId ? [{ label: "ח.פ / ע.מ", value: d.clientTaxId }] : []),
      ]} />
    </div>
  );
}

// ── Page 2 ────────────────────────────────────────────────────────────────────
const tdBase = { padding: "9px 10px", borderBottom: "1px solid #dde8f5", fontSize: 12, lineHeight: 1.6, verticalAlign: "middle", fontFamily: BODY_FONT, color: "#1a1a1a" };
const thBase = { padding: "10px 10px", background: BLUE, color: "#fff", fontWeight: 700, fontSize: 12, textAlign: "right", fontFamily: HEADING_FONT };

function Page2({ d, logoUrl }) {
  const deposit = d.advance || Math.round(d.totalPrice * 0.3);
  const bal     = d.balance || (d.totalPrice - deposit);

  const dateRange = (d.nights === 0 || !d.departure || d.arrival === d.departure)
    ? fmtDate(d.arrival)
    : `${fmtDate(d.departure)} - ${fmtDate(d.arrival)}`;

  return (
    <div style={{ ...pageStyle, pageBreakAfter: "always" }}>
      <CompactHeader quoteNumber={d.quoteNumber} logoUrl={logoUrl} />

      {/* Activity details table */}
      <SectionHeading>פרטי פעילות</SectionHeading>
      <DetailTable rows={[
        { label: "שם קבוצה",         value: d.groupName },
        { label: "קהל יעד",           value: d.audienceLabel },
        { label: "סוג פעילות",        value: d.activityTypeLabel },
        { label: "תאריכים",           value: dateRange },
        { label: "מס׳ לילות",         value: d.nights > 0 ? String(d.nights) : "יום" },
        { label: 'סה"כ משתתפים',     value: d.totalPax ? String(d.totalPax) : "—" },
      ]} />

      {/* Pricing table */}
      <SectionHeading>פירוט תמחור</SectionHeading>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, width: "42%" }}>פריט</th>
            <th style={{ ...thBase, textAlign: "center", width: "12%" }}>כמות</th>
            <th style={{ ...thBase, textAlign: "center", width: "22%" }}>מחיר יחידה</th>
            <th style={{ ...thBase, textAlign: "left",   width: "24%" }}>סה״כ</th>
          </tr>
        </thead>
        <tbody>
          {d.lineItems.map((item, i) => {
            const isDiscount = item.isAdjustment && item.total < 0;
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f5f8ff" }}>
                <td style={{ ...tdBase }}>{item.name}</td>
                <td style={{ ...tdBase, textAlign: "center" }}>{item.qty}</td>
                <td style={{ ...tdBase, textAlign: "center" }}>
                  ₪{fmt(item.unitPrice)}
                </td>
                <td style={{ ...tdBase, textAlign: "left", fontWeight: 600, color: isDiscount ? "#c00" : "#111" }}>
                  {item.vatAmount
                    ? `₪${fmt(item.unitPrice)} + ₪${fmt(item.vatAmount)} מע״מ`
                    : isDiscount
                      ? `-₪${fmt(Math.abs(item.total))}`
                      : `₪${fmt(item.total)}`
                  }
                </td>
              </tr>
            );
          })}

          {/* Subtotal row (only when there's a discount) */}
          {d.discountAmt > 0 && (
            <tr style={{ background: "#f0f4fb" }}>
              <td colSpan={3} style={{ ...tdBase, fontWeight: 700, textAlign: "right" }}>סה״כ לפני הנחה</td>
              <td style={{ ...tdBase, textAlign: "left", fontWeight: 700 }}>₪{fmt(d.subtotal)}</td>
            </tr>
          )}
          {/* Discount row */}
          {d.discountAmt > 0 && (
            <tr style={{ background: "#fff8f8" }}>
              <td colSpan={3} style={{ ...tdBase, color: "#c00" }}>
                הנחה {d.discountPct}%{d.paymentTerms ? ` (${d.paymentTerms})` : ""}
              </td>
              <td style={{ ...tdBase, textAlign: "left", color: "#c00", fontWeight: 600 }}>-₪{fmt(d.discountAmt)}</td>
            </tr>
          )}
          {/* Grand total row */}
          <tr style={{ background: "#e8f0fc" }}>
            <td colSpan={3} style={{ ...tdBase, fontWeight: 800, fontSize: 13, color: BLUE }}>סה״כ לתשלום</td>
            <td style={{ ...tdBase, textAlign: "left", fontWeight: 800, fontSize: 13, color: BLUE }}>₪{fmt(d.totalPrice)}</td>
          </tr>
        </tbody>
      </table>

      {/* Payment terms */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, marginBottom: 12 }}>תנאי תשלום</div>
        <div style={{ fontSize: 12, fontFamily: BODY_FONT, lineHeight: 1.9 }}>
          <div style={{ marginBottom: 6 }}>מקדמה (30%): <strong>₪{fmt(deposit)}</strong></div>
          <div>יתרה (70%): <strong>₪{fmt(bal)}</strong></div>
        </div>
      </div>

      {/* Meta + bank */}
      <div style={{ marginTop: 20, fontSize: 11, fontFamily: BODY_FONT, color: "#555", lineHeight: 1.9 }}>
        <div>גרסה: {d.version} | סטטוס: {d.status}</div>
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontFamily: HEADING_FONT }}>ח.פ:</strong> קרן שמש הדור הבא (ע"ר) — 580786812
        </div>
        <div>
          <strong style={{ fontFamily: HEADING_FONT }}>פרטי חשבון הבנק:</strong> קרן שמש הדור הבא (ע"ר) בנק הפועלים- 12 סניף- 170 חשבון- 368365
        </div>
      </div>
    </div>
  );
}

// ── Page 3 ────────────────────────────────────────────────────────────────────
function TermBlock({ title, bullets }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, marginBottom: 8 }}>{title}</div>
      {bullets.map((b, i) => (
        <div key={i} style={{ fontSize: 12, fontFamily: BODY_FONT, color: "#2a2a2a", lineHeight: 1.7, paddingRight: 4, marginBottom: 4 }}>
          {bullets.length > 1 ? `• ${b}` : b}
        </div>
      ))}
    </div>
  );
}

function SigLine({ label, wide }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "flex-end", gap: 8, marginLeft: wide ? 0 : 24, marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: BODY_FONT, whiteSpace: "nowrap" }}>{label}:</span>
      <span style={{ display: "inline-block", width: wide ? 180 : 120, borderBottom: "1px solid #555" }}>&nbsp;</span>
    </div>
  );
}

function Page3({ logoUrl, footerUrl }) {
  return (
    <div style={{ ...pageStyle }}>
      <CompactHeader logoUrl={logoUrl} />

      <SectionHeading>תנאי ההסכם</SectionHeading>
      <div style={{ marginTop: 12 }}>

        <TermBlock title="כללי" bullets={[
          "הצעת המחיר תקפה למשך 14 יום מיום שליחתה בכתב.",
          "רק שליחה חזרה של מסמך זה חתום משמעה סגירת ההזמנה.",
        ]} />

        <TermBlock title="תשלום" bullets={[
          "תשלום מקדמה - בסך 30% מערך העסקה - ישולם חודש לפני הגעה | שאר התשלום - 70% מערך העסקה - ישולם ביום ההגעה.",
        ]} />

        <TermBlock title="ביטול עסקה" bullets={[
          "עד 7 ימים לפני ההגעה - ייגבו דמי ביטול בסך 5% או 100 ש״ח - הנמוך מביניהם",
          "פחות מ-7 ימים לפני ההגעה - ייגבו דמי ביטול בסך של 25% מערך ההזמנה",
        ]} />

        <TermBlock title="שינויים" bullets={[
          "ניתן לעשות שינויים בהזמנה לרבות מספר משתתפים וארוחות עד 10 ימים לפני הפעילות בבית",
          "דרישת התשלום תישלח לפי מספר המשתתפים שנמסר 10 ימים לפני תחילת הפעילות או לפי מספר המגיעים בפועל - לפי הגבוה מביניהם",
          "ניתן לעדכן בהעדפות ואלרגיות למזון עד 10 ימים לפני, לאחר מכן לא ניתן להבטיח שיהיה אוכל מתאים",
        ]} />

        <TermBlock title="כללי הבית" bullets={[
          "לא ניתן להכניס אוכל מכל סוג לבית הדור הבא",
          "כל נזק לציוד או מתקני הבית יחויב בעלות תיקון הנזק",
        ]} />
      </div>

      {/* Signature block — inline style matching the reference */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, marginBottom: 16 }}>אישור ההצעה וחתימה</div>
        <div style={{ marginBottom: 20 }}>
          <SigLine label="שם מלא" />
          <SigLine label="תפקיד" />
          <SigLine label="חתימה" />
        </div>
        <div>
          <SigLine label="שם הגוף המשלם" wide />
          <SigLine label="ח.פ / ע.ר" wide />
        </div>
      </div>

      {/* Footer text + photo */}
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: HEADING_FONT, color: BLUE, marginBottom: 14 }}>מחכים לכם בבית הדור הבא</div>
        <div style={{ display: "inline-block", width: "65%" }}>
          <img
            src={footerUrl || FOOTER_URL_FALLBACK}
            alt="חוות אהרונסון"
            style={{ width: "100%", height: "auto", maxHeight: 220, objectFit: "cover", borderRadius: 6, display: "block" }}
            onError={e => { e.target.parentElement.style.display = "none"; }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function QuotePdfTemplate({ quote, group, logoUrl, footerUrl }) {
  const d = resolveData(quote, group);
  return (
    <div id="quote-pdf-root" style={{ background: "#fff" }}>
      <Page1 d={d} logoUrl={logoUrl} />
      <Page2 d={d} logoUrl={logoUrl} />
      <Page3 logoUrl={logoUrl} footerUrl={footerUrl} />
    </div>
  );
}