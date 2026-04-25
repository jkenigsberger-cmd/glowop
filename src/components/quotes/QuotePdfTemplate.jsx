/**
 * QuotePdfTemplate
 * A printable A4 RTL Hebrew document — 3 logical pages.
 * Rendered into a hidden div and printed via window.print().
 * No jsPDF used — Hebrew rendering via native browser print.
 */

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("he-IL");
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("he-IL"); } catch { return d; }
};
const parse = (str, fb = []) => { try { const r = JSON.parse(str); return Array.isArray(r) ? r : fb; } catch { return fb; } };

// ── Safe resolvers: snapshot first, then quote direct fields ──────────────────
function resolveData(quote, group) {
  let snap = null;
  try { snap = quote?.snapshot ? JSON.parse(quote.snapshot) : null; } catch {}

  const arrival   = quote?.arrival_date   || snap?.startDate   || group?.arrival_date   || "";
  const departure = quote?.departure_date || snap?.endDate     || group?.departure_date  || "";
  const nights    = (arrival && departure)
    ? Math.max(0, Math.round((new Date(departure) - new Date(arrival)) / 86400000))
    : (quote?.nights ?? 0);

  const studentLines  = parse(quote?.student_lodging_lines);
  const adultLines    = parse(quote?.adult_lodging_lines);
  const workshopLines = parse(quote?.workshop_lines);
  const lectureLines  = parse(quote?.lecture_lines);
  const addonLines    = parse(quote?.addon_lines);
  const adjustLines   = parse(quote?.adjustment_lines);
  const coffeeCornerPax = Number(quote?.coffee_corner_pax || 0);

  // Build unified line items for the pricing table
  const lineItems = [];

  const STUDENT_RATES = { day_activity: { label: "יום פעילות", rate: 125 }, midweek_lodging: { label: "לינה אמצע שבוע", rate: 190 }, weekend_lodging: { label: "לינה סוף שבוע", rate: 250 } };
  const ADULT_RATES   = { BED3: { label: "אוהל 3 מיטות", rate: 340 }, BED68: { label: "אוהל 6/8 מיטות", rate: 250 } };

  studentLines.forEach(r => {
    const rateInfo = STUDENT_RATES[r.rate_type];
    const isDay = r.rate_type === "day_activity";
    const qty = isDay ? Number(r.pax) : Number(r.pax) * Number(r.nights);
    const unitRate = rateInfo?.rate ?? Number(r.rate ?? 0);
    const total = qty * unitRate;
    lineItems.push({
      name: rateInfo?.label || r.rate_type,
      detail: isDay ? `${r.pax} משתתפים` : `${r.pax} משתתפים × ${r.nights} לילות`,
      qty: isDay ? r.pax : `${r.pax}×${r.nights}`,
      unitPrice: unitRate,
      total,
      vatAmount: null,
    });
  });

  adultLines.forEach(r => {
    const rateInfo = ADULT_RATES[r.tent_type];
    const rate = rateInfo?.rate ?? Number(r.rate_per_tent_per_night ?? 0);
    const total = Number(r.tent_count) * Number(r.nights) * rate;
    lineItems.push({
      name: rateInfo?.label || r.tent_type,
      detail: `${r.tent_count} אוהלים × ${r.nights} לילות`,
      qty: `${r.tent_count}×${r.nights}`,
      unitPrice: rate,
      total,
      vatAmount: null,
    });
  });

  workshopLines.forEach(r => {
    lineItems.push({
      name: r.name,
      detail: r.audience === "ADULTS" ? "מבוגרים" : "תלמידים",
      qty: 1,
      unitPrice: Number(r.rate ?? 0),
      total: Number(r.rate ?? 0),
      vatAmount: null,
    });
  });

  lectureLines.forEach(r => {
    const base = Number(r.base_price ?? 0);
    const vatAmount = r.vat_included ? Math.round(base * 0.18) : null;
    const total = r.vat_included ? base + vatAmount : base;
    lineItems.push({
      name: r.name,
      detail: r.lecturer || "",
      qty: 1,
      unitPrice: base,
      total,
      vatAmount,
    });
  });

  if (coffeeCornerPax > 0) {
    const coffeeTotal = coffeeCornerPax * 15;
    lineItems.push({
      name: "פינת קפה ועוגיות",
      detail: `${coffeeCornerPax} אנשי צוות × ₪15`,
      qty: coffeeCornerPax,
      unitPrice: 15,
      total: coffeeTotal,
      vatAmount: null,
    });
  }

  addonLines.forEach(r => {
    lineItems.push({
      name: r.description || "תוספת",
      detail: "",
      qty: Number(r.quantity ?? 1),
      unitPrice: Number(r.unit_price ?? 0),
      total: Number(r.quantity ?? 1) * Number(r.unit_price ?? 0),
      vatAmount: null,
    });
  });

  adjustLines.forEach(r => {
    const amt = Number(r.amount || 0);
    lineItems.push({
      name: r.description || "התאמה",
      detail: "",
      qty: 1,
      unitPrice: amt,
      total: amt,
      vatAmount: null,
      isAdjustment: true,
    });
  });

  const subtotal       = Number(quote?.subtotal ?? 0);
  const discountPct    = Number(quote?.discount_percent ?? 0);
  const discountAmt    = Number(quote?.discount_amount ?? 0);
  const totalPrice     = Number(quote?.total_price ?? 0);
  const advance        = Number(quote?.advance_payment ?? Math.round(totalPrice * 0.3));
  const balance        = Number(quote?.balance_payment ?? (totalPrice - advance));

  return {
    // Client
    clientName:   snap?.clientName  || quote?.client_name  || group?.contact_name  || "—",
    clientOrg:    snap?.clientOrg   || quote?.client_name  || group?.group_name    || "—",
    clientPhone:  snap?.clientPhone || quote?.client_phone || group?.contact_phone || "—",
    clientEmail:  snap?.clientEmail || quote?.client_email || group?.contact_email || "—",
    clientTaxId:  snap?.clientTaxId || quote?.client_tax_id || "",
    contactName:  snap?.clientName  || quote?.client_name  || group?.contact_name  || "—",
    // Group / Activity
    groupName:    snap?.groupName   || snap?.group_name    || group?.group_name    || quote?.client_name || "—",
    groupType:    group?.group_type === "DAY_USE" ? "יום כיף" : "לינה",
    // Dates
    arrival,
    departure,
    nights,
    totalPax:     snap?.totalPax    ?? quote?.estimated_pax ?? group?.total_pax ?? "—",
    // Pricing
    lineItems,
    subtotal,
    discountPct,
    discountAmt,
    totalPrice,
    advance,
    balance,
    paymentTerms: quote?.payment_terms || "",
    // Meta
    quoteNumber: quote?.quote_number || "",
    version:     quote?.version ?? 1,
    status:      quote?.status || "",
    validUntil:  quote?.valid_until || "",
  };
}

// ── Styled sections ───────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{ borderBottom: "2px solid #1a56a0", marginBottom: 8, paddingBottom: 4, marginTop: 20 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#1a56a0" }}>{children}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value || value === "—" && !label) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
      <span style={{ minWidth: 120, fontSize: 11, color: "#555", fontWeight: 600 }}>{label}:</span>
      <span style={{ fontSize: 11, color: "#1a1a1a" }}>{value}</span>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{ margin: "8px 0 8px 0", paddingRight: 20, fontSize: 11, lineHeight: 1.9, color: "#2d2d2d" }}>
      {items.map((item, i) => (
        <li key={i} style={{ listStyle: "disc", marginBottom: 2 }}>{item}</li>
      ))}
    </ul>
  );
}

function Page({ children, isLast }) {
  return (
    <div style={{
      width: "210mm",
      minHeight: "297mm",
      padding: "18mm 16mm 14mm 16mm",
      boxSizing: "border-box",
      fontFamily: "'Arial Hebrew', 'Segoe UI', Arial, sans-serif",
      direction: "rtl",
      backgroundColor: "#fff",
      pageBreakAfter: isLast ? "auto" : "always",
      position: "relative",
    }}>
      {children}
    </div>
  );
}

function DocHeader({ quoteNumber }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, borderBottom: "3px solid #1a56a0", paddingBottom: 12 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1a56a0", lineHeight: 1.2 }}>הצעת מחיר לסמינרים וימי עיון</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#333", marginTop: 3 }}>לצוותי חינוך</div>
        {quoteNumber && <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>מס׳ הצעה: {quoteNumber}</div>}
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a56a0" }}>בית הדור הבא</div>
        <div style={{ fontSize: 11, color: "#555" }}>חוות אהרונסון</div>
      </div>
    </div>
  );
}

function PageFooter() {
  return (
    <div style={{ position: "absolute", bottom: "12mm", left: "16mm", right: "16mm", borderTop: "1px solid #ddd", paddingTop: 6, textAlign: "center" }}>
      <span style={{ fontSize: 9, color: "#888" }}>בית הדור הבא – חוות אהרונסון | ח.פ: קרן שמש הדור הבא (ע"ר) — 580786812</span>
    </div>
  );
}

// ── Page 1 ────────────────────────────────────────────────────────────────────
function Page1({ d }) {
  return (
    <Page>
      <DocHeader quoteNumber={d.quoteNumber} />

      <p style={{ fontSize: 11, color: "#333", lineHeight: 1.7, marginBottom: 14 }}>
        בית הדור הבא מציע מרחב לחיבור, העמקה ודיאלוג. בהמשך לשיחתנו, להלן הצעתנו עבור פעילות לצוותי חינוך:
      </p>

      <SectionTitle>עקרונות החוויה בבית הדור הבא:</SectionTitle>
      <BulletList items={[
        "חיבור בין עשייה להעמקה — שילוב בין פעילות מעשית לשיח משמעותי",
        "מרחב לקול האישי — יצירת הזדמנויות לביטוי אישי ולהקשבה",
        "רב-מימדיות — שילוב מגוון החושים ליצירת חוויה עמוקה ועוצמתית",
        "חיבור לערכי הליבה — אהבת המדינה ואנשיה, זיקה ליהדות וערכים ליברליים",
      ]} />

      <SectionTitle>יש לנו שלושה מסלולי תוכן אפשריים:</SectionTitle>
      <div style={{ fontSize: 11, lineHeight: 1.9, color: "#2d2d2d", marginBottom: 6 }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: "#1a56a0" }}>שיבולת —</span>{" "}
          תוכן מלא של הגוף המתארח, השתלבות בסדר היום של בית הדור הבא
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: "#1a56a0" }}>אלומה —</span>{" "}
          תוכן של הגוף המתארח, עם סדנה מלאה אחת של בית הדור הבא ביום, והשתלבות בסדר היום של בית הדור הבא
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: "#1a56a0" }}>שדה —</span>{" "}
          תוכן מלא ומותאם אישית של בית הדור הבא
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#1a56a0", margin: "12px 0 4px 0" }}>עלויות פעילות:</div>

      {/* Two-column layout for client + activity */}
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <div style={{ flex: 1, background: "#f5f8ff", border: "1px solid #c7d8f5", borderRadius: 6, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a56a0", marginBottom: 8, borderBottom: "1px solid #c7d8f5", paddingBottom: 4 }}>פרטי לקוח</div>
          <InfoRow label="שם לקוח" value={d.clientName} />
          <InfoRow label="ארגון" value={d.clientOrg !== d.clientName ? d.clientOrg : undefined} />
          <InfoRow label="טלפון" value={d.clientPhone} />
          <InfoRow label="דוא״ל" value={d.clientEmail} />
          <InfoRow label="איש קשר" value={d.contactName} />
          {d.clientTaxId && <InfoRow label="ח.פ / ע.מ" value={d.clientTaxId} />}
        </div>

        <div style={{ flex: 1, background: "#f5f8ff", border: "1px solid #c7d8f5", borderRadius: 6, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a56a0", marginBottom: 8, borderBottom: "1px solid #c7d8f5", paddingBottom: 4 }}>פרטי פעילות</div>
          <InfoRow label="שם קבוצה" value={d.groupName} />
          <InfoRow label="סוג פעילות" value={d.groupType} />
          <InfoRow label="תאריך הגעה" value={fmtDate(d.arrival)} />
          <InfoRow label="תאריך עזיבה" value={fmtDate(d.departure)} />
          <InfoRow label="מס׳ לילות" value={d.nights > 0 ? String(d.nights) : "יום"} />
          <InfoRow label="סה״כ משתתפים" value={d.totalPax ? String(d.totalPax) : "—"} />
        </div>
      </div>

      <PageFooter />
    </Page>
  );
}

// ── Page 2 ────────────────────────────────────────────────────────────────────
const tdStyle = { padding: "7px 10px", borderBottom: "1px solid #e0e8f5", fontSize: 11, verticalAlign: "middle" };
const thStyle = { ...tdStyle, background: "#1a56a0", color: "#fff", fontWeight: 700, fontSize: 11 };

function Page2({ d }) {
  const deposit = d.advance || Math.round(d.totalPrice * 0.3);
  const bal     = d.balance || (d.totalPrice - deposit);

  return (
    <Page>
      <DocHeader quoteNumber={d.quoteNumber} />

      <SectionTitle>פירוט תמחור</SectionTitle>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, border: "1px solid #c7d8f5" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "right", width: "40%" }}>פריט</th>
            <th style={{ ...thStyle, textAlign: "center", width: "20%" }}>פירוט</th>
            <th style={{ ...thStyle, textAlign: "center", width: "15%" }}>מחיר יחידה</th>
            <th style={{ ...thStyle, textAlign: "left", width: "15%" }}>סה״כ</th>
          </tr>
        </thead>
        <tbody>
          {d.lineItems.map((item, i) => {
            const bg = i % 2 === 0 ? "#fff" : "#f5f8ff";
            return (
              <tr key={i} style={{ background: bg }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                <td style={{ ...tdStyle, textAlign: "center", color: "#666" }}>{item.detail}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {item.vatAmount
                    ? `₪${fmt(item.unitPrice)} + ₪${fmt(item.vatAmount)} מע״מ`
                    : item.isAdjustment
                      ? (item.unitPrice < 0 ? `(₪${fmt(Math.abs(item.unitPrice))})` : `₪${fmt(item.unitPrice)}`)
                      : `₪${fmt(item.unitPrice)}`
                  }
                </td>
                <td style={{ ...tdStyle, textAlign: "left", fontWeight: 600, color: item.isAdjustment && item.total < 0 ? "#c00" : "#1a1a1a" }}>
                  {item.total < 0 ? `(₪${fmt(Math.abs(item.total))})` : `₪${fmt(item.total)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals block */}
      <div style={{ marginTop: 12, borderTop: "2px solid #1a56a0", paddingTop: 10 }}>
        {d.subtotal > 0 && d.discountAmt > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", fontSize: 12 }}>
            <span style={{ color: "#555" }}>סה״כ לפני הנחה</span>
            <span style={{ fontWeight: 600 }}>₪{fmt(d.subtotal)}</span>
          </div>
        )}
        {d.discountAmt > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", fontSize: 12, color: "#c00" }}>
            <span>הנחה ({d.discountPct}%)</span>
            <span style={{ fontWeight: 600 }}>−₪{fmt(d.discountAmt)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#1a56a0", borderRadius: 6, marginTop: 6 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>סה״כ לתשלום</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>₪{fmt(d.totalPrice)}</span>
        </div>
      </div>

      {/* Payment terms */}
      <SectionTitle>תנאי תשלום</SectionTitle>
      <div style={{ background: "#f5f8ff", border: "1px solid #c7d8f5", borderRadius: 6, padding: "10px 12px", fontSize: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>מקדמה (30%):</span>
          <span style={{ fontWeight: 700, color: "#1a56a0" }}>₪{fmt(deposit)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600 }}>יתרה (70%):</span>
          <span style={{ fontWeight: 700 }}>₪{fmt(bal)}</span>
        </div>
        {d.paymentTerms && (
          <div style={{ marginTop: 8, color: "#555", fontSize: 10 }}>{d.paymentTerms}</div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 10, color: "#666", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600 }}>גרסה: {d.version} | סטטוס: {d.status}</div>
        {d.validUntil && <div>בתוקף עד: {fmtDate(d.validUntil)}</div>}
      </div>

      {/* Bank details */}
      <div style={{ marginTop: 14, background: "#f0f4fb", border: "1px solid #c7d8f5", borderRadius: 6, padding: "10px 12px", fontSize: 11 }}>
        <div style={{ fontWeight: 700, color: "#1a56a0", marginBottom: 6 }}>פרטי חשבון בנק</div>
        <div>קרן שמש הדור הבא (ע"ר)</div>
        <div>בנק הפועלים — 12 | סניף — 170 | חשבון — 368365</div>
        <div style={{ marginTop: 4, color: "#555", fontSize: 10 }}>ח.פ: קרן שמש הדור הבא (ע"ר) — 580786812</div>
      </div>

      <PageFooter />
    </Page>
  );
}

// ── Page 3 ────────────────────────────────────────────────────────────────────
function TermsSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#1a56a0", marginBottom: 4, borderBottom: "1px solid #c7d8f5", paddingBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: "#2d2d2d", lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

function Page3() {
  return (
    <Page isLast>
      <DocHeader />

      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a56a0", marginBottom: 16, textAlign: "center" }}>תנאי ההסכם</div>

      <TermsSection title="כללי">
        <p>הצעת המחיר תקפה למשך 14 יום מיום שליחתה בכתב.</p>
        <p>רק שליחה חזרה של מסמך זה חתום משמעה סגירת ההזמנה.</p>
      </TermsSection>

      <TermsSection title="תשלום">
        <p>תשלום מקדמה - בסך 30% מערך העסקה - ישולם חודש לפני הגעה</p>
        <p>שאר התשלום - 70% מערך העסקה - ישולם ביום ההגעה.</p>
      </TermsSection>

      <TermsSection title="ביטול עסקה">
        <p>עד 7 ימים לפני ההגעה - ייגבו דמי ביטול בסך 5% או 100 ש״ח - הנמוך מביניהם</p>
        <p>פחות מ-7 ימים לפני ההגעה - ייגבו דמי ביטול בסך של 25% מערך ההזמנה</p>
      </TermsSection>

      <TermsSection title="שינויים">
        <p>ניתן לעשות שינויים בהזמנה לרבות מספר משתתפים וארוחות עד 10 ימים לפני הפעילות בבית</p>
        <p>דרישת התשלום תישלח לפי מספר המשתתפים שנמסר 10 ימים לפני תחילת הפעילות או לפי מספר המגיעים בפועל - לפי הגבוה מביניהם</p>
        <p>ניתן לעדכן בהעדפות ואלרגיות למזון עד 10 ימים לפני, לאחר מכן לא ניתן להבטיח שיהיה אוכל מתאים</p>
      </TermsSection>

      <TermsSection title="כללי הבית">
        <p>לא ניתן להכניס אוכל מכל סוג לבית הדור הבא</p>
        <p>כל נזק לציוד או מתקני הבית יחויב בעלות תיקון הנזק</p>
      </TermsSection>

      {/* Signature block */}
      <div style={{ marginTop: 20, border: "1px solid #c7d8f5", borderRadius: 6, padding: "12px 14px", background: "#f5f8ff" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a56a0", marginBottom: 12, borderBottom: "1px solid #c7d8f5", paddingBottom: 4 }}>אישור ההצעה וחתימה</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
          {["שם מלא", "תפקיד", "שם הגוף המשלם", "ח.פ / ע.ר"].map(label => (
            <div key={label} style={{ borderBottom: "1px solid #999", paddingBottom: 4 }}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 14 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, borderBottom: "1px solid #999", paddingBottom: 4 }}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 20 }}>חתימה</div>
        </div>
      </div>

      {/* Footer message */}
      <div style={{ marginTop: 28, textAlign: "center", fontSize: 14, fontWeight: 700, color: "#1a56a0" }}>
        מחכים לכם בבית הדור הבא 🌱
      </div>

      <PageFooter />
    </Page>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function QuotePdfTemplate({ quote, group }) {
  const d = resolveData(quote, group);

  return (
    <div id="quote-pdf-root" style={{ background: "#fff" }}>
      <Page1 d={d} />
      <Page2 d={d} />
      <Page3 />
    </div>
  );
}