export const QUOTE_AUDIENCE_CONTENT = {
  EDUCATION_STAFF: {
    label: "צוותי חינוך",
    subtitle: "הצעת מחיר לסמינרים וימי עיון לצוותי חינוך",
    intro: "בית הדור הבא מציע מרחב לחיבור, העמקה ודיאלוג. בהמשך לשיחתנו, להלן הצעתנו עבור פעילות לצוותי חינוך:",
  },
  STUDENTS: {
    label: "תלמידות ותלמידים",
    subtitle: "הצעת מחיר לפעילות לתלמידות ותלמידים",
    intro: "בית הדור הבא מציע מרחב לחיבור, העמקה ודיאלוג. בהמשך לשיחתנו, להלן הצעתנו עבור פעילות לתלמידות ותלמידים:",
  },
  SOCIAL_ORGANIZATIONS: {
    label: "ארגונים חברתיים",
    subtitle: "הצעת מחיר לסמינרים וימי עיון לארגונים חברתיים",
    intro: "בית הדור הבא מציע מרחב לחיבור, העמקה ודיאלוג. בהמשך לשיחתנו, להלן הצעתנו עבור סמינרים וימי עיון לארגונים חברתיים:",
  },
};

export function getQuoteAudienceContent(type) {
  return QUOTE_AUDIENCE_CONTENT[type] || QUOTE_AUDIENCE_CONTENT.EDUCATION_STAFF;
}

export function getEffectiveQuoteGroupName(quote) {
  return quote?.group_name?.trim() || quote?.client_name?.trim() || quote?.quote_number || "קבוצה בהכנה";
}