export const QUOTE_OPTION_FIELDS = [
  "package_lines", "new_addon_lines", "student_lodging_lines", "adult_lodging_lines",
  "workshop_lines", "lecture_lines", "coffee_corner_pax", "includes_prisa", "addon_lines",
  "adjustment_lines", "surcharge_lines", "discount_percent", "subtotal", "discount_amount",
  "total_price", "advance_payment", "balance_payment", "payment_terms", "option_notes",
];

export function extractQuoteOptionPayload(quote = {}) {
  return Object.fromEntries(QUOTE_OPTION_FIELDS.map(field => [field, quote[field]]));
}

export function applyOptionPayloadToQuote(quote, payload = {}) {
  const next = { ...quote };
  QUOTE_OPTION_FIELDS.forEach(field => { if (field in payload) next[field] = payload[field]; });
  return next;
}

export function getEffectiveQuoteForOption(quote, option) {
  if (!option) return quote;
  const payload = typeof option.option_payload === "string" ? JSON.parse(option.option_payload || "{}") : option.option_payload;
  return applyOptionPayloadToQuote(quote, payload);
}

export function createEmptyQuoteOption() {
  return {
    package_lines: "[]", new_addon_lines: "[]", student_lodging_lines: "[]", adult_lodging_lines: "[]",
    workshop_lines: "[]", lecture_lines: "[]", coffee_corner_pax: 0, includes_prisa: false,
    addon_lines: "[]", adjustment_lines: "[]", surcharge_lines: "[]", discount_percent: 0,
    subtotal: 0, discount_amount: 0, total_price: 0, advance_payment: 0, balance_payment: 0,
    payment_terms: "", option_notes: "",
  };
}