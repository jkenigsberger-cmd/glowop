// Shared labels + helpers for פריסה (Prisa) requests.

export const PRISA_TYPE_LABELS = {
  REGULAR: "רגיל",
  DOUBLE: "כפול",
};

export const PRISA_SLOT_LABELS = {
  AFTER_BREAKFAST: "אחרי ארוחת בוקר",
  AFTER_LUNCH: "אחרי ארוחת צהריים",
  AFTER_DINNER: "אחרי ארוחת ערב",
};

export const PRISA_SLOT_ORDER = {
  AFTER_BREAKFAST: 0,
  AFTER_LUNCH: 1,
  AFTER_DINNER: 2,
};

// effective_quantity = quantity (REGULAR) or quantity*2 (DOUBLE)
export function computeEffectiveQuantity(quantity, type) {
  const q = Number(quantity) || 0;
  return type === "DOUBLE" ? q * 2 : q;
}