import { PACKAGE_CATALOG, MEAL_ADDON_CATALOG, OPERATOR_ADDON_CATALOG, CONTENT_ADDON_CATALOG } from "@/lib/quoteCatalog";
const parse = value => { try { return JSON.parse(value || "[]"); } catch { return []; } };
const money = value => `₪${Math.round(Number(value) || 0).toLocaleString("he-IL")}`;
export default function CombinedQuoteOptionSection({ quote, optionKey }) {
  const catalog = [...MEAL_ADDON_CATALOG, ...OPERATOR_ADDON_CATALOG, ...CONTENT_ADDON_CATALOG];
  const rows = [
    ...parse(quote.package_lines).map(x => ({ name: PACKAGE_CATALOG.find(p => p.id === x.package_id)?.name || x.package_id, total: Number(x.quantity || 0) * Number(x.unit_price || 0) + (x.shirley_addon ? 5000 : 0) })),
    ...parse(quote.new_addon_lines).map(x => ({ name: catalog.find(p => p.id === x.addon_id)?.label || x.addon_id, total: Number(x.quantity || 0) * Number(x.unit_price || 0) })),
    ...parse(quote.student_lodging_lines).map(x => ({ name: "אירוח תלמידים", total: Number(x.pax || 0) * Number(x.nights || 1) * Number(x.rate || 0) })),
    ...parse(quote.adult_lodging_lines).map(x => ({ name: "אירוח מבוגרים", total: Number(x.tent_count || 0) * Number(x.nights || 1) * Number(x.rate_per_tent_per_night || 0) })),
    ...parse(quote.workshop_lines).map(x => ({ name: `סדנה: ${x.name}`, total: Number(x.rate || 0) })),
    ...parse(quote.lecture_lines).map(x => ({ name: `הרצאה: ${x.name}`, total: Number(x.base_price || 0) * (x.vat_included ? 1.18 : 1) })),
    ...parse(quote.addon_lines).map(x => ({ name: x.description || "תוספת", total: Number(x.quantity || 1) * Number(x.unit_price || 0) })),
    ...parse(quote.adjustment_lines).map(x => ({ name: x.description || "התאמה", total: Number(x.quantity || 1) * Number(x.unit_price ?? x.amount ?? 0) })),
  ];
  return <section style={{ breakInside: "avoid", marginTop: 18 }}><h2 style={{ color: "#1a56a0", borderBottom: "2px solid #1a56a0", paddingBottom: 5 }}>אפשרות {optionKey === "A" ? "א׳" : "ב׳"}</h2><table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>{rows.map((row, i) => <tr key={i}><td style={{ padding: 6, borderBottom: "1px solid #dde8f5" }}>{row.name}</td><td style={{ padding: 6, borderBottom: "1px solid #dde8f5", textAlign: "left" }}>{money(row.total)}</td></tr>)}</tbody></table><div style={{ marginTop: 8, padding: 10, background: "#e8f0fc", color: "#1a56a0", fontWeight: 700 }}>סה״כ אפשרות {optionKey === "A" ? "א׳" : "ב׳"}: {money(quote.total_price)}</div>{quote.client_notes && <p style={{ whiteSpace: "pre-wrap" }}>{quote.client_notes}</p>}</section>;
}