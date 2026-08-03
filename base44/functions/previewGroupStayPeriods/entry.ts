import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  deriveStayEnvelope,
  getOperationalStayDates,
  isArrivalDate,
  isDepartureDate,
  normalizeStayPeriods,
  validateStayPeriods,
} from '../../shared/groupStayPeriods.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const rows = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email }, '-created_date', 1);
    const internalUser = rows[0];
    if (!internalUser?.active || !['SUPER_ADMIN', 'ADMIN'].includes(internalUser.role)) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const normalizedPeriods = normalizeStayPeriods(body?.periods);
    const validation = validateStayPeriods(body?.periods);
    const errors = [...validation.errors];
    if (!normalizedPeriods.some(period => period.status !== 'CANCELLED')) errors.unshift({ code: 'NO_ACTIVE_PERIODS' });
    const valid = errors.length === 0;
    const derivedEnvelope = deriveStayEnvelope(normalizedPeriods);
    const operationalDates = valid ? getOperationalStayDates(normalizedPeriods) : [];
    const arrivalDates = valid ? operationalDates.filter(date => isArrivalDate(date, normalizedPeriods)) : [];
    const departureDates = valid ? operationalDates.filter(date => isDepartureDate(date, normalizedPeriods)) : [];
    const envelopeDates = valid && derivedEnvelope ? getOperationalStayDates([{ ...derivedEnvelope, status: 'ACTIVE' }]) : [];
    const presentDates = new Set(operationalDates);
    const gaps = envelopeDates.filter(date => !presentDates.has(date));

    return Response.json({
      success: true,
      valid,
      normalized_periods: normalizedPeriods,
      errors,
      derived_envelope: derivedEnvelope,
      operational_dates: operationalDates,
      arrival_dates: arrivalDates,
      departure_dates: departureDates,
      gaps,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message || 'Preview failed' }, { status: 500 });
  }
}