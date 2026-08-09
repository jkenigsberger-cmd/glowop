import { base44 } from "@/api/base44Client";

export async function loadMultiPeriodDraftPeriods(groupId) {
  const periods = await base44.entities.GroupStayPeriod.filter({ group_id: groupId, status: "ACTIVE" }, "start_date", 100);
  return periods.map(period => ({ ...period, _draft_id: period.id }));
}

export async function saveMultiPeriodDraft({ groupId, groupData, ogpData, periods }) {
  const cleanPeriods = periods.map(({ _draft_id, ...period }) => period);
  const preview = await base44.functions.invoke("previewGroupStayPeriods", { group_id: groupId, periods: cleanPeriods });
  if (!preview.data?.success || !preview.data?.valid || cleanPeriods.length < 2) {
    return { success: false, error: cleanPeriods.length < 2 ? "MIN_TWO_ACTIVE_PERIODS" : "INVALID_PERIODS", validation: preview.data };
  }
  const response = await base44.functions.invoke("saveMultiPeriodGroupDraft", {
    group_id: groupId || null,
    group_data: groupData,
    ogp_data: ogpData,
    periods: cleanPeriods,
  });
  return response.data;
}