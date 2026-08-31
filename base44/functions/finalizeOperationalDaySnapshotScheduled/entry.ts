import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { dateInJerusalem, finalizeOperationalSnapshotForDate, previousDate } from '../../shared/operationalDaySnapshot.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const today = dateInJerusalem();
    const targetDate = previousDate(today);
    const result = await finalizeOperationalSnapshotForDate(base44, targetDate);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}