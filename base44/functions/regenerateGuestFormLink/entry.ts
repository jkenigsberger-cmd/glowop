/**
 * regenerateGuestFormLink
 * Admin-only. Creates a new token-based external form link for a group.
 * Marks all previous ACTIVE links for this group as SUPERSEDED.
 * Returns the new full URL.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch { /* unauthenticated */ }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'ADMIN', 'SUPER_ADMIN', 'OPERATIONS'].includes(user.role)) {
      return Response.json({ error: 'נדרשות הרשאות מנהל' }, { status: 403 });
    }

    const { group_id } = await req.json();
    if (!group_id) return Response.json({ error: 'group_id is required' }, { status: 400 });

    // Verify group exists and is active
    let groups = [];
    try { groups = await base44.asServiceRole.entities.Group.filter({ id: group_id }); } catch {
      return Response.json({ error: 'הקבוצה לא נמצאה' }, { status: 404 });
    }
    const group = groups[0];
    if (!group) return Response.json({ error: 'הקבוצה לא נמצאה' }, { status: 404 });
    if (['CANCELLED', 'ARCHIVED'].includes(group.status)) {
      return Response.json({ error: 'לא ניתן ליצור קישור לקבוצה שבוטלה או הוקפאה' }, { status: 403 });
    }

    // Load existing links for this group
    const existingLinks = await base44.asServiceRole.entities.GroupExternalFormLink.filter({ group_id });

    // Mark all current ACTIVE links as SUPERSEDED
    const activeLinks = existingLinks.filter(l => l.status === 'ACTIVE');
    for (const link of activeLinks) {
      await base44.asServiceRole.entities.GroupExternalFormLink.update(link.id, { status: 'SUPERSEDED' });
    }

    // Calculate next version number
    const maxVersion = existingLinks.reduce((max, l) => Math.max(max, l.version_number || 0), 0);
    const version_number = maxVersion + 1;

    // Create new link
    const token = generateToken();
    const newLink = await base44.asServiceRole.entities.GroupExternalFormLink.create({
      group_id,
      token,
      version_number,
      status: 'ACTIVE',
      created_by_user_id: user.id,
      created_by_name: user.full_name || user.email || '',
    });

    const url = `${req.headers.get('origin') || 'https://app.base44.com'}/guest-form?group=${group_id}&token=${token}`;

    console.log(`[regenerateGuestFormLink] group=${group_id} v${version_number} token=${token.substring(0, 8)}...`);

    return Response.json({
      success: true,
      url,
      token,
      version_number,
      link_id: newLink.id,
      superseded_count: activeLinks.length,
    });
  } catch (error) {
    console.error('[regenerateGuestFormLink]', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});