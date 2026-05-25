/**
 * reviewAlerts.js
 * 
 * Shared helper for creating/upserting OperationalReviewAlert records.
 * 
 * Rules:
 * - Never throws — all errors are caught and logged.
 * - Never modifies downstream data.
 * - Deduplicates: if an OPEN alert exists for the same group_id + module + source,
 *   it updates the message/values instead of creating a duplicate.
 */

import { base44 } from "@/api/base44Client";

/**
 * Upsert a review alert.
 * Safe to call after any save operation — failures are silently logged.
 *
 * @param {string} groupId
 * @param {string} module - e.g. "KITCHEN", "ALLOCATION", "SLEEPING_REQUIREMENTS", "HOUSEKEEPING"
 * @param {string} source - e.g. "GROUP_PAX_CHANGED", "GROUP_DATES_CHANGED", "DIET_CHANGED", "SLEEPING_REQUIREMENTS_CHANGED"
 * @param {string} title
 * @param {string} message
 * @param {object|null} prevValues
 * @param {object|null} newValues
 */
export async function upsertReviewAlert(groupId, module, source, title, message, prevValues = null, newValues = null) {
  try {
    // Look for an existing OPEN alert with same group + module + source
    const existing = await base44.entities.OperationalReviewAlert.filter({
      group_id: groupId,
      module,
      source,
      status: "OPEN",
    });

    const payload = {
      title,
      message,
      previous_value_json: prevValues ? JSON.stringify(prevValues) : null,
      new_value_json:       newValues  ? JSON.stringify(newValues)  : null,
    };

    if (existing && existing.length > 0) {
      // Update the most recent existing open alert — avoid duplicates
      await base44.entities.OperationalReviewAlert.update(existing[0].id, payload);
    } else {
      // Create new alert
      await base44.entities.OperationalReviewAlert.create({
        group_id: groupId,
        module,
        source,
        status: "OPEN",
        severity: source === "GROUP_DATES_CHANGED" ? "WARNING" : "WARNING",
        ...payload,
      });
    }
  } catch (err) {
    // Never block the calling flow
    console.warn("[reviewAlerts] Failed to upsert alert:", err?.message || err);
  }
}

/**
 * Acknowledge a single alert by ID.
 * @param {string} alertId
 * @param {string} acknowledgedBy - email or name
 */
export async function acknowledgeAlert(alertId, acknowledgedBy) {
  await base44.entities.OperationalReviewAlert.update(alertId, {
    status: "ACKNOWLEDGED",
    acknowledged_at: new Date().toISOString(),
    acknowledged_by: acknowledgedBy || "unknown",
  });
}