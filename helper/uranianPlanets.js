// helper/uranianPlanets.js
const Astronomy = require("astronomy-engine");

const BODY_MAP = [
  { name: "Sun", short: "SU", body: Astronomy.Body.Sun },
  { name: "Moon", short: "MO", body: Astronomy.Body.Moon },
  { name: "Mercury", short: "ME", body: Astronomy.Body.Mercury },
  { name: "Venus", short: "VE", body: Astronomy.Body.Venus },
  { name: "Mars", short: "MA", body: Astronomy.Body.Mars },
  { name: "Jupiter", short: "JU", body: Astronomy.Body.Jupiter },
  { name: "Saturn", short: "SA", body: Astronomy.Body.Saturn },
  { name: "Uranus", short: "UR", body: Astronomy.Body.Uranus },
];

function normalizeDegree(value) {
  let deg = Number(value || 0);
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return Number(deg.toFixed(6));
}

function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== "string") {
    return { hour: 0, minute: 0, second: 0 };
  }

  const raw = timeStr.trim().toUpperCase();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/);

  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridian = match[4];

  if (meridian) {
    if (hour < 1 || hour > 12) {
      throw new Error(`Invalid 12-hour time: ${timeStr}`);
    }
    if (meridian === "AM") {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }
  }

  return { hour, minute, second };
}

function parseDateString(dateStr, dateFormat = "YMD") {
  if (!dateStr || typeof dateStr !== "string") {
    throw new Error("Date string is required");
  }

  const value = dateStr.trim();

  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }

  match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const year = Number(match[3]);

    if (dateFormat === "MDY") {
      return { year, month: a, day: b };
    }

    return { year, month: b, day: a };
  }

  throw new Error(`Invalid date format: ${dateStr}`);
}

function buildUtcDate({
  dateOfBirth,
  timeOfBirth,
  timezoneOffsetMinutes = 0,
  dateFormat = "YMD",
}) {
  const { year, month, day } = parseDateString(dateOfBirth, dateFormat);
  const { hour, minute, second } = parseTimeString(timeOfBirth);

  const utcMillis =
    Date.UTC(year, month - 1, day, hour, minute, second) -
    timezoneOffsetMinutes * 60 * 1000;

  return new Date(utcMillis);
}

function getPlanetLongitude(body, date) {
  // GeoVector = geocentric vector
  const geoVector = Astronomy.GeoVector(body, date, false);

  // Convert to true ecliptic coordinates of date
  const ecliptic = Astronomy.Ecliptic(geoVector);

  return normalizeDegree(ecliptic.elon);
}

async function calculateUranianPlanets({
  utcDate,
  dateOfBirth,
  timeOfBirth,
  timezoneOffsetMinutes = 0,
  dateFormat = "YMD",
} = {}) {
  let finalUtcDate = utcDate;

  if (!finalUtcDate) {
    if (!dateOfBirth || !timeOfBirth) {
      throw new Error(
        "Either utcDate OR (dateOfBirth + timeOfBirth + timezoneOffsetMinutes) is required",
      );
    }

    finalUtcDate = buildUtcDate({
      dateOfBirth,
      timeOfBirth,
      timezoneOffsetMinutes,
      dateFormat,
    });
  }

  const planets = BODY_MAP.map((item) => ({
    name: item.name,
    short: item.short,
    degree: getPlanetLongitude(item.body, finalUtcDate),
  }));

  return planets;
}

module.exports = {
  calculateUranianPlanets,
  buildUtcDate,
  parseDateString,
  parseTimeString,
  normalizeDegree,
};
