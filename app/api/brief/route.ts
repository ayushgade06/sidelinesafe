// POST /api/brief: AI writes the family message in the chosen language, using ONLY the planner's facts.
// Safety facts are decided by lib/wbgt.ts; the model only does wording. Falls back to a deterministic template.
import { LANGS, templateMessage, type Facts } from "@/lib/wbgt.ts";

const FLAG_NAMES = ["Green", "Yellow", "Orange", "Red", "Black"];
const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

function parse(raw: string): { language: string; facts: Facts } | null {
  let b: { language?: unknown; facts?: Record<string, unknown> };
  try { b = JSON.parse(raw); } catch { return null; }
  const f = b?.facts;
  if (!f || !LANGS.includes(b.language as (typeof LANGS)[number])) return null;
  const facts = {
    team: f.team == null || f.team === "" ? undefined : str(f.team, 60),
    day: str(f.day, 40), oldTime: str(f.oldTime, 12), newTime: str(f.newTime, 12),
    durationMin: num(f.durationMin, 0, 600), flag: FLAG_NAMES.includes(f.flag as string) ? (f.flag as string) : null,
    breaksPerHour: num(f.breaksPerHour, 0, 6), notes: str(f.notes ?? "", 300),
  };
  if (Object.entries(facts).some(([k, v]) => v === null || (k !== "team" && v === undefined))) return null;
  return { language: b.language as string, facts: facts as Facts };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 2048) return Response.json({ error: "Request is larger than 2 KB." }, { status: 413 });
  const body = parse(raw);
  if (!body) return Response.json({ error: "Invalid language or facts." }, { status: 400 });
  const { language, facts } = body;
  const fallback = (reason: string) => Response.json({ text: templateMessage(facts), ai: false, reason });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallback("no-key");

  const prompt =
    `Write a warm, plain message (≤ 70 words) to parents in ${language}. Use ONLY these facts; copy every time and number exactly ` +
    `(keep clock times in the same digits and format, e.g. "6:00 AM"); do not add medical advice. Say plainly that the change is for heat safety. Output only the message. Facts: ${JSON.stringify(facts)}`;

  // An OpenRouter key (sk-or-…) reaches the same model through OpenRouter's Anthropic-compatible Messages endpoint.
  const viaOR = key.startsWith("sk-or-");
  try {
    const r = await fetch(viaOR ? "https://openrouter.ai/api/v1/messages" : "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", ...(viaOR ? { authorization: `Bearer ${key}` } : { "x-api-key": key }) },
      body: JSON.stringify({
        model: viaOR ? "anthropic/claude-haiku-5.5" : "claude-haiku-5-5",
        max_tokens: 300,
        thinking: { type: "disabled" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    if (!r.ok || j.stop_reason !== "end_turn") return fallback(r.ok ? `stop:${j.stop_reason}` : `api:${r.status}`);
    const text = (j.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
    // Deterministic guard: every clock time we gave must survive verbatim.
    const times = [facts.newTime, facts.oldTime].filter(Boolean).map((t) => t.split(" ")[0]);
    if (!text || times.some((t) => !text.includes(t))) return fallback("time-check");
    return Response.json({ text, ai: true });
  } catch {
    return fallback("ai-error");
  }
}
