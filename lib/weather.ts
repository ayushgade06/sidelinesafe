// Open-Meteo fetchers. Weather data by Open-Meteo.com (CC BY 4.0). No key needed.
import { wbgtF } from "./wbgt.ts";

export type Place = { name: string; lat: number; lon: number; admin?: string; country?: string; tz?: string };
export type WxHour = { time: string; tC: number | null; rh: number | null; sr: number | null; ws: number | null; wbgtF: number | null };
export type Wx = { hours: WxHour[]; tz: string; nowLocal: string };

const VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation";

async function getJSON(url: string) {
  const r = await fetch(url);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) throw new Error(j?.reason || `Weather service returned ${r.status}`);
  return j;
}

export async function geocode(q: string): Promise<Place[]> {
  const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5`);
  return (j.results || []).map((p: { name: string; latitude: number; longitude: number; admin1?: string; country_code?: string; timezone?: string }) => ({
    name: p.name, lat: p.latitude, lon: p.longitude, admin: p.admin1, country: p.country_code, tz: p.timezone,
  }));
}

/** Live 7-day forecast (src=live) or archive replay of `date` + 6 days (src=replay). Times are local (timezone=auto). */
export async function getWeather(lat: number, lon: number, date?: string): Promise<Wx> {
  const common = `latitude=${lat}&longitude=${lon}&hourly=${VARS}&wind_speed_unit=ms&timezone=auto`;
  const url = date
    ? `https://archive-api.open-meteo.com/v1/archive?${common}&start_date=${date}&end_date=${addDays(date, 6)}`
    : `https://api.open-meteo.com/v1/forecast?${common}&forecast_days=7`;
  const j = await getJSON(url);
  const h = j.hourly;
  const hours: WxHour[] = h.time.map((time: string, i: number) => {
    const [tC, rh, ws, sr] = [h.temperature_2m[i], h.relative_humidity_2m[i], h.wind_speed_10m[i], h.shortwave_radiation[i]];
    const ok = tC != null && rh != null && ws != null && sr != null;
    return { time, tC, rh, sr, ws, wbgtF: ok ? wbgtF(tC, rh, sr, ws) : null };
  });
  // Location's current wall-clock time, from its UTC offset.
  const nowLocal = new Date(Date.now() + j.utc_offset_seconds * 1000).toISOString().slice(0, 16);
  return { hours, tz: j.timezone, nowLocal };
}

export function addDays(d: string, n: number) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
