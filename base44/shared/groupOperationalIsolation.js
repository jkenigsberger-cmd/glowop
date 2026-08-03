import { isPreparationGroupOperational } from "./quotePreparationConfig.js";

export function isGroupOperationallyEnabled(group) {
  return group?.operationally_active !== false && isPreparationGroupOperational(group);
}