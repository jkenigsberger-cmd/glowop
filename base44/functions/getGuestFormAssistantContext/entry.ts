import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { publicInactiveMessage, resolveGuestFormContext } from "../../shared/guestFormAssistant.js";

const rateMap = new Map();

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.form_link_token === "string" ? body.form_link_token.trim() : "";
    const prefix = token.slice(0, 6);

    const now = Date.now();
    const hits = (rateMap.get(prefix) || []).filter(time => now - time < 60_000);
    hits.push(now);
    rateMap.set(prefix, hits);
    if (hits.length > 20) {
      return Response.json({ valid: false, reason: "RATE_LIMITED", public_message: "יותר מדי בקשות. נסו שוב בעוד רגע." }, { status: 429 });
    }

    const result = await resolveGuestFormContext(base44, token);
    if (!result.valid) {
      return Response.json({ valid: false, reason: result.reason, public_message: publicInactiveMessage });
    }

    return Response.json({ valid: true, status: "ACTIVE", public_context: result.publicContext });
  } catch (error) {
    console.error("[GuestFormAssistant]", error?.message);
    return Response.json({ valid: false, reason: "TOKEN_INVALID", public_message: publicInactiveMessage }, { status: 500 });
  }
}