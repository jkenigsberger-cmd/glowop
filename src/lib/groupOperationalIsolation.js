import { isOperationalGroup } from "@/lib/quotePreparationFlow";

export function isGroupOperationallyEnabled(group) {
  return group?.operationally_active !== false && isOperationalGroup(group);
}