import {
  CONTENT_ADDON_CATALOG, MEAL_ADDON_CATALOG, OPERATOR_ADDON_CATALOG,
  calcAddonLine, calcPackageLine, resolvePackageUnitPrice,
} from "@/lib/quoteCatalog";

const parseLines = value => { try { const rows = JSON.parse(value || "[]"); return Array.isArray(rows) ? rows : []; } catch { return []; } };
const perPersonAddonIds = new Set([...MEAL_ADDON_CATALOG, ...OPERATOR_ADDON_CATALOG].map(item => item.id));
export const isPaxLinkedAddon = line => perPersonAddonIds.has(line?.addon_id) && !CONTENT_ADDON_CATALOG.some(item => item.id === line?.addon_id);
const inferMode = (line, savedPax) => line.quantity_mode || (Number(line.quantity) === Number(savedPax) ? "AUTO" : "MANUAL");

export function normalizeCatalogLines(packageLines, addonLines, savedPax) {
  return {
    packageLines: packageLines.map(line => ({ ...line, quantity_mode: inferMode(line, savedPax) })),
    addonLines: addonLines.map(line => isPaxLinkedAddon(line) ? { ...line, quantity_mode: inferMode(line, savedPax) } : line),
  };
}

export function syncAutoCatalogLines(packageLines, addonLines, pax) {
  return {
    packageLines: packageLines.map(line => line.quantity_mode !== "AUTO" ? line : {
      ...line, quantity: pax,
      unit_price: line.price_overridden ? line.unit_price : resolvePackageUnitPrice(line.package_id, line.option_id, pax),
    }),
    addonLines: addonLines.map(line => isPaxLinkedAddon(line) && line.quantity_mode === "AUTO" ? { ...line, quantity: pax } : line),
  };
}

export function normalizeOptionPayload(payload, savedPax) {
  const normalized = normalizeCatalogLines(parseLines(payload.package_lines), parseLines(payload.new_addon_lines), savedPax);
  return { ...payload, package_lines: JSON.stringify(normalized.packageLines), new_addon_lines: JSON.stringify(normalized.addonLines) };
}

export function syncOptionPayloadPax(payload, pax, previousPax = pax) {
  const oldPackages = parseLines(payload.package_lines), oldAddons = parseLines(payload.new_addon_lines);
  const synced = syncAutoCatalogLines(oldPackages, oldAddons, pax);
  const oldTotal = oldPackages.reduce((sum, line) => sum + calcPackageLine(line), 0) + oldAddons.reduce((sum, line) => sum + calcAddonLine(line), 0);
  const newTotal = synced.packageLines.reduce((sum, line) => sum + calcPackageLine(line), 0) + synced.addonLines.reduce((sum, line) => sum + calcAddonLine(line), 0);
  const prisaDelta = payload.includes_prisa === true ? (Number(pax) - Number(previousPax)) * 2.5 : 0;
  const subtotal = Number(payload.subtotal || 0) + newTotal - oldTotal + prisaDelta;
  const discount_amount = Math.round(subtotal * Number(payload.discount_percent || 0) / 100);
  const total_price = subtotal - discount_amount, advance_payment = Math.round(total_price * 0.3);
  return { ...payload, package_lines: JSON.stringify(synced.packageLines), new_addon_lines: JSON.stringify(synced.addonLines), subtotal, discount_amount, total_price, advance_payment, balance_payment: total_price - advance_payment };
}