import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedEmail = user.email.trim().toLowerCase();

    // Use service role to bypass row-level security
    const allUsers = await base44.asServiceRole.entities.InternalUser.list();
    const match = allUsers.find(u => u.email && u.email.trim().toLowerCase() === normalizedEmail);

    if (!match) {
      return Response.json({ found: false, email: normalizedEmail });
    }

    return Response.json({ found: true, email: match.email, role: match.role, active: match.active, name: match.name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});