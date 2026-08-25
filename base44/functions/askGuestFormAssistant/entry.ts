import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { publicInactiveMessage, resolveGuestFormContext } from "../../shared/guestFormAssistant.js";

const rateMap = new Map();

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.form_link_token === "string" ? body.form_link_token.trim() : "";
    const question = typeof body?.question === "string" ? body.question.trim().slice(0, 1500) : "";
    if (!question) return Response.json({ success: false, error: "QUESTION_REQUIRED" }, { status: 400 });

    const prefix = token.slice(0, 6);
    const now = Date.now();
    const hits = (rateMap.get(prefix) || []).filter(time => now - time < 60_000);
    hits.push(now);
    rateMap.set(prefix, hits);
    if (hits.length > 20) {
      return Response.json({ success: false, error: "RATE_LIMITED", public_message: "יותר מדי בקשות. נסו שוב בעוד רגע." }, { status: 429 });
    }

    const context = await resolveGuestFormContext(base44, token);
    if (!context.valid) {
      return Response.json({ success: false, error: context.reason, public_message: publicInactiveMessage });
    }

    const prompt = `אתה עוזר ידידותי למילוי שאלון ההכנה לקבוצה של בית הדור הבא.
ענה רק לפי ספר החוקים המצורף, בקצרה ובשפה שבה נכתבה השאלה (עברית, אנגלית או ספרדית).
אתה מסביר איך למלא בלבד: אל תאשר זמינות, אל תבטיח דבר, אל תשמור או תעדכן מידע.
אם הנושא לא מכוסה בחוקים, הפנה לשדה ההערות כדי שהצוות יבדוק.
למחירים, הצעות מחיר, תשלומים, הנחות, קבוצות אחרות או מידע תפעולי פנימי ענה שאין לך גישה ושאפשר לכתוב בהערות.
אל תאסוף בצ'אט פרטים רפואיים; הפנה לכתיבת הפרטים הסופיים בטופס.

הקשר ציבורי לקבוצה:
${JSON.stringify(context.publicContext)}

שאלת הלקוח:
${question}`;

    const answer = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    return Response.json({ success: true, answer: typeof answer === "string" ? answer : String(answer || "") });
  } catch (error) {
    console.error("[askGuestFormAssistant]", error?.message);
    return Response.json({ success: false, error: "ASSISTANT_UNAVAILABLE" }, { status: 500 });
  }
}