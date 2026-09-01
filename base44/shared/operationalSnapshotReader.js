export const SNAPSHOT_CHUNK_FIELDS = [
  "snapshot_json", "snapshot_json_part_2", "snapshot_json_part_3", "snapshot_json_part_4",
  "snapshot_json_part_5", "snapshot_json_part_6", "snapshot_json_part_7", "snapshot_json_part_8",
  "snapshot_json_part_9", "snapshot_json_part_10", "snapshot_json_part_11", "snapshot_json_part_12",
  "snapshot_json_part_13", "snapshot_json_part_14", "snapshot_json_part_15", "snapshot_json_part_16",
];

export function readOperationalSnapshot(record) {
  if (!record) return { valid: false, error: "SNAPSHOT_MISSING", chunk_count: 0, data: null };
  const chunks = SNAPSHOT_CHUNK_FIELDS.map(field => record[field]).filter(value => typeof value === "string" && value.length > 0);
  if (!chunks.length) return { valid: false, error: "SNAPSHOT_EMPTY", chunk_count: 0, data: null };
  try {
    const payload = JSON.parse(chunks.join(""));
    if (payload?.snapshot_version !== 1 || !payload?.data || typeof payload.data !== "object") {
      return { valid: false, error: "SNAPSHOT_UNSUPPORTED_OR_MISSING_DATA", chunk_count: chunks.length, data: null };
    }
    return { valid: true, error: null, chunk_count: chunks.length, payload, data: payload.data };
  } catch (error) {
    return { valid: false, error: `SNAPSHOT_JSON_INVALID: ${error.message}`, chunk_count: chunks.length, data: null };
  }
}