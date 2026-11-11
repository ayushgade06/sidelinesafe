// Run: node lib/wbgt.check.ts   (Node ≥22.18 strips types natively)
import assert from "node:assert/strict";
import { BOUNDS, flagOf, wbgtC, wbgtF, planDay, breakTimes, nextChange, cToF, FLAGS, templateMessage, type Cat, type Hour } from "./wbgt.ts";

// 1. Flag boundaries match the US Soccer/KSI table, incl. edge values.
for (const cat of [1, 2, 3] as Cat[]) BOUNDS[cat].forEach((b, i) => {
  assert.equal(flagOf(b, cat), FLAGS[i], `cat${cat} ${b}`);
  assert.equal(flagOf(b + 0.1, cat), FLAGS[i + 1], `cat${cat} ${b + 0.1}`);
});
assert.equal(flagOf(82.1, 3), "green"); assert.equal(flagOf(82.2, 3), "yellow");
assert.equal(flagOf(86.2, 1), "black"); assert.equal(flagOf(86.14, 1), "red"); // rounds to 0.1 first

// 2. Monotonicity: up with Ta, RH, SR (0–1 kW/m²); down with WS.
const base = [30, 50, 0.5, 2] as const;
for (let k = 0; k < 3; k++) for (const d of [1, 5, 10]) {
  const a = [...base] as number[]; a[k] += k === 2 ? d / 20 : d;
  assert.ok(wbgtC(a[0], a[1], a[2], a[3]) > wbgtC(...base), `up in arg ${k}`);
}
for (let sr = 0; sr < 1; sr += 0.05) assert.ok(wbgtC(30, 50, sr + 0.05, 2) >= wbgtC(30, 50, sr, 2), `SR ${sr}`);
assert.ok(wbgtC(30, 50, 0.5, 5) < wbgtC(30, 50, 0.5, 1), "down with WS");
assert.equal(wbgtC(30, 50, -1, -3), wbgtC(30, 50, 0, 0), "clamps SR, WS ≥ 0");

// 3. Demo claim: humid 85°F/80% beats dry 95°F/15% at the same sun and wind.
const f2c = (f: number) => ((f - 32) * 5) / 9;
const humid = wbgtF(f2c(85), 80, 800, 2), dry = wbgtF(f2c(95), 15, 800, 2);
assert.ok(humid > dry, `humid ${humid} > dry ${dry}`);
console.log(`humid 85°F/80% → ${humid}°F WBGT, dry 95°F/15% → ${dry}°F WBGT`);

// 4. Planner: picks min-risk window; Red caps 120 → 60 min.
const day = "2025-08-12";
const temps = [80, 80, 80, 80, 80, 80, 78, 79, 81, 84, 86, 88, 90, 91, 91.5, 91.5, 91, 90, 88, 86, 84, 82, 81, 80];
const hours: Hour[] = temps.map((w, h) => ({ time: `${day}T${String(h).padStart(2, "0")}:00`, wbgtF: w }));
const p = planDay(hours, day, "16:00", 120, 6, 20, 3);
assert.equal(p.scheduled.flag, "red"); assert.equal(p.best?.start, "06:00"); assert.equal(p.best?.flag, "green");
assert.equal(p.cappedDurMin, 120);
const redOnly = hours.map((h) => ({ ...h, wbgtF: 91 }));
const q = planDay(redOnly, day, "16:00", 120, 6, 20, 3);
assert.equal(q.best?.flag, "red"); assert.equal(q.cappedDurMin, 60); assert.equal(q.best?.start, "16:00", "tie → closest to pref");
assert.equal(planDay(hours.map((h) => ({ ...h, wbgtF: 95 })), day, "16:00", 120, 6, 20, 3).cappedDurMin, 0, "black cancels");
assert.equal(planDay(hours.map((h) => ({ ...h, wbgtF: h.wbgtF! - 12 })), day, "16:00", 120, 6, 20, 3).best?.start, "16:00", "already green → keep time");

// 5. Break times.
assert.deepEqual(breakTimes("06:00", 60, "yellow"), ["06:20", "06:40"]);
assert.deepEqual(breakTimes("06:00", 120, "yellow"), ["06:20", "06:40", "07:00", "07:20", "07:40"]);
assert.deepEqual(breakTimes("16:00", 60, "red"), ["16:15", "16:30", "16:45"]);
assert.deepEqual(breakTimes("16:00", 60, "black"), []);

// 6. Next flag change.
assert.equal(nextChange(hours, 6, 3), 9); // 78 green … 84 at 09:00 is first non-green in cat 3
assert.equal(cToF(100), 212);
const fx = { day: "Wed, Jul 12", oldTime: "4:00 PM", newTime: "6:00 AM", durationMin: 120, flag: "Yellow", breaksPerHour: 3, notes: "" };
assert.match(templateMessage(fx), /from 4:00 PM to 6:00 AM and runs 120 minutes/);
assert.match(templateMessage({ ...fx, newTime: "", durationMin: 0, flag: "Black" }), /cancelled/);
console.log("wbgt.check: all asserts passed");
