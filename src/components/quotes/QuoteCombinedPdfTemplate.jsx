import { getQuoteAudienceContent } from "@/lib/quoteAudience";
import CombinedQuoteOptionSection from "./CombinedQuoteOptionSection";
const date = value => value ? new Date(value).toLocaleDateString("he-IL") : "—";
export default function QuoteCombinedPdfTemplate({ quote, optionA, optionB, logoUrl }) {
  const audience = getQuoteAudienceContent(quote.quote_audience_type);
  return <div id="quote-pdf-root" style={{ width: "210mm", minHeight: "297mm", boxSizing: "border-box", padding: "12mm 16mm", direction: "rtl", background: "white", color: "#1a1a1a", fontFamily: '"SimplerPro", Arial, sans-serif', fontSize: 12 }}>
    <header style={{ textAlign: "center", borderBottom: "2px solid #1a56a0", paddingBottom: 10 }}><img src={logoUrl} alt="בית הדור הבא" style={{ height: 80 }} /><h1 style={{ color: "#1a56a0", margin: "6px 0" }}>בית הדור הבא – חוות אהרונסון</h1><strong style={{ color: "#1a56a0" }}>{audience.subtitle}</strong><p>{audience.intro}</p></header>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 14 }}><section><h2 style={{ color: "#1a56a0" }}>פרטי לקוח</h2><p><b>שם לקוח / ארגון:</b> {quote.client_name}</p>{quote.contact_person && <p><b>איש קשר:</b> {quote.contact_person}</p>}{quote.client_phone && <p><b>טלפון:</b> {quote.client_phone}</p>}{quote.client_email && <p><b>דוא״ל:</b> {quote.client_email}</p>}</section><section><h2 style={{ color: "#1a56a0" }}>פרטי פעילות</h2>{quote.group_name?.trim() && <p><b>שם קבוצה:</b> {quote.group_name}</p>}<p><b>תאריכים:</b> {date(quote.arrival_date)} – {date(quote.departure_date || quote.arrival_date)}</p><p><b>סה״כ משתתפים:</b> {quote.estimated_pax || 0}</p></section></div>
    <CombinedQuoteOptionSection quote={optionA} optionKey="A" /><CombinedQuoteOptionSection quote={optionB} optionKey="B" />
    <section style={{ breakInside: "avoid", marginTop: 24, borderTop: "2px solid #1a56a0", paddingTop: 12 }}><h2 style={{ color: "#1a56a0" }}>תנאי ההסכם ואישור</h2><p>הצעת המחיר תקפה למשך 14 יום מיום שליחתה בכתב. רק שליחה חזרה של מסמך זה חתום משמעה סגירת ההזמנה.</p><p>שם מלא: ____________________ תפקיד: ____________________ חתימה: ____________________</p></section>
  </div>;
}