function unique(rows, field, normalize = value => value) {
  return [...new Set(rows.map(row => normalize(row[field])))];
}

export function groupLogicalSleepingAssignments(rows = []) {
  const activeRows = rows.filter(row => row.status !== 'CANCELLED');
  const buckets = new Map();
  activeRows.forEach((row, index) => {
    const linked = !!row.allocation_series_id;
    const key = linked ? `series:${row.allocation_series_id}` : `row:${row.id || index}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  });

  const logicalAssignments = [...buckets.entries()].map(([logicalKey, periodRows]) => {
    const linked = logicalKey.startsWith('series:');
    const errors = [];
    if (linked && periodRows.some(row => !row.stay_period_id || !row.allocation_series_id)) errors.push('MISSING_LINKAGE');
    if (unique(periodRows, 'tent_id').length !== 1) errors.push('TENT_MISMATCH');
    if (unique(periodRows, 'allocated_pax', Number).length !== 1) errors.push('PAX_MISMATCH');
    if (unique(periodRows, 'allocation_type').length !== 1) errors.push('ALLOCATION_TYPE_MISMATCH');
    if (unique(periodRows, 'gender_group').length !== 1) errors.push('GENDER_MISMATCH');
    const statuses = unique(periodRows, 'status');
    const first = periodRows[0];
    return {
      logical_key: logicalKey,
      linked,
      allocation_series_id: linked ? first.allocation_series_id : null,
      period_rows: periodRows,
      physical_row_count: periodRows.length,
      logical_allocated_pax: errors.includes('PAX_MISMATCH') ? null : Number(first.allocated_pax || 0),
      tent_id: errors.includes('TENT_MISMATCH') ? null : first.tent_id,
      neighborhood_id: first.neighborhood_id,
      allocation_type: errors.includes('ALLOCATION_TYPE_MISMATCH') ? null : first.allocation_type,
      gender_group: errors.includes('GENDER_MISMATCH') ? null : first.gender_group,
      notes: first.notes || '',
      statuses,
      status_summary: statuses.length === 1 ? statuses[0] : 'MIXED',
      all_confirmed: periodRows.every(row => row.status === 'CONFIRMED'),
      has_draft: periodRows.some(row => row.status === 'DRAFT'),
      inconsistent: errors.length > 0,
      consistency_errors: errors,
    };
  });

  return {
    logical_assignments: logicalAssignments,
    physical_row_count: activeRows.length,
    logical_assignment_count: logicalAssignments.length,
    inconsistent_series: logicalAssignments.filter(item => item.inconsistent),
  };
}

export function validateLinkedSeriesCompleteness(rows = [], activePeriods = [], groupId) {
  const activeRows = rows.filter(row => row.status !== 'CANCELLED');
  const linkedRows = activeRows.filter(row => row.stay_period_id || row.allocation_series_id);
  if (linkedRows.length === 0) return { linked: false, valid: true, errors: [], ...groupLogicalSleepingAssignments(activeRows) };

  const errors = [];
  if (activeRows.some(row => !row.stay_period_id || !row.allocation_series_id)) errors.push({ code: 'MIXED_OR_MISSING_SERIES_LINKAGE' });
  const grouped = groupLogicalSleepingAssignments(linkedRows);
  grouped.inconsistent_series.forEach(series => errors.push({ code: 'INCONSISTENT_LOGICAL_SERIES', allocation_series_id: series.allocation_series_id, details: series.consistency_errors }));
  const periodById = Object.fromEntries(activePeriods.map(period => [period.id, period]));
  const expectedIds = new Set(activePeriods.map(period => period.id));

  grouped.logical_assignments.forEach(series => {
    const seen = new Set();
    series.period_rows.forEach(row => {
      const period = periodById[row.stay_period_id];
      if (row.group_id !== groupId) errors.push({ code: 'SERIES_GROUP_MISMATCH', allocation_series_id: series.allocation_series_id, allocation_id: row.id });
      if (!period || period.group_id !== groupId) errors.push({ code: 'INVALID_STAY_PERIOD', allocation_series_id: series.allocation_series_id, stay_period_id: row.stay_period_id });
      if (seen.has(row.stay_period_id)) errors.push({ code: 'DUPLICATE_STAY_PERIOD', allocation_series_id: series.allocation_series_id, stay_period_id: row.stay_period_id });
      seen.add(row.stay_period_id);
      if (period && (row.arrival_date !== period.start_date || row.departure_date !== period.end_date)) errors.push({ code: 'PERIOD_DATE_MISMATCH', allocation_series_id: series.allocation_series_id, stay_period_id: row.stay_period_id });
    });
    expectedIds.forEach(periodId => {
      if (!seen.has(periodId)) errors.push({ code: 'MISSING_STAY_PERIOD', allocation_series_id: series.allocation_series_id, stay_period_id: periodId });
    });
    seen.forEach(periodId => {
      if (!expectedIds.has(periodId)) errors.push({ code: 'UNEXPECTED_STAY_PERIOD', allocation_series_id: series.allocation_series_id, stay_period_id: periodId });
    });
  });

  if (activePeriods.length === 0) errors.push({ code: 'ACTIVE_PERIODS_REQUIRED' });
  return { linked: true, valid: errors.length === 0, errors, ...grouped };
}