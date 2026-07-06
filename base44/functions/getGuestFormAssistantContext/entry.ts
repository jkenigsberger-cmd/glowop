import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Best-effort per-isolate throttle map (no external state needed for MVP)
const rateMap = new Map();

const PUBLIC_MESSAGE = "הקישור הזה כבר לא פעיל. אנא השתמשו בקישור החדש שקיבלתם.";

const PUBLIC_HELP = {
  participants: "יש למלא כמה בנים, כמה בנות, כמה אנשי צוות (גברים/נשים) וכמה נהגים/מאבטחים. הסכום הכולל מחושב אוטומטית. אם יש ספק — עדיף לרשום הערכה ולציין זאת בהערות.",
  diets_allergies: "כדי שהמטבח יוכל להיערך נכון, כתבו כמות וסוג לכל דיאטה/אלרגיה. לדוגמה: 2 צליאק, 1 אלרגיה לבוטנים - חמורה, 1 רגישות ללקטוז. אלרגיה מסכנת חיים — חובה לציין במפורש.",
  activities: "לכל פעילות רשמו: תאריך, שעת התחלה ושעת סיום, שם/סוג הפעילות, מספר משתתפים וציוד נדרש. לדוגמה: יום שני 10:00–11:30, 45 משתתפים, צריך מקרן ומיקרופון.",
  equipment: "ציוד זמין לבקשה בפעילויות: מקרן (projector), מסך (screen), מיקרופון (microphone), סאונד (sound system), לוח (whiteboard), מעגל כיסאות (chair circle). ציינו את הציוד הנדרש בשורת הפעילות.",
  coffee_corner: "פינת קפה היא עמדת שתייה חמה/כיבוד קל. אם אתם מעוניינים, ציינו שעה, כמות משתתפים וסוג (למשל קפה ועוגיות).",
  prisa: "פריסה היא כיבוד/שתייה קלה לפי תיאום. אם אתם צריכים פריסה, כתבו שעה, כמות משתתפים וסוג הכיבוד המבוקש.",
  accessibility: "אם יש בקבוצה אנשים עם צרכי נגישות (כיסא גלגלים, מיטה נגישה, קרבה לשירותים) — כתבו זאת בהערות הלינה כדי שנקצה אוהל מתאים.",
  notes: "כל בקשה מיוחדת, שאלה או מידע שלא ברור איפה לרשום — כתבו בשדה הערות כלליות, והצוות יתייחס אליו באישור הסופי.",
};

const FORM_SECTIONS = [
  "פרטי קבוצה", "משתתפים", "לינה", "ארוחות", "אלרגיות ודיאטות",
  "פעילויות", "ציוד", "פינת קפה", "פריסה", "נגישות", "הערות",
];

const invalid = (reason, status = 200) =>
  Response.json({ valid: false, reason, public_message: PUBLIC_MESSAGE }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.form_link_token === 'string' ? body.form_link_token.trim() : '';
    const prefix = token.slice(0, 6); // never log the full token

    if (!token) {
      console.warn('[GuestFormAssistant] missing token');
      return invalid('TOKEN_INVALID');
    }

    // Best-effort throttle: max 20 calls per minute per token prefix
    const now = Date.now();
    const hits = (rateMap.get(prefix) || []).filter((t) => now - t < 60_000);
    hits.push(now);
    rateMap.set(prefix, hits);
    if (hits.length > 20) {
      console.warn(`[GuestFormAssistant] rate limited prefix=${prefix}`);
      return Response.json(
        { valid: false, reason: 'RATE_LIMITED', public_message: 'יותר מדי בקשות. נסו שוב בעוד רגע.' },
        { status: 429 }
      );
    }

    // Resolve group ONLY from token — never accept group_id from the client
    const links = await base44.asServiceRole.entities.GroupExternalFormLink.filter({ token });
    const link = links?.[0];
    if (!link) {
      console.warn(`[GuestFormAssistant] token not found prefix=${prefix}`);
      return invalid('TOKEN_INVALID');
    }
    if (link.status === 'CANCELLED') {
      console.warn(`[GuestFormAssistant] cancelled token prefix=${prefix}`);
      return invalid('FORM_CLOSED');
    }
    if (link.status !== 'ACTIVE') {
      console.warn(`[GuestFormAssistant] superseded token prefix=${prefix}`);
      return invalid('TOKEN_REGENERATED');
    }
    // Reject older versions even if status wasn't updated correctly
    const groupLinks = await base44.asServiceRole.entities.GroupExternalFormLink.filter({ group_id: link.group_id });
    const maxVersion = Math.max(...groupLinks.map((l) => l.version_number || 0));
    if ((link.version_number || 0) < maxVersion) {
      console.warn(`[GuestFormAssistant] outdated version prefix=${prefix}`);
      return invalid('TOKEN_REGENERATED');
    }

    const group = await base44.asServiceRole.entities.Group.get(link.group_id);
    if (!group) return invalid('TOKEN_INVALID');
    if (['CANCELLED', 'COMPLETED', 'ARCHIVED'].includes(group.status)) {
      console.warn(`[GuestFormAssistant] group closed prefix=${prefix}`);
      return invalid('FORM_CLOSED');
    }

    // Sanitized public-safe context ONLY — no ids, prices, notes or internal data
    return Response.json({
      valid: true,
      status: 'ACTIVE',
      public_context: {
        group_name: group.group_name || '',
        arrival_date: group.arrival_date || '',
        departure_date: group.departure_date || '',
        group_type: group.group_type === 'DAY_USE' ? 'קבוצת יום' : 'קבוצה עם לינה',
        form_sections: FORM_SECTIONS,
        public_help: PUBLIC_HELP,
      },
    });
  } catch (error) {
    console.error('[GuestFormAssistant] error:', error.message);
    return Response.json({ valid: false, reason: 'TOKEN_INVALID', public_message: PUBLIC_MESSAGE }, { status: 500 });
  }
});