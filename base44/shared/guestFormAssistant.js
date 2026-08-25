export const publicInactiveMessage = "הקישור הזה כבר לא פעיל. אנא השתמשו בקישור החדש שקיבלתם.";

export const formSections = [
  "פרטי קבוצה", "העדפות מזון ואלרגיות", "תפריט ארוחות", "משתתפים ולינה", "לוח פעילויות", "הערות כלליות",
];

export const formRules = {
  group_details: {
    fields: "שם הקבוצה (נעול, מולא מראש), אפיון קבוצה (טקסט חופשי, לא חובה), שם איש קשר (חובה), טלפון (חובה), שעת הגעה משוערת, שעת עזיבה משוערת, ארגון/חברה (לא חובה), אימייל לאישור (לא חובה)",
    rules: "תאריכי ההגעה והעזיבה נקבעו מראש ואינם ניתנים לשינוי בטופס. שינוי תאריכים או שעות מחייב תיאום — כתבו את הבקשה בהערות והצוות יחזור אליכם. את שעת ההגעה/עזיבה המשוערת ממלאים בשדות הייעודיים בשלב 'פרטי קבוצה'.",
  },
  participants: {
    fields: "תלמידים/חניכים: בנים, בנות. צוות/מלווים: גברים, נשים. נהגים/אבטחה/אחרים (רק לקבוצות לינה): גברים, נשים. בקבוצת יום: שדה אחד של סה״כ משתתפים.",
    rules: "בצוות/מלווים יש לכלול את כל מי שישן במקום ואינו חניך. הסה״כ מחושב אוטומטית. פער של יותר מ-2 מההערכה מציג אזהרה אך ניתן להמשיך. כשאין חלוקה מדויקת, רשמו הערכה סבירה וציינו בהערות שתעודכן.",
  },
  sleeping: {
    fields: "הערות לינה לתלמידים, פירוט צוות/מלווים שישנים במקום, הנחיות מיוחדות ללינת צוות, והערות לינה לנהגים/אבטחה.",
    rules: "פרטו כמויות ותפקידים והפרדות נדרשות. שיבוץ הלינה בפועל נעשה על ידי הצוות — הטופס אוסף בקשות בלבד.",
  },
  meals: {
    fields: "בקבוצת לינה הארוחות נוצרות לפי תאריכי השהות, עם אפשרות לצהריים ביום ההגעה או העזיבה ולסנדוויץ׳ במקום. בקבוצת יום מסמנים בוקר/צהריים/ערב ופינת קפה.",
    rules: "הכמויות מחושבות לפי מספר המשתתפים. סנדוויץ׳ מחליף ארוחה מלאה. בקשות מיוחדות נכתבות בהערות. האישור הסופי הוא של הצוות והמטבח.",
  },
  diets_allergies: {
    fields: "כמויות לצמחוני, טבעוני, צליאק, אלרגיה מסכנת חיים, ללא אגוזים, ללא ביצים וללא לקטוז, ושדה הערות מזון ואלרגיות.",
    rules: "מלאו כמות ופרטו בהערות סוג וחומרה. אלרגיה מסכנת חיים מסמנים גם בכמות וגם בהערות. את הפרטים הסופיים כותבים בטופס, לא בצ'אט.",
  },
  activities: {
    fields: "שם, תאריך בטווח השהות, מיקום, שעת התחלה וסיום, מספר משתתפים, ציוד והערות.",
    rules: "מלאו את כל השדות. בחירת המיקום היא העדפה בלבד וההקצאה בפועל נעשית על ידי הצוות.",
  },
  equipment: {
    fields: "מיקרופון, מקרן, סידור כיסאות, שולחנות, לוח כתיבה, אחר.",
    rules: "ציוד שאינו ברשימה מסמנים כ'אחר' ומפרטים. הציוד מסומן לכל פעילות בנפרד.",
  },
  coffee_corner: {
    fields: "בקבוצת לינה: כן/לא, סוג, שעה, מספר אנשים ומיקום/הערות. בקבוצת יום: כן/לא לפינת קפה ועוגיות.",
    rules: "פינת קפה אינה מחליפה ארוחה ואינה מאושרת אוטומטית.",
  },
  prisa: {
    fields: "אין שדה ייעודי לפריסה.",
    rules: "כתבו בהערות הכלליות שעה/הקשר, כמות משתתפים, סוג הכיבוד והערות. הצוות יתאם ויאשר סופית.",
  },
  accessibility: {
    fields: "אין שדה נגישות ייעודי; כותבים בהערות הלינה או בהערות הכלליות.",
    rules: "ציינו כמות אנשים, סוג הצורך, קרבה לשירותים ולינה נגישה. הצוות ישבץ ויאשר סופית.",
  },
  notes: {
    fields: "הערות כלליות בשלב האחרון, והערות ייעודיות למזון, לינה ופעילויות.",
    rules: "כל בקשה שאין לה שדה נכתבת בהערות הכלליות.",
  },
};

export async function resolveGuestFormContext(base44, token) {
  if (!token) return { valid: false, reason: "TOKEN_INVALID" };
  const links = await base44.asServiceRole.entities.GroupExternalFormLink.filter({ token });
  const link = links?.[0];
  if (!link) return { valid: false, reason: "TOKEN_INVALID" };
  if (link.status === "CANCELLED") return { valid: false, reason: "FORM_CLOSED" };
  if (link.status !== "ACTIVE") return { valid: false, reason: "TOKEN_REGENERATED" };

  const groupLinks = await base44.asServiceRole.entities.GroupExternalFormLink.filter({ group_id: link.group_id });
  const maxVersion = Math.max(...groupLinks.map(item => item.version_number || 0));
  if ((link.version_number || 0) < maxVersion) return { valid: false, reason: "TOKEN_REGENERATED" };

  const group = await base44.asServiceRole.entities.Group.get(link.group_id);
  if (!group) return { valid: false, reason: "TOKEN_INVALID" };
  if (["CANCELLED", "COMPLETED", "ARCHIVED"].includes(group.status)) return { valid: false, reason: "FORM_CLOSED" };

  return {
    valid: true,
    publicContext: {
      group_name: group.group_name || "",
      arrival_date: group.arrival_date || "",
      departure_date: group.departure_date || "",
      group_type: group.group_type === "DAY_USE" ? "קבוצת יום" : "קבוצה עם לינה",
      form_sections: formSections,
      form_rules: formRules,
    },
  };
}