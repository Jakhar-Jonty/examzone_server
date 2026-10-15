// Users are in India, so "today" means the IST calendar day (UTC+5:30),
// regardless of the server's timezone.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const istDayStart = (date = new Date()) => {
  const istMs = date.getTime() + IST_OFFSET_MS;
  return new Date(Math.floor(istMs / DAY_MS) * DAY_MS - IST_OFFSET_MS);
};

// "YYYY-MM-DD" of the IST calendar day containing `date`.
export const istDateKey = (date = new Date()) =>
  new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
