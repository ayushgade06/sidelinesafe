"use client";
import { useEffect, useRef, useState } from "react";
import { BOUNDS, FLAGS, GUIDE, flagOf, fToC, wbgtF, toMin, toHHMM, type Cat, type Flag, type Hour } from "@/lib/wbgt.ts";

export type Unit = "F" | "C";

// ---------- formatting ----------
export const fmtT = (f: number, u: Unit, d = 1) => (u === "F" ? `${f.toFixed(d)}°F` : `${fToC(f).toFixed(d)}°C`);
export const fmtPm = (u: Unit) => (u === "F" ? "±2°F" : "±1.1°C");
export function fmt12(hhmm: string) {
  const m = toMin(hhmm), h = Math.floor(m / 60) % 24;
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export const fmtDay = (d: string, long = false) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: long ? "long" : "short", month: long ? "long" : "short", day: "numeric" });
export const fmtDur = (m: number) => (m % 60 === 0 ? `${m / 60} hr${m === 60 ? "" : "s"}` : m > 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`);

export const FLAG_BG: Record<Flag, string> = {
  green: "bg-fgreen text-white",
  yellow: "bg-fyellow text-ink",
  orange: "bg-forange text-ink",
  red: "bg-fred text-white",
  black: "bg-fblack text-white",
};
const FILL: Record<Flag, string> = { green: "#1b7f3b", yellow: "#ffd23f", orange: "#ff8c1a", red: "#c21a2b", black: "#000000" };

// ---------- FlagBadge: icon + text, never color alone ----------
export function FlagBadge({ flag, size = "sm", children }: { flag: Flag; size?: "sm" | "lg"; children?: React.ReactNode }) {
  const g = GUIDE[flag];
  const cls = size === "lg" ? "text-xl px-3 py-1.5" : "text-sm px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded font-display font-extrabold tracking-wide whitespace-nowrap ${FLAG_BG[flag]} ${cls}`}>
      <span aria-hidden="true">{g.icon}</span>
      {g.label.toUpperCase()}
      {children}
    </span>
  );
}

// ---------- Chart: hand-written SVG ----------
type Mark = { day: string; start: string; dur: number; kind: "planned" | "suggested" };

export function Chart({ hours, cat, unit, marks = [], label }: { hours: Hour[]; cat: Cat; unit: Unit; marks?: Mark[]; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const H = 240, L = 34, R = 74, T = 22, B = 26;
  const n = hours.length, bw = (w - L - R) / Math.max(n, 1);
  const vals = hours.map((h) => h.wbgtF).filter((v): v is number => v != null);
  const lo = Math.floor(Math.min(65, ...vals) / 5) * 5, top = Math.ceil(Math.max(95, ...vals) / 5) * 5;
  const y = (v: number) => T + ((top - v) / (top - lo)) * (H - T - B);
  const ticks: number[] = [];
  for (let v = lo; v <= top; v += 5) ticks.push(v);
  const every = w < 520 ? 3 : 2;
  const idxOf = (day: string, min: number) => hours.findIndex((h) => h.time === `${day}T${toHHMM(Math.floor(min / 60) * 60)}`);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{label}. Use Tab to move through hours; the data is also in the table below.</figcaption>
      <div ref={box} className="w-full">
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="block" role="group" aria-label={label}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#c21a2b" strokeWidth="2" opacity=".35" />
            </pattern>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="#e3e8ee" />
              <text x={L - 5} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#475769" className="tabular">
                {unit === "F" ? Math.round(v) : Math.round(fToC(v))}°
              </text>
            </g>
          ))}
          {marks.map((m) => {
            const i = idxOf(m.day, toMin(m.start));
            if (i < 0) return null;
            const x = L + i * bw + ((toMin(m.start) % 60) / 60) * bw, ww = (Math.max(m.dur, 30) / 60) * bw;
            const planned = m.kind === "planned";
            return (
              <g key={m.kind}>
                <rect x={x} y={T - 2} width={ww} height={H - T - B + 2} fill={planned ? "url(#hatch)" : "none"} stroke={planned ? "#c21a2b" : "#0a54c9"} strokeWidth={planned ? 1.5 : 2.5} strokeDasharray={planned ? "4 3" : undefined} />
                <text x={x + 2} y={T - 7} fontSize="11" fontWeight="700" fill={planned ? "#c21a2b" : "#0a54c9"}>{planned ? "Planned" : "Suggested"}</text>
              </g>
            );
          })}
          {BOUNDS[cat].map((b, i) => (
            <g key={b}>
              <line x1={L} x2={w - R} y1={y(b)} y2={y(b)} stroke="#0c1e33" strokeDasharray="3 3" strokeWidth="1" />
              <text x={w - R + 4} y={y(b) + 4} fontSize="11" fill="#0c1e33">{GUIDE[FLAGS[i + 1]].label} &gt; {unit === "F" ? b.toFixed(1) : fToC(b).toFixed(1)}</text>
            </g>
          ))}
          {hours.map((h, i) => {
            if (h.wbgtF == null) return null;
            const f = flagOf(h.wbgtF, cat);
            return (
              <rect
                key={h.time} x={L + i * bw + 1} width={Math.max(bw - 2, 1)} y={y(h.wbgtF)} height={H - B - y(h.wbgtF)}
                fill={FILL[f]} stroke="#0c1e33" strokeWidth={f === "yellow" || f === "orange" ? 0.75 : 0}
                tabIndex={0} role="img" aria-label={`${fmt12(h.time.slice(11))}: ${fmtT(h.wbgtF, unit)} WBGT, ${GUIDE[f].label}`}
                onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onFocus={() => setHi(i)} onBlur={() => setHi(null)}
                className="outline-none focus:stroke-signal focus:[stroke-width:3]" opacity={hi == null || hi === i ? 1 : 0.55}
              >
                <title>{`${fmt12(h.time.slice(11))} · ${fmtT(h.wbgtF, unit)} · ${GUIDE[f].label}`}</title>
              </rect>
            );
          })}
          {hours.map((h, i) => {
            const hr = +h.time.slice(11, 13);
            return hr % every === 0 ? (
              <text key={h.time} x={L + i * bw + bw / 2} y={H - 8} fontSize="11" textAnchor="middle" fill="#475769">
                {hr === 0 ? (n > 24 ? fmtDay(h.time.slice(0, 10)).slice(0, 3) : "12a") : hr === 12 ? "12p" : hr > 12 ? `${hr - 12}p` : `${hr}a`}
              </text>
            ) : null;
          })}
          {hi != null && hours[hi]?.wbgtF != null && (() => {
            const h = hours[hi], v = h.wbgtF as number, f = flagOf(v, cat);
            const tw = 150, tx = Math.min(Math.max(L + hi * bw + bw / 2 - tw / 2, 2), w - tw - 2), ty = Math.max(y(v) - 52, 2);
            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width={tw} height={44} rx="4" fill="#0c1e33" />
                <text x={tx + 8} y={ty + 18} fontSize="13" fill="#fff" fontWeight="700">{fmtDay(h.time.slice(0, 10))} {fmt12(h.time.slice(11))}</text>
                <text x={tx + 8} y={ty + 35} fontSize="13" fill="#fff">≈ {fmtT(v, unit)} · {GUIDE[f].icon} {GUIDE[f].label}</text>
              </g>
            );
          })()}
        </svg>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-signal underline underline-offset-2">Show the hourly data as a table</summary>
        <div className="max-h-72 overflow-auto mt-2 border border-line rounded">
          <table className="w-full text-left tabular">
            <thead className="bg-chalk sticky top-0">
              <tr><th className="p-2">Time</th><th className="p-2">Air temp</th><th className="p-2">Humidity</th><th className="p-2">Sun (W/m²)</th><th className="p-2">Wind (m/s)</th><th className="p-2">WBGT est.</th><th className="p-2">Flag</th></tr>
            </thead>
            <tbody>
              {(hours as (Hour & { tC?: number | null; rh?: number | null; sr?: number | null; ws?: number | null })[]).map((h) => (
                <tr key={h.time} className="border-t border-line">
                  <td className="p-2 whitespace-nowrap">{fmtDay(h.time.slice(0, 10))} {fmt12(h.time.slice(11))}</td>
                  <td className="p-2">{h.tC == null ? "–" : fmtT((h.tC * 9) / 5 + 32, unit)}</td>
                  <td className="p-2">{h.rh ?? "–"}%</td>
                  <td className="p-2">{h.sr ?? "–"}</td>
                  <td className="p-2">{h.ws ?? "–"}</td>
                  <td className="p-2">{h.wbgtF == null ? "missing" : fmtT(h.wbgtF, unit)}</td>
                  <td className="p-2">{h.wbgtF == null ? "–" : `${GUIDE[flagOf(h.wbgtF, cat)].icon} ${GUIDE[flagOf(h.wbgtF, cat)].label}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

// ---------- PracticeCard (printable) ----------
export function PracticeCard(p: {
  place: string; day: string; start: string; durMin: number; flag: Flag; wbgt: number; breaks: string[]; unit: Unit; cat: Cat;
  oldStart: string; oldFlag: Flag | null; source: string;
}) {
  const g = GUIDE[p.flag];
  const end = toHHMM(toMin(p.start) + p.durMin);
  const cancel = p.flag === "black";
  return (
    <article className="print-area rounded-lg border-2 border-ink bg-paper p-4 sm:p-6" aria-labelledby="card-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{p.place} · Region Cat {p.cat}</p>
          <h3 id="card-title" className="font-display text-3xl sm:text-4xl font-extrabold leading-tight">
            {fmtDay(p.day, true)}
          </h3>
          <p className="font-display text-2xl font-semibold tabular">
            {cancel ? "No outdoor practice" : `${fmt12(p.start)} – ${fmt12(end)} (${fmtDur(p.durMin)})`}
          </p>
        </div>
        <FlagBadge flag={p.flag} size="lg" />
      </div>
      <p className="mt-2 text-sm">
        Estimated WBGT ≈ <strong className="tabular">{fmtT(p.wbgt, p.unit)}</strong> ({fmtPm(p.unit)}), worst hour in the window.
        {p.oldStart !== p.start && p.oldFlag && (
          <> Moved from {fmt12(p.oldStart)}, which would be <strong>{GUIDE[p.oldFlag].label}</strong>.</>
        )}
      </p>
      {!cancel && (
        <section className="mt-4">
          <h4 className="font-display text-xl font-extrabold">Water breaks</h4>
          <p className="text-sm text-muted">{g.perHour} breaks per hour, {g.breakMin} minutes each, in the shade.</p>
          <ol className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2 tabular">
            {p.breaks.map((b) => (
              <li key={b} className="rounded border border-line bg-chalk px-2 py-1.5 text-center font-semibold">{fmt12(b)}</li>
            ))}
            <li className="rounded border border-ink px-2 py-1.5 text-center font-semibold">End {fmt12(end)}</li>
          </ol>
        </section>
      )}
      <section className="mt-4">
        <h4 className="font-display text-xl font-extrabold">{g.conditions}</h4>
        <blockquote className="mt-1 border-l-4 border-ink pl-3">{g.action}</blockquote>
      </section>
      <footer className="mt-4 text-xs text-muted space-y-1">
        <p>Guideline: US Soccer / Korey Stringer Institute WBGT activity guidelines, regional Cat {p.cat}. WBGT estimated from {p.source} using Ono &amp; Tonouchi (2014). Weather data by Open-Meteo.com (CC BY 4.0).</p>
        <p className="font-semibold text-ink">Estimate for planning. Not a substitute for an on-site WBGT meter or medical advice. Always follow your league/state policy.</p>
      </footer>
    </article>
  );
}

// ---------- Explainer: why humidity matters ----------
const PRESETS = [
  { id: "dry", label: "95°F desert, 15% humidity", tF: 95, rh: 15 },
  { id: "humid", label: "85°F humid, 80% humidity", tF: 85, rh: 80 },
];

export function Explainer({ cat, unit }: { cat: Cat; unit: Unit }) {
  const [tF, setTF] = useState(85), [rh, setRh] = useState(80), [sr, setSr] = useState(800), [ws, setWs] = useState(2);
  const w = wbgtF(((tF - 32) * 5) / 9, rh, sr, ws);
  const f = flagOf(w, cat);
  const cmp = PRESETS.map((p) => ({ ...p, w: wbgtF(((p.tF - 32) * 5) / 9, p.rh, sr, ws) }));
  const slider = (id: string, lbl: string, val: number, set: (n: number) => void, min: number, max: number, step: number, show: string) => (
    <div>
      <div className="flex justify-between gap-2"><label htmlFor={id} className="font-semibold">{lbl}</label><output htmlFor={id} className="tabular font-semibold">{show}</output></div>
      <input id={id} type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(+e.target.value)} className="w-full accent-signal h-8" />
    </div>
  );
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        {slider("t", "Air temperature", tF, setTF, 60, 115, 1, unit === "F" ? `${tF}°F` : `${fToC(tF).toFixed(0)}°C`)}
        {slider("rh", "Humidity", rh, setRh, 5, 100, 1, `${rh}%`)}
        {slider("sr", "Sunshine", sr, setSr, 0, 1000, 25, `${sr} W/m² ${sr < 100 ? "(night/dusk)" : sr < 450 ? "(cloudy)" : "(sunny)"}`)}
        {slider("ws", "Wind", ws, setWs, 0, 10, 0.5, `${ws} m/s (${(ws * 2.237).toFixed(0)} mph)`)}
        <div className="flex flex-wrap gap-2 pt-1">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => { setTF(p.tF); setRh(p.rh); }} aria-pressed={tF === p.tF && rh === p.rh}
              className="rounded-full border-2 border-ink px-3 py-1.5 font-semibold aria-pressed:bg-ink aria-pressed:text-white">
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={`rounded-lg p-5 ${FLAG_BG[f]}`} aria-live="polite">
          <p className="text-sm font-semibold">Estimated WBGT</p>
          <p className="font-display text-6xl font-extrabold tabular leading-none">{fmtT(w, unit)}</p>
          <p className="mt-2 font-display text-2xl font-extrabold"><span aria-hidden="true">{GUIDE[f].icon}</span> {GUIDE[f].label}: {GUIDE[f].conditions}</p>
        </div>
        <p className="mt-4 font-semibold">Same sun and wind, two kinds of hot day:</p>
        <ul className="mt-2 space-y-2">
          {cmp.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 border-b border-line pb-2">
              <span>{c.label}</span>
              <span className="flex items-center gap-2 tabular"><strong>{fmtT(c.w, unit)}</strong><FlagBadge flag={flagOf(c.w, cat)} /></span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed">
          Your body cools by sweating, and sweat only cools when it evaporates. In humid air it can&apos;t evaporate, so heat builds up inside.
          That&apos;s why WBGT, not the thermometer, decides practice. The 85°F humid day is {(cmp[1].w - cmp[0].w).toFixed(1)}°F WBGT hotter than the 95°F dry one.
        </p>
      </div>
    </div>
  );
}
