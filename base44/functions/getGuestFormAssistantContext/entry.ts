import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Best-effort per-isolate throttle map (no external state needed for MVP)
const rateMap = new Map();

const PUBLIC_MESSAGE = "הקישור הזה כבר לא פעיל. אנא השתמשו בקישור החדש שקיבלתם.";

// ── Public-safe rulebook — built from the REAL Guest Form fields ──────────
// Audited from: GuestFormStep0 (details), GuestFormStep1 (diets+coffee),
// GuestFormStep2 (meals), GuestFormStep3 (participants+sleeping),
// GuestFormStep4 (activities+equipment), GuestFormDayUseMeals (day-use).
const FORM_RULES = {
  group_details: {
    fields: "שם הקבוצה (נעול, מולא מראש), אפיון קבוצה (טקסט חופשי, לא חובה), שם איש קשר (חובה), טלפון (חובה), שעת הגעה משוערת, שעת עזיבה משוערת, ארגון/חברה (לא חובה), אימייל לאישור (לא חובה)",
    rules: "תאריכי ההגעה והעזיבה נקבעו מראש ואינם ניתנים לשינוי בטופס. שינוי תאריכים או שעות מחייב תיאום — כתבו את הבקשה בהערות והצוות יחזור אליכם. את שעת ההגעה/עזיבה המשוערת ממלאים בשדות הייעודיים בשלב 'פרטי קבוצה'.",
  },
  participants: {
    fields: "תלמידים/חניכים: בנים, בנות. צוות/מלווים: גברים, נשים. נהגים/אבטחה/אחרים (רק לקבוצות לינה): גברים, נשים. בקבוצת יום: שדה אחד של סה״כ משתתפים.",
    rules: "בשדה צוות/מלווים יש לכלול את כל מי שישן במקום ואינו חלק מקבוצת החניכים — מורים, מדריכים, נהגים, מלווים, צוות הפקה. הסה״כ מחושב אוטומטית מהפירוט. אם הסה״כ שונה מההערכה המקורית ביותר מ-2 — הטופס מציג אזהרה אך ניתן להמשיך, והצוות יתאם. אם עדיין לא יודעים חלוקה מדויקת (למשל בנים/בנות) — רשמו הערכה סבירה וציינו בהערות שהחלוקה תעודכן, הצוות יתחשב בכך.",
  },
  sleeping: {
    fields: "הערות לינה לתלמידים (חלוקת חדרים, בקשות מיוחדות), פירוט צוות/מלווים שישנים במקום, הנחיות מיוחדות ללינת צוות, הערות לינה לנהגים/אבטחה (האם ישנים באתר).",
    rules: "בפירוט הצוות כתבו שורות כמו: 2 מורים / 3 מדריכים / 1 נהג / 1 מלווה רפואי. בהנחיות לינה ציינו הפרדות נדרשות: מדריכים ומורים בנפרד, נהגים בנפרד, גברים ונשים בנפרד וכו'. שיבוץ הלינה בפועל נעשה על ידי הצוות — הטופס אוסף בקשות בלבד.",
  },
  meals: {
    fields: "קבוצת לינה: רשימת הארוחות נוצרת אוטומטית לפי תאריכי השהות — ערב ביום ההגעה, בוקר/צהריים/ערב בימים מלאים, בוקר ביום העזיבה. אפשרויות: הוספת צהריים ביום ההגעה או צהריים ביום העזיבה (אחת מהשתיים, לא שתיהן). לכל ארוחה ניתן לסמן 'סנדוויץ׳ במקום'. קבוצת יום: סימון כן/לא לבוקר, צהריים, ערב + סה״כ משתתפים אחד.",
    rules: "אין שדה כמות לכל ארוחה — הכמויות מחושבות לפי מספר המשתתפים שמולא בטופס. 'סנדוויץ׳ במקום' מחליף ארוחה מלאה בסנדוויצ'ים. בקשות מיוחדות לארוחה ספציפית (שעה חריגה, ארוחה מוקדמת) — כתבו בהערות. שום ארוחה אינה מאושרת אוטומטית — האישור הסופי הוא של הצוות והמטבח.",
  },
  diets_allergies: {
    fields: "שדות כמות: צמחוני, טבעוני, צליאק, אלרגיה מסכנת חיים, ללא אגוזים, ללא ביצים, ללא לקטוז. בנוסף: שדה 'הערות נוספות לגבי מזון ואלרגיות' (טקסט חופשי).",
    rules: "מלאו כמות בכל שדה רלוונטי והשאירו 0 אם לא רלוונטי. בשדה ההערות פרטו כל אלרגיה ספציפית: כמות + סוג + חומרה. אלרגיה מסכנת חיים חובה לסמן גם בשדה הכמות וגם לפרט בהערות. דוגמה נכונה: 2 צמחונים, 1 טבעוני, 2 צליאק, 1 אלרגיה לבוטנים - חמורה / מסכנת חיים. אל תאספו פרטים רפואיים בצ'אט — הפרטים הסופיים נכתבים בטופס עצמו.",
  },
  activities: {
    fields: "לכל פעילות: שם/כותרת, תאריך (בטווח תאריכי השהות בלבד), מיקום (כיתה / מתחם חוץ / מחוץ לחווה), שעת התחלה, שעת סיום (חייבת להיות אחרי ההתחלה), מספר משתתפים, צרכים/ציוד, הערות נוספות.",
    rules: "מלאו את כל השדות לכל פעילות. דוגמה: 'הרצאת פתיחה', 10/08, כיתה, 10:00–11:30, 45 משתתפים, מקרן + מיקרופון. הקצאת המתחם בפועל נעשית על ידי הצוות — הבחירה בטופס היא העדפה כללית בלבד.",
  },
  equipment: {
    fields: "אפשרויות הציוד בטופס: מיקרופון, מקרן, סידור כיסאות, שולחנות, לוח כתיבה, אחר (עם פירוט חופשי).",
    rules: "אלו האפשרויות היחידות בטופס. ציוד אחר (למשל מסך, מערכת סאונד, מעגל כיסאות מיוחד) — סמנו 'אחר' ופרטו בטקסט. הציוד מסומן לכל פעילות בנפרד בשלב לוח הפעילויות.",
  },
  coffee_corner: {
    fields: "קבוצת לינה (בשלב העדפות מזון): כן/לא, סוג (קפה ועוגיות / אחר), שעה מועדפת, מספר אנשים, מיקום/הערות. קבוצת יום (בשלב הארוחות): כן/לא בלבד לפינת קפה ועוגיות.",
    rules: "פינת קפה היא עמדת שתייה חמה וכיבוד קל — היא אינה מחליפה ארוחה ואינה יוצרת ארוחה אוטומטית. מלאו שעה, כמות אנשים, סוג ומיקום מבוקש. הבקשה מועברת לצוות ואינה מאושרת אוטומטית.",
  },
  prisa: {
    fields: "אין שדה ייעודי לפריסה בטופס.",
    rules: "פריסה היא כיבוד/שתייה קלה בנקודת זמן מתואמת — היא אינה ארוחה מלאה ואינה פינת קפה. אם אתם צריכים פריסה, כתבו בשדה ההערות הכלליות: שעה/הקשר (למשל אחרי ארוחת בוקר), כמות משתתפים, סוג הכיבוד המבוקש והערות. הצוות יתאם ויאשר סופית.",
  },
  accessibility: {
    fields: "אין שדה נגישות ייעודי — צרכי נגישות נכתבים בהערות הלינה הרלוונטיות (תלמידים/צוות) או בהערות הכלליות.",
    rules: "ציינו: כמה אנשים, סוג הצורך (כיסא גלגלים / קושי בהליכה / אחר), האם נדרשת קרבה לשירותים, האם נדרשת לינה נגישה, וכל מידע חשוב לתפעול. יש באתר אוהלים נגישים — הצוות ישבץ בהתאם ויאשר סופית.",
  },
  notes: {
    fields: "שדה 'הערות כלליות' מופיע בשלב האחרון של הטופס. יש גם שדות הערות ייעודיים: הערות מזון ואלרגיות, הערות לינה, הערות לכל פעילות.",
    rules: "כל בקשה מיוחדת, שאלה, או נושא שאין לו שדה בטופס — נכתבים בהערות הכלליות. הצוות קורא את כל ההערות וחוזר ללקוח במידת הצורך.",
  },
};

const FORM_SECTIONS = [
  "פרטי קבוצה", "העדפות מזון ואלרגיות", "תפריט ארוחות", "משתתפים ולינה", "לוח פעילויות", "הערות כלליות",
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
        form_rules: FORM_RULES,
      },
    });
  } catch (error) {
    console.error('[GuestFormAssistant] error:', error.message);
    return Response.json({ valid: false, reason: 'TOKEN_INVALID', public_message: PUBLIC_MESSAGE }, { status: 500 });
  }
});