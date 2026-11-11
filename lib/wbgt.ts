// SidelineSafe science + planner. Pure functions, no I/O.

export type Flag = "green" | "yellow" | "orange" | "red" | "black";
export type Cat = 1 | 2 | 3;
export type Hour = { time: string; wbgtF: number | null }; // time = local "YYYY-MM-DDTHH:mm"

export const FLAGS: Flag[] = ["green", "yellow", "orange", "red", "black"];

// ponytail: regression estimate; calibrate against a Kestrel reading if a school shares data
export const CAL_OFFSET_F = 0;

// Upper bounds (°F) for Green, Yellow, Orange, Red. Above Red max = Black.
// Source: US Soccer / Korey Stringer Institute WBGT activity guidelines (via NWS).
export const BOUNDS: Record<Cat, [number, number, number, number]> = {
  1: [76.1, 81.0, 84.1, 86.1],
  2: [79.8, 84.6, 87.7, 89.7],
  3: [82.1, 87.0, 90.0, 91.9],
};

export const CAT_INFO: Record<Cat, string> = {
  1: "Cooler regions (most of the northern US). Strictest limits. Use this if unsure.",
  2: "Moderate regions (the middle band of the US).",
  3: "Hot regions (Gulf Coast, Southwest, Florida, deep South) where people are used to heat.",
};

export const GUIDE: Record<
  Flag,
  { label: string; icon: string; conditions: string; action: string; maxMin: number | null; perHour: number; breakMin: number }
> = {
  green: { label: "Green", icon: "✓", conditions: "Good conditions", action: "Normal activities. 3 separate 3 minute breaks each hour of training, OR a 10 minute break every 40 minutes", maxMin: null, perHour: 3, breakMin: 3 },
  yellow: { label: "Yellow", icon: "!", conditions: "Less than ideal conditions", action: "3 separate 4 minute breaks each hour, OR a 12 minute break every 40 minutes of training", maxMin: null, perHour: 3, breakMin: 4 },
  orange: { label: "Orange", icon: "!!", conditions: "Moderate risk for heat related illness", action: "Maximum of 2 hours of training with 4 separate 4 minute breaks each hour, OR a 10 minute break every 30 minutes of training", maxMin: 120, perHour: 4, breakMin: 4 },
  red: { label: "Red", icon: "✕", conditions: "High risk for heat related illness", action: "Maximum of 1 hour of training with 4 separate 4 minute breaks within the hour. No additional conditioning allowed.", maxMin: 60, perHour: 4, breakMin: 4 },
  black: { label: "Black", icon: "⛔", conditions: "Extreme conditions", action: "No outdoor training, delay training until cooler, or cancel training", maxMin: 0, perHour: 0, breakMin: 0 },
};

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;
const r1 = (x: number) => Math.round(x * 10) / 10;

// Peak of the SR quadratic (7.619 / (2·4.557)). Above it the fit would *lower* WBGT as sun increases,
// which is non-physical; hold it at the peak instead (conservative, ≤0.12°C difference at 1 kW/m²).
export const SR_PEAK = 7.619 / (2 * 4.557);

/** Ono & Tonouchi (2014), Jpn J Biometeorol 50(4):147–157, Eq. 3. ta °C, rh %, sr kW/m², ws m/s → WBGT °C */
export function wbgtC(ta: number, rh: number, sr: number, ws: number): number {
  const s = Math.min(Math.max(sr, 0), SR_PEAK);
  const w = Math.max(ws, 0);
  return 0.735 * ta + 0.0374 * rh + 0.00292 * ta * rh + 7.619 * s - 4.557 * s * s - 0.0572 * w - 4.064;
}

/** Inputs as Open-Meteo returns them: °C, %, W/m², m/s → WBGT °F (rounded 0.1) */
export const wbgtF = (taC: number, rh: number, srWm2: number, ws: number) =>
  r1(cToF(wbgtC(taC, rh, srWm2 / 1000, ws)) + CAL_OFFSET_F);

export function flagOf(wF: number, cat: Cat): Flag {
  const w = r1(wF);
  const b = BOUNDS[cat];
  for (let i = 0; i < 4; i++) if (w <= b[i]) return FLAGS[i];
  return "black";
}

export const sev = (f: Flag) => FLAGS.indexOf(f);

// ---------- time helpers ("HH:MM" ⇄ minutes) ----------
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Break clock times: perHour breaks spaced 60/n min from start, end time excluded. */
export function breakTimes(start: string, durMin: number, flag: Flag): string[] {
  const n = GUIDE[flag].perHour;
  if (!n || durMin <= 0) return [];
  const step = 60 / n, s = toMin(start), out: string[] = [];
  for (let t = step; t < durMin; t += step) out.push(toHHMM(s + Math.round(t)));
  return out;
}

/** Worst WBGT over the hours covering [startMin, startMin+durMin) on `day`. null if any hour missing. */
export function windowRisk(hours: Hour[], day: string, startMin: number, durMin: number): number | null {
  let worst = -Infinity;
  const last = Math.ceil((startMin + Math.max(durMin, 1)) / 60) - 1;
  for (let h = Math.floor(startMin / 60); h <= last; h++) {
    const hr = hours.find((x) => x.time === `${day}T${String(h).padStart(2, "0")}:00`);
    if (!hr || hr.wbgtF == null) return null;
    worst = Math.max(worst, hr.wbgtF);
  }
  return worst;
}

export type DayPlan = {
  day: string;
  scheduled: { start: string; wbgtF: number | null; flag: Flag | null };
  best: { start: string; wbgtF: number; flag: Flag } | null;
  cappedDurMin: number;
  breaks: string[];
};

/**
 * Safest window for one day. Uses the WORST hour in each window (not the average).
 * ponytail: hourly steps; 15-min interpolation if judges ask
 */
export function planDay(hours: Hour[], day: string, startPref: string, durMin: number, fromH: number, toH: number, cat: Cat): DayPlan {
  const pref = toMin(startPref);
  const sw = windowRisk(hours, day, pref, durMin);
  const scheduled = { start: startPref, wbgtF: sw, flag: sw == null ? null : flagOf(sw, cat) };
  let best: DayPlan["best"] = null;
  let bestDist = Infinity;
  for (let s = fromH * 60; s + durMin <= toH * 60; s += 60) {
    const risk = windowRisk(hours, day, s, durMin);
    if (risk == null) continue;
    const dist = Math.abs(s - pref);
    if (!best || risk < best.wbgtF || (risk === best.wbgtF && dist < bestDist)) {
      best = { start: toHHMM(s), wbgtF: risk, flag: flagOf(risk, cat) };
      bestDist = dist;
    }
  }
  if (!best) return { day, scheduled, best, cappedDurMin: 0, breaks: [] };
  const max = GUIDE[best.flag].maxMin;
  const cappedDurMin = max == null ? durMin : Math.min(durMin, max);
  return { day, scheduled, best, cappedDurMin, breaks: breakTimes(best.start, cappedDurMin, best.flag) };
}

/** Index of the first hour after idx whose flag differs from hour idx's flag, or -1. */
export function nextChange(hours: Hour[], idx: number, cat: Cat): number {
  const cur = hours[idx]?.wbgtF;
  if (cur == null) return -1;
  const f = flagOf(cur, cat);
  for (let i = idx + 1; i < hours.length; i++) {
    const w = hours[i].wbgtF;
    if (w != null && flagOf(w, cat) !== f) return i;
  }
  return -1;
}

// ---------- Family message: shared facts + deterministic template ----------
export const LANGS = ["English", "Spanish", "Hindi", "Vietnamese", "Chinese (Simplified)", "Arabic", "Tagalog", "French", "Portuguese", "Korean"] as const;
export type Facts = { team?: string; day: string; oldTime: string; newTime: string; durationMin: number; flag: string; breaksPerHour: number; notes: string };

export function templateMessage(f: Facts): string {
  const hi = `Hi ${f.team ? `${f.team} ` : ""}families! Heat update for ${f.day}:`;
  if (f.durationMin <= 0 || !f.newTime) return `${hi} outdoor practice is cancelled (heat flag: ${f.flag}). ${f.notes}`.trim();
  const when = f.newTime === f.oldTime ? `practice stays at ${f.newTime}` : `practice moves from ${f.oldTime} to ${f.newTime}`;
  return `${hi} ${when} and runs ${f.durationMin} minutes (heat flag: ${f.flag}). We will take ${f.breaksPerHour} water breaks every hour. ${f.notes} Please send a full water bottle.`.replace(/\s+/g, " ").trim();
}
