export const ACTIVITY_CALENDAR_ID = 'c_d90deb3b0f276cded4ab5809199860a2b2e99c8ced3c62dc8432cae3261a5583@group.calendar.google.com';
export const ACTIVITY_TIME_ZONE = 'Asia/Jerusalem';

export function calendarDateTime(date, time) {
  return { dateTime: `${date}T${time}:00`, timeZone: ACTIVITY_TIME_ZONE };
}