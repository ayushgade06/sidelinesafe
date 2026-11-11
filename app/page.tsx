"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BOUNDS, CAT_INFO, FLAGS, GUIDE, LANGS, flagOf, fToC, nextChange, planDay, toHHMM, type Cat, type DayPlan, type Facts } from "@/lib/wbgt.ts";
import { addDays, geocode, getWeather, type Place, type Wx } from "@/lib/weather.ts";
import { Chart, Explainer, FlagBadge, FLAG_BG, PracticeCard, fmt12, fmtDay, fmtDur, fmtPm, fmtT, type Unit } from "./components";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6">Loading SidelineSafe…</p>}>
      <App />
    </Suspense>
  );
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dow = (d: string) => new Date(d + "T12:00:00Z").getUTCDay();
const today = () => new Date().toISOString().slice(0, 10);
const MAX_REPLAY = () => addDays(today(), -12); // archive lags ~5 days; replay shows 7 days
const PRESETS = [
  { label: "Houston, US · Cat 3 · Jul 10 2023", name: "Houston, Texas, US", lat: "29.763", lon: "-95.363", cat: "3", src: "replay", date: "2023-07-10" },
  { label: "Phoenix, US · Cat 3 · Jul 17 2023", name: "Phoenix, Arizona, US", lat: "33.448", lon: "-112.074", cat: "3", src: "replay", date: "2023-07-17" },
  { label: "New Delhi, IN · Cat 3 · May 28 2024", name: "New Delhi, Delhi, IN", lat: "28.614", lon: "77.209", cat: "3", src: "replay", date: "2024-05-28" },
  { label: "Live forecast: Brisbane", name: "Brisbane, Queensland, AU", lat: "-27.468", lon: "153.028", cat: "3", src: "live", date: null },
  { label: "Live forecast: Chennai", name: "Chennai, Tamil Nadu, IN", lat: "13.088", lon: "80.278", cat: "3", src: "live", date: null },
];
const TABS = [
  { id: "plan", label: "Plan" },
  { id: "now", label: "Now" },
  { id: "learn", label: "Learn" },
] as const;

function App() {
  const sp = useSearchParams();
  const q = (k: string, d: string) => sp.get(k) ?? d;
  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) if (v == null) p.delete(k); else p.set(k, v);
    window.history.replaceState(null, "", `?${p}`);
  };

  const lat = sp.get("lat"), lon = sp.get("lon"), name = q("name", "");
  const catRaw = +q("cat", "1");
  const cat = ([1, 2, 3].includes(catRaw) ? catRaw : 1) as Cat;
  const src = q("src", "live") === "replay" ? "replay" : "live";
  const date = q("date", MAX_REPLAY());
  const days = q("days", "1,3,5").split(",").filter((x) => x !== "").map(Number);
  const start = /^\d{2}:\d{2}$/.test(q("start", "")) ? q("start", "") : "16:00";
  const dur = Math.min(Math.max(+q("dur", "120") || 120, 15), 240);
  const from = Math.min(Math.max(+q("from", "6") || 0, 0), 23);
  const to = Math.min(Math.max(+q("to", "20") || 24, from + 1), 24);
  const unit: Unit = q("unit", "F") === "C" ? "C" : "F";
  const tab = (TABS.find((t) => t.id === sp.get("tab"))?.id ?? "plan") as (typeof TABS)[number]["id"];

  // ---- weather ----
  const [tick, setTick] = useState(0);
  const key = lat && lon ? `${lat},${lon},${src},${src === "replay" ? date : ""},${tick}` : "";
  const [res, setRes] = useState<{ key: string; wx?: Wx; err?: string }>({ key: "" });
  useEffect(() => {
    if (!key || !lat || !lon) return;
    let live = true;
    getWeather(+lat, +lon, src === "replay" ? date : undefined)
      .then((wx) => live && setRes({ key, wx }))
      .catch((e: Error) => live && setRes({ key, err: e.message || "Could not reach the weather service." }));
    return () => { live = false; };
  }, [key, lat, lon, src, date]);
  const wx = res.key === key ? res.wx : undefined;
  const err = res.key === key ? res.err : undefined;
  const loading = !!key && res.key !== key;

  const allDays = wx ? [...new Set(wx.hours.map((h) => h.time.slice(0, 10)))] : [];
  const plans = wx ? allDays.filter((d) => days.includes(dow(d))).map((d) => planDay(wx.hours, d, start, dur, from, to, cat)) : [];

  const sourceText = src === "replay" ? `a replay of ${fmtDay(date, true)}, ${date.slice(0, 4)} (Open-Meteo historical archive)` : "the live 7-day forecast";

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-paper focus:p-2">Skip to content</a>
      <header className="no-print sticky top-0 z-30 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-2 space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="?" className="font-display text-2xl font-extrabold leading-none">
              Sideline<span className="text-fred">Safe</span>
            </a>
            {lat && <Search compact onPick={(p) => set(placeParams(p))} current={name} />}
          </div>
          {lat && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Seg label="Region" value={String(cat)} options={[["1", "Cat 1"], ["2", "Cat 2"], ["3", "Cat 3"]]} onChange={(v) => set({ cat: v })} />
              <Seg label="Data" value={src} options={[["live", "Live forecast"], ["replay", "Replay a date"]]} onChange={(v) => set({ src: v, date: v === "replay" ? date : null })} />
              {src === "replay" && (
                <label className="flex items-center gap-1.5">
                  <span className="font-semibold">Start date</span>
                  <input type="date" value={date} min="1950-01-01" max={MAX_REPLAY()} onChange={(e) => e.target.value && set({ date: e.target.value })} className="rounded border-2 border-ink px-1.5 py-0.5" />
                </label>
              )}
              <Seg label="Units" value={unit} options={[["F", "°F"], ["C", "°C"]]} onChange={(v) => set({ unit: v })} />
            </div>
          )}
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10">
        {!lat ? (
          <Landing onPick={(p) => set({ ...placeParams(p), tab: "plan" })} onPreset={(p) => set({ name: p.name, lat: p.lat, lon: p.lon, cat: p.cat, src: p.src, date: p.date, tab: "plan" })} />
        ) : (
          <>
            <div className="no-print mt-4 flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="font-display text-3xl font-extrabold leading-tight">{name || `${lat}, ${lon}`}</h1>
              <p className="text-sm text-muted">Using {sourceText}</p>
            </div>
            {!sp.has("cat") && (
              <p className="no-print mt-2 rounded border-2 border-ink bg-fyellow/40 p-3 text-sm">
                <strong>Choose your region.</strong> You&apos;re on Cat 1, the strictest limits. {CAT_INFO[1]} Hot-climate areas (Cat 3) acclimatize to more heat.{" "}
                <a className="text-signal underline" href="https://koreystringer.institute.uconn.edu/wet-bulb-globe-temperature-monitoring" target="_blank" rel="noreferrer">Find your region on the KSI map</a>.
              </p>
            )}
            {sp.has("cat") && <p className="no-print mt-1 text-sm text-muted">Region Cat {cat}: {CAT_INFO[cat]}</p>}

            <Tabs tab={tab} onTab={(t) => set({ tab: t })} />

            <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4">
              {tab === "learn" ? (
                <Learn cat={cat} unit={unit} />
              ) : loading ? (
                <p className="py-10 text-lg" role="status">Loading hourly weather for {name}…</p>
              ) : err || !wx ? (
                <div role="alert" className="rounded border-2 border-fred p-4">
                  <p className="font-semibold">Couldn&apos;t load weather: {err ?? "no data returned"}.</p>
                  <p className="text-sm">Check your connection{src === "replay" ? " or pick a date at least 12 days ago" : ""}, then try again.</p>
                  <button type="button" onClick={() => setTick((t) => t + 1)} className="mt-2 rounded bg-ink px-4 py-2 font-semibold text-white">Try again</button>
                </div>
              ) : tab === "plan" ? (
                <Plan
                  wx={wx} plans={plans} cat={cat} unit={unit} place={name} sourceText={sourceText}
                  days={days} start={start} dur={dur} from={from} to={to} set={set}
                />
              ) : (
                <Now wx={wx} cat={cat} unit={unit} src={src} date={date} at={q("at", "09:00")} set={set} />
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

const placeParams = (p: Place) => ({
  lat: p.lat.toFixed(3), lon: p.lon.toFixed(3),
  name: [p.name, p.admin, p.country].filter(Boolean).join(", "),
});

// ---------- small controls ----------
function Seg({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <fieldset className="flex items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="font-semibold">{label}</span>
      <span className="inline-flex rounded border-2 border-ink">
        {options.map(([v, l]) => (
          <label key={v} className="cursor-pointer px-2 py-0.5 has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-signal">
            <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            {l}
          </label>
        ))}
      </span>
    </fieldset>
  );
}

function Tabs({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const move = (dir: number) => {
    const i = (TABS.findIndex((t) => t.id === tab) + dir + TABS.length) % TABS.length;
    onTab(TABS[i].id);
    requestAnimationFrame(() => document.getElementById(`tab-${TABS[i].id}`)?.focus());
  };
  return (
    <div role="tablist" aria-label="Views" className="no-print mt-4 flex border-b-2 border-ink"
      onKeyDown={(e) => { if (e.key === "ArrowRight") move(1); if (e.key === "ArrowLeft") move(-1); }}>
      {TABS.map((t) => (
        <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
          onClick={() => onTab(t.id)}
          className="-mb-0.5 border-2 border-transparent px-5 py-2 font-display text-xl font-extrabold aria-selected:border-ink aria-selected:border-b-paper aria-selected:bg-paper text-muted aria-selected:text-ink">
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Search({ onPick, compact, current }: { onPick: (p: Place) => void; compact?: boolean; current?: string }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setMsg("");
    try {
      const r = await geocode(text.trim());
      setResults(r);
      if (!r.length) setMsg(`No places match “${text.trim()}”. Try a city name, like Houston.`);
    } catch { setMsg("City search is unavailable right now. Check your connection and try again."); }
    setBusy(false);
  };
  const locate = () => {
    if (!navigator.geolocation) return setMsg("This browser can't share its location. Search for your city instead.");
    setBusy(true); setMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onPick({ name: "My location", lat: p.coords.latitude, lon: p.coords.longitude }); },
      () => { setBusy(false); setMsg("Location access was blocked. Search for your city instead."); },
      { timeout: 10000 },
    );
  };
  const pick = (p: Place) => { onPick(p); setResults(null); setText(""); };
  const big = !compact;
  return (
    <div className={`relative ${compact ? "flex-1 min-w-[16rem]" : ""}`}>
      <form role="search" onSubmit={go} className="flex flex-wrap gap-2">
        <label htmlFor={compact ? "city-c" : "city"} className="sr-only">City or town</label>
        <input id={compact ? "city-c" : "city"} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
          placeholder={compact ? `Change location${current ? ` (now: ${current.split(",")[0]})` : ""}` : "Your city or town"}
          className={`min-w-0 flex-1 rounded border-2 border-ink px-3 ${big ? "py-3 text-lg" : "py-1"}`} />
        <button type="submit" disabled={busy} className={`rounded bg-ink font-semibold text-white disabled:opacity-60 ${big ? "px-5 py-3 text-lg" : "px-3 py-1"}`}>Search</button>
        <button type="button" onClick={locate} disabled={busy} className={`rounded border-2 border-ink font-semibold ${big ? "px-4 py-3" : "px-2 py-0.5 text-sm"}`}>Use my location</button>
      </form>
      <p aria-live="polite" className="text-sm">{busy ? "Searching…" : msg}</p>
      {results && results.length > 0 && (
        <ul className={`${compact ? "absolute left-0 right-0 z-40 shadow-lg" : "mt-2"} rounded border-2 border-ink bg-paper`}>
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button type="button" onClick={() => pick(p)} className="w-full px-3 py-2 text-left hover:bg-chalk focus:bg-chalk">
                <strong>{p.name}</strong>{p.admin ? `, ${p.admin}` : ""}{p.country ? `, ${p.country}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Landing ----------
function Landing({ onPick, onPreset }: { onPick: (p: Place) => void; onPreset: (p: (typeof PRESETS)[number]) => void }) {
  return (
    <div className="rise py-8 sm:py-14">
      <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">
        34% of US high schools have no athletic trainer. SidelineSafe is the heat check they&apos;re missing.
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed">
        Exertional heat stroke is a leading cause of death in high school sports, and it is almost always preventable.
        Pick your city and practice times. SidelineSafe flags the practices that will be too hot, finds a safer time, and builds the break schedule.{" "}
        <a className="text-signal underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11635796/" target="_blank" rel="noreferrer">Source: Sports Health, 2024</a>
      </p>
      <div className="mt-6 max-w-2xl">
        <Search onPick={onPick} />
      </div>
      <h2 className="mt-8 font-display text-2xl font-extrabold">Or replay a real heat week</h2>
      <p className="text-sm text-muted">It&apos;s November in the US, so these use past summer weather from the historical archive.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <li key={p.label}>
            <button type="button" onClick={() => onPreset(p)} className="rounded-full border-2 border-ink px-4 py-2 font-semibold hover:bg-ink hover:text-white">
              {p.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
        {[
          ["Plan ahead", "Uses the 7-day forecast, not just right now, so you can move practice before anyone shows up."],
          ["Know what to do", "Turns the US Soccer / KSI heat guideline into a time limit and water-break clock times."],
          ["Tell families", "One tap writes a message to parents in their language. The times and flags never come from AI."],
        ].map(([h, t]) => (
          <div key={h} className="border-t-4 border-ink pt-2">
            <h3 className="font-display text-xl font-extrabold">{h}</h3>
            <p className="text-sm leading-relaxed">{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Plan tab ----------
function Plan(p: {
  wx: Wx; plans: DayPlan[]; cat: Cat; unit: Unit; place: string; sourceText: string;
  days: number[]; start: string; dur: number; from: number; to: number; set: (x: Record<string, string | null>) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cur = p.plans.find((x) => x.day === sel) ?? p.plans.find((x) => x.scheduled.flag && x.best && x.scheduled.flag !== x.best.flag) ?? p.plans[0];
  const startOpts = Array.from({ length: 35 }, (_, i) => toHHMM(300 + i * 30)); // 5:00–22:00
  const durOpts = [30, 45, 60, 75, 90, 105, 120, 150, 180];
  const toggleDay = (d: number) => {
    const next = p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d].sort();
    p.set({ days: next.join(",") });
  };
  const counts = FLAGS.map((f) => [f, p.plans.filter((x) => x.scheduled.flag === f).length] as const).filter(([, n]) => n);
  const share = async () => {
    await navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <form className="no-print grid gap-4 rounded-lg bg-chalk p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="sm:col-span-2 lg:col-span-1">
          <legend className="font-semibold">Practice days</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" aria-pressed={p.days.includes(d)} onClick={() => toggleDay(d)}
                className="w-11 rounded border-2 border-ink py-1 text-sm font-semibold aria-pressed:bg-ink aria-pressed:text-white">
                {DOW[d]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="font-semibold">Usual start time</span>
          <select value={p.start} onChange={(e) => p.set({ start: e.target.value })} className="mt-1 block w-full rounded border-2 border-ink bg-paper px-2 py-1.5">
            {startOpts.map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold">Length</span>
          <select value={p.dur} onChange={(e) => p.set({ dur: e.target.value })} className="mt-1 block w-full rounded border-2 border-ink bg-paper px-2 py-1.5">
            {durOpts.map((d) => <option key={d} value={d}>{fmtDur(d)}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="font-semibold">Allowed hours</legend>
          <div className="mt-1 flex items-center gap-2">
            <label className="sr-only" htmlFor="from">Earliest start</label>
            <select id="from" value={p.from} onChange={(e) => p.set({ from: e.target.value })} className="w-full rounded border-2 border-ink bg-paper px-2 py-1.5">
              {Array.from({ length: 23 }, (_, h) => <option key={h} value={h}>{fmt12(toHHMM(h * 60))}</option>)}
            </select>
            <span aria-hidden="true">to</span>
            <label className="sr-only" htmlFor="to">Latest end</label>
            <select id="to" value={p.to} onChange={(e) => p.set({ to: e.target.value })} className="w-full rounded border-2 border-ink bg-paper px-2 py-1.5">
              {Array.from({ length: 24 - p.from }, (_, i) => p.from + i + 1).map((h) => <option key={h} value={h}>{h === 24 ? "Midnight" : fmt12(toHHMM(h * 60))}</option>)}
            </select>
          </div>
        </fieldset>
      </form>

      {p.plans.length === 0 ? (
        <p className="rounded border-2 border-ink p-4">None of your practice days fall in this 7-day range. Pick at least one practice day above.</p>
      ) : (
        <section aria-labelledby="week-h">
          <h2 id="week-h" className="font-display text-2xl font-extrabold">
            Your {fmt12(p.start)} practices this week
          </h2>
          <p className="text-sm text-muted">
            {counts.map(([f, n]) => `${n} ${GUIDE[f].label}`).join(", ")} at the usual time. Each window is rated by its hottest hour. Select a day for its practice card.
          </p>
          <ul className="no-print mt-3 space-y-2">
            {p.plans.map((d) => <PlanRow key={d.day} d={d} unit={p.unit} dur={p.dur} from={p.from} to={p.to} selected={cur?.day === d.day} onSelect={() => setSel(d.day)} />)}
          </ul>
        </section>
      )}

      {cur && (
        <>
          <section aria-labelledby="chart-h" className="no-print">
            <h2 id="chart-h" className="font-display text-2xl font-extrabold">Hour by hour, {fmtDay(cur.day, true)}</h2>
            <p className="text-sm text-muted">Estimated WBGT ({fmtPm(p.unit)}). Dashed lines are the Cat {p.cat} flag limits.</p>
            <div className="mt-2">
              <Chart
                hours={p.wx.hours.filter((h) => h.time.startsWith(cur.day))} cat={p.cat} unit={p.unit} label={`Hourly WBGT for ${fmtDay(cur.day, true)}`}
                marks={[
                  { day: cur.day, start: cur.scheduled.start, dur: p.dur, kind: "planned" as const },
                  ...(cur.best && cur.best.start !== cur.scheduled.start && cur.cappedDurMin > 0 ? [{ day: cur.day, start: cur.best.start, dur: cur.cappedDurMin, kind: "suggested" as const }] : []),
                ]}
              />
            </div>
          </section>

          {cur.best && (
            <section aria-labelledby="card-h">
              <h2 id="card-h" className="no-print font-display text-2xl font-extrabold">Practice card</h2>
              <div className="mt-2">
                <PracticeCard place={p.place} day={cur.day} start={cur.best.start} durMin={cur.cappedDurMin} flag={cur.best.flag} wbgt={cur.best.wbgtF}
                  breaks={cur.breaks} unit={p.unit} cat={p.cat} oldStart={cur.scheduled.start} oldFlag={cur.scheduled.flag} source={p.sourceText} />
              </div>
              <div className="no-print mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => window.print()} className="rounded bg-ink px-4 py-2 font-semibold text-white">Print card</button>
                <button type="button" onClick={share} className="rounded border-2 border-ink px-4 py-2 font-semibold">{copied ? "Link copied" : "Copy share link"}</button>
                <span aria-live="polite" className="sr-only">{copied ? "Share link copied to clipboard" : ""}</span>
              </div>
              <FamilyMessage key={`${cur.day}${cur.best.start}${cur.cappedDurMin}${cur.best.flag}`} facts={factsFor(cur)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PlanRow({ d, unit, dur, from, to, selected, onSelect }: { d: DayPlan; unit: Unit; dur: number; from: number; to: number; selected: boolean; onSelect: () => void }) {
  const s = d.scheduled, b = d.best;
  const moved = b && b.start !== s.start;
  const sMax = s.flag ? GUIDE[s.flag].maxMin : null;
  return (
    <li>
      <button type="button" onClick={onSelect} aria-pressed={selected}
        className="grid w-full gap-2 rounded-lg border-2 border-line p-3 text-left aria-pressed:border-ink aria-pressed:shadow-[4px_4px_0_var(--color-ink)] sm:grid-cols-[7rem_1fr_1fr] sm:items-center">
        <span className="font-display text-xl font-extrabold">{fmtDay(d.day)}</span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular font-semibold">{fmt12(s.start)}</span>
          {s.flag ? <FlagBadge flag={s.flag} /> : <span className="text-sm">no data</span>}
          {s.wbgtF != null && <span className="tabular text-sm text-muted">≈{fmtT(s.wbgtF, unit, 1)}</span>}
          {s.flag && sMax != null && sMax < dur && <span className="text-sm font-semibold">{sMax === 0 ? "cancel" : `max ${fmtDur(sMax)}`}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {!b ? (
            <span className="text-sm">No full {fmtDur(dur)} window with data between {fmt12(toHHMM(from * 60))} and {to === 24 ? "midnight" : fmt12(toHHMM(to * 60))}.</span>
          ) : b.flag === "black" ? (
            <span className="font-semibold">⛔ Cancel or move indoors. No safe outdoor window between {fmt12(toHHMM(from * 60))} and {to === 24 ? "midnight" : fmt12(toHHMM(to * 60))}.</span>
          ) : (
            <>
              <span className="font-semibold">{moved ? <>Move to <span className="tabular">{fmt12(b.start)}</span></> : "Keep this time"}</span>
              <FlagBadge flag={b.flag} />
              <span className="text-sm font-semibold">{d.cappedDurMin < dur ? `shorten to ${fmtDur(d.cappedDurMin)}` : `full ${fmtDur(dur)}`}</span>
            </>
          )}
        </span>
      </button>
    </li>
  );
}

function factsFor(d: DayPlan): Facts {
  const b = d.best!;
  const cancel = b.flag === "black" || d.cappedDurMin === 0;
  return {
    day: fmtDay(d.day, true), oldTime: fmt12(d.scheduled.start), newTime: cancel ? "" : fmt12(b.start), durationMin: cancel ? 0 : d.cappedDurMin,
    flag: GUIDE[b.flag].label, breaksPerHour: GUIDE[b.flag].perHour,
    notes: cancel ? "No outdoor training today, following the heat guideline." : `Water breaks at ${d.breaks.map(fmt12).join(", ")}.`,
  };
}

const LANG_CODE: Record<string, string> = { English: "en", Spanish: "es", Hindi: "hi", Vietnamese: "vi", "Chinese (Simplified)": "zh-Hans", Arabic: "ar", Tagalog: "tl", French: "fr", Portuguese: "pt", Korean: "ko" };

function FamilyMessage({ facts }: { facts: Facts }) {
  const [lang, setLang] = useState<string>("Spanish");
  const [team, setTeam] = useState("");
  const [out, setOut] = useState<{ text: string; ai: boolean; reason?: string; lang: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const write = async () => {
    setBusy(true); setErr(""); setCopied(false);
    try {
      const r = await fetch("/api/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: lang, facts: { ...facts, team: team.trim() || undefined } }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setOut({ ...j, lang: j.ai ? lang : "English" });
    } catch (e) { setErr(`Couldn't write the message: ${(e as Error).message || "network error"}. Try again.`); }
    setBusy(false);
  };
  const copy = async () => { if (out) { await navigator.clipboard.writeText(out.text).catch(() => {}); setCopied(true); } };
  return (
    <section aria-labelledby="msg-h" className="no-print mt-6 rounded-lg border-2 border-ink p-4">
      <h2 id="msg-h" className="font-display text-2xl font-extrabold">Message families</h2>
      <p className="text-sm text-muted">AI only translates and words the message. The day, times and flag come from the plan above.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="font-semibold">Language</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 block rounded border-2 border-ink bg-paper px-2 py-1.5">
            {LANGS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold">Team name (optional)</span>
          <input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={60} className="mt-1 block rounded border-2 border-ink px-2 py-1.5" />
        </label>
        <button type="button" onClick={write} disabled={busy} className="rounded bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60">
          {busy ? "Writing…" : "Write message"}
        </button>
      </div>
      <p role="alert" className="text-sm text-fred">{err}</p>
      {out && (
        <div className="mt-4 grid gap-4 md:grid-cols-[3fr_2fr]" aria-live="polite">
          <div>
            <p className="text-sm font-semibold">
              {out.ai ? "AI-written · double-check times" : out.reason === "time-check" ? "Template in English (the AI version changed a time, so it was discarded)" : "Template in English (AI unavailable)"}
            </p>
            <p lang={LANG_CODE[out.lang]} dir={out.lang === "Arabic" ? "rtl" : "ltr"} className="mt-1 whitespace-pre-wrap rounded bg-chalk p-3 text-lg leading-relaxed">{out.text}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="rounded border-2 border-ink px-3 py-1.5 font-semibold">{copied ? "Copied" : "Copy"}</button>
              <a href={`sms:?&body=${encodeURIComponent(out.text)}`} className="rounded border-2 border-ink px-3 py-1.5 font-semibold">Send as SMS</a>
              <a href={`https://wa.me/?text=${encodeURIComponent(out.text)}`} target="_blank" rel="noreferrer" className="rounded border-2 border-ink px-3 py-1.5 font-semibold">Send on WhatsApp</a>
            </div>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Facts it was given (English)</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted">Day</dt><dd>{facts.day}</dd>
              <dt className="text-muted">Was</dt><dd>{facts.oldTime}</dd>
              <dt className="text-muted">Now</dt><dd>{facts.newTime || "Cancelled"}</dd>
              <dt className="text-muted">Length</dt><dd>{facts.durationMin} min</dd>
              <dt className="text-muted">Flag</dt><dd>{facts.flag}</dd>
              <dt className="text-muted">Breaks</dt><dd>{facts.breaksPerHour} per hour</dd>
              <dt className="text-muted">Notes</dt><dd>{facts.notes}</dd>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- Now tab ----------
function Now({ wx, cat, unit, src, date, at, set }: { wx: Wx; cat: Cat; unit: Unit; src: string; date: string; at: string; set: (x: Record<string, string | null>) => void }) {
  const [meter, setMeter] = useState("");
  const nowKey = src === "replay" ? `${date}T${at.slice(0, 2)}:00` : `${wx.nowLocal.slice(0, 13)}:00`;
  const idx = wx.hours.findIndex((h) => h.time === nowKey);
  const h = wx.hours[idx];
  if (idx < 0 || h?.wbgtF == null) return <p role="alert" className="rounded border-2 border-fred p-4">No weather data for this hour yet. Try again in a few minutes, or switch to replay.</p>;
  const m = parseFloat(meter);
  const meterF = Number.isFinite(m) ? (unit === "F" ? m : (m * 9) / 5 + 32) : null;
  const w = meterF ?? h.wbgtF;
  const f = flagOf(w, cat);
  const g = GUIDE[f];
  const ni = nextChange(wx.hours, idx, cat);
  const nh = ni >= 0 ? wx.hours[ni] : null;
  const nf = nh?.wbgtF != null ? flagOf(nh.wbgtF, cat) : null;
  const next24 = wx.hours.slice(idx, idx + 24);
  return (
    <div className="space-y-6">
      {src === "replay" && (
        <label className="no-print flex items-center gap-2">
          <span className="font-semibold">Replay clock, {fmtDay(date)}</span>
          <select value={at} onChange={(e) => set({ at: e.target.value })} className="rounded border-2 border-ink bg-paper px-2 py-1.5">
            {Array.from({ length: 24 }, (_, i) => toHHMM(i * 60)).map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
          </select>
        </label>
      )}
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <div className={`pennant rise px-6 py-6 pr-[18%] ${FLAG_BG[f]}`} aria-live="polite">
          <p className="font-semibold">
            {src === "replay" ? "Replay" : "Now"}, {fmtDay(h.time.slice(0, 10))} {fmt12(h.time.slice(11))}
          </p>
          <p className="font-display text-[5.5rem] font-extrabold leading-none tabular sm:text-[7rem]">
            {meterF == null ? "≈" : ""}{unit === "F" ? w.toFixed(1) : fToC(w).toFixed(1)}°
          </p>
          <p className="font-semibold">{meterF == null ? `WBGT estimate ${fmtPm(unit)}` : "WBGT from your meter"}</p>
          <p className="mt-3 font-display text-4xl font-extrabold"><span aria-hidden="true">{g.icon}</span> {g.label.toUpperCase()} FLAG</p>
          <p className="font-semibold">{g.conditions}</p>
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold">What to do</h2>
            <p className="mt-1 border-l-4 border-ink pl-3">{g.action}</p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold">Next change</h2>
            {nh && nf ? (
              <p className="mt-1 flex flex-wrap items-center gap-2">
                Turns <FlagBadge flag={nf} /> at <strong className="tabular">{fmt12(nh.time.slice(11))}</strong>
                {nh.time.slice(0, 10) !== h.time.slice(0, 10) && <span>{fmtDay(nh.time.slice(0, 10))}</span>}
                <span className="text-muted">(in {ni - idx} hr{ni - idx === 1 ? "" : "s"})</span>
              </p>
            ) : <p className="mt-1">No flag change in the rest of this forecast.</p>}
          </div>
          <div className="rounded-lg bg-chalk p-3">
            <label htmlFor="meter" className="font-semibold">I have a meter</label>
            <p id="meter-help" className="text-sm text-muted">Enter an on-site WBGT reading in °{unit}. It replaces the estimate above.</p>
            <div className="mt-1 flex gap-2">
              <input id="meter" type="number" inputMode="decimal" step="0.1" value={meter} onChange={(e) => setMeter(e.target.value)} aria-describedby="meter-help"
                placeholder={unit === "F" ? "e.g. 91.2" : "e.g. 32.9"} className="w-32 rounded border-2 border-ink px-2 py-1.5 tabular" />
              {meter && <button type="button" onClick={() => setMeter("")} className="rounded border-2 border-ink px-3 font-semibold">Clear</button>}
            </div>
            {meterF != null && <p className="mt-1 text-sm">Estimate was {fmtT(h.wbgtF, unit)}; using your reading instead.</p>}
          </div>
        </div>
      </div>
      <section aria-labelledby="n24">
        <h2 id="n24" className="font-display text-2xl font-extrabold">Next 24 hours</h2>
        <Chart hours={next24} cat={cat} unit={unit} label="Estimated WBGT for the next 24 hours" />
      </section>
    </div>
  );
}

// ---------- Learn tab ----------
function Learn({ cat, unit }: { cat: Cat; unit: Unit }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="why-h">
        <h2 id="why-h" className="font-display text-3xl font-extrabold">Why WBGT, not temperature?</h2>
        <p className="mb-4 max-w-2xl">Move the sliders. Then compare the two preset days. The flag uses your region (Cat {cat}).</p>
        <Explainer cat={cat} unit={unit} />
      </section>
      <section aria-labelledby="how-h" className="max-w-3xl space-y-3">
        <h2 id="how-h" className="font-display text-3xl font-extrabold">How SidelineSafe decides</h2>
        <p>
          <strong>1. Estimate WBGT each hour</strong> from Open-Meteo&apos;s air temperature, humidity, sunshine and wind, using the peer-reviewed
          regression from Ono &amp; Tonouchi (2014), the one Japan&apos;s Ministry of the Environment uses for its heat-illness forecasts:
        </p>
        <pre className="overflow-x-auto rounded bg-chalk p-3 text-sm">WBGT(°C) = 0.735·Ta + 0.0374·RH + 0.00292·Ta·RH{"\n"}         + 7.619·SR − 4.557·SR² − 0.0572·WS − 4.064</pre>
        <p className="text-sm text-muted">Ta air temperature °C, RH humidity %, SR sunshine kW/m², WS wind m/s. Reported error within ±1°C (about ±2°F) for 98–99.8% of hours.</p>
        <p><strong>2. Rate each practice window by its hottest hour,</strong> not the average. That&apos;s the cautious choice.</p>
        <p><strong>3. Apply the US Soccer / Korey Stringer Institute guideline</strong> for your region, word for word:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b-2 border-ink"><th className="p-2">Flag</th><th className="p-2">Cat {cat} WBGT</th><th className="p-2">What to do</th></tr></thead>
            <tbody>
              {FLAGS.map((f, i) => {
                const b = BOUNDS[cat];
                const range = i === 0 ? `≤ ${fmtT(b[0], unit)}` : i === 4 ? `> ${fmtT(b[3], unit)}` : `${fmtT(b[i - 1] + 0.1, unit)} – ${fmtT(b[i], unit)}`;
                return (
                  <tr key={f} className="border-b border-line align-top">
                    <td className="p-2"><FlagBadge flag={f} /></td>
                    <td className="p-2 whitespace-nowrap tabular">{range}</td>
                    <td className="p-2">{GUIDE[f].action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p><strong>4. Find the safest window</strong> each practice day between your allowed hours. Ties go to the time closest to your usual start. Orange caps practice at 2 hours, Red at 1 hour, Black cancels.</p>
        <p><strong>5. Space water breaks evenly</strong> (3 or 4 per hour, by flag) and print them as clock times.</p>
      </section>
    </div>
  );
}

// ---------- Footer ----------
function Footer() {
  return (
    <footer className="no-print border-t-2 border-ink bg-chalk">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-sm">
        <p className="font-semibold">Estimate for planning. Not a substitute for an on-site WBGT meter or medical advice. Always follow your league/state policy.</p>
        <p>
          <a className="text-signal underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo.com</a> (
          <a className="text-signal underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>).
          Guidelines: <a className="text-signal underline" href="https://www.weather.gov/arx/wbgt" target="_blank" rel="noreferrer">US Soccer / Korey Stringer Institute WBGT activity guidelines (via NWS)</a>.
          Formula: Ono M, Tonouchi M. <a className="text-signal underline" href="https://doi.org/10.11227/seikisho.50.147" target="_blank" rel="noreferrer">Estimation of wet-bulb globe temperature using generally measured meteorological indices</a>. Jpn J Biometeorol. 2014;50(4):147–157.
        </p>
        <p>
          Stats: <a className="text-signal underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11635796/" target="_blank" rel="noreferrer">Sports Health (2024)</a>. Free and open source. No account, no tracking.{" "}
          <a className="text-signal underline" href="https://deployxa.com" target="_blank" rel="noreferrer">Deployed on Deployxa</a>.
        </p>
      </div>
    </footer>
  );
}
