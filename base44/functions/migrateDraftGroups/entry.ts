import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Migration function to upgrade existing manually-created DRAFT groups to CONFIRMED.
 * 
 * Rules:
 * - Find all groups with status = "DRAFT"
 * - Keep only those that have an OperationalGroupProfile (manual operational groups)
 * - Exclude groups that are CANCELLED, COMPLETED, or ARCHIVED
 * - Update their status to "CONFIRMED"
 * 
 * This enables immediate operational use without requiring quote/guest form flow.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all groups and profiles
    const allGroups = await base44.entities.Group.list('', 500);
    const allProfiles = await base44.entities.OperationalGroupProfile.list('', 500);

    // Build set of group IDs that have profiles
    const groupIdsWithProfiles = new Set(allProfiles.map(p => p.group_id));

    // Find DRAFT groups that have profiles
    const draftGroupsToMigrate = allGroups.filter(g => {
      // Must be DRAFT
      if (g.status !== 'DRAFT') return false;
      // Must have an operational profile
      if (!groupIdsWithProfiles.has(g.id)) return false;
      return true;
    });

    console.log(`Found ${draftGroupsToMigrate.length} DRAFT groups with operational profiles.`);

    // Update each to CONFIRMED
    const migrated = [];
    for (const group of draftGroupsToMigrate) {
      try {
        await base44.entities.Group.update(group.id, { status: 'CONFIRMED' });
        migrated.push({
          id: group.id,
          name: group.group_name,
          type: group.group_type,
        });
        console.log(`✓ Migrated ${group.group_name} (${group.id}) to CONFIRMED`);
      } catch (err) {
        console.error(`✗ Failed to migrate ${group.group_name} (${group.id}):`, err.message);
      }
    }

    return Response.json({
      success: true,
      total: draftGroupsToMigrate.length,
      migrated: migrated,
      message: `Migrated ${migrated.length}/${draftGroupsToMigrate.length} groups to CONFIRMED.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});