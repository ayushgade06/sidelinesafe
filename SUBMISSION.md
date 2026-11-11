# Devpost submission: SidelineSafe

**Title:** SidelineSafe: the heat-safety practice planner for teams without a trainer

**Tagline:** Don't just read the heat. Plan around it.

**Pathway:** Hackathon (working, deployed prototype)

**Links**
- Live app: https://sidelinesafe.deployxa.online (deployed on Deployxa)
- Demo week (one click): https://sidelinesafe.deployxa.online/?name=Houston%2C+Texas%2C+US&lat=29.763&lon=-95.363&cat=3&src=replay&date=2023-07-10&tab=plan
- GitHub: https://github.com/ayushgade06/sidelinesafe
- Domain-ready brand: sidelinesafe.xyz

---

## Inspiration
Exertional heat stroke is a leading cause of death in US high-school sports, and it's almost always preventable. About **34% of US secondary schools with athletics have no athletic trainer** (Sports Health, 2024, PMC11635796). Youth rec leagues, camps and marching bands usually have nobody at all.

The tool that prevents these deaths is the **WBGT** heat index plus the US Soccer / Korey Stringer Institute activity guidelines. But a WBGT meter costs hundreds of dollars and only tells you about *right now*. Practices are planned days ahead by volunteer coaches who've never seen the guideline.

## What it does
SidelineSafe answers the question coaches actually have: **"When should my team practice this week, and what exactly do we do then?"**

- **Plan:**
  - Enter your city and schedule (e.g. Mon/Wed/Fri 4 PM, 2 h).
  - Every practice gets a flag (Green → Black) from the hourly forecast, rated by its *hottest* hour.
  - It finds the **safest window** each day and applies the guideline's cap (Orange 2 h, Red 1 h, Black cancel).
  - It builds a **printable practice card** with water breaks as real clock times.
  - The URL is the plan: share it, no login.
- **Message families:** one tap writes a parent message in 10 languages. The day, times and flag come from the plan; AI only does the wording.
- **Now:** a big current flag, when it changes next, an "I have a meter" override, and a heat log with CSV export.
- **Learn:** sliders that show why 85°F at 80% humidity (86.9°F WBGT) is more dangerous than 95°F at 15% (80.3°F).
- **Replay mode:** pick any past week from the historical archive. That's how we demo summer heat in November.

**Headline result** (real data, Houston, Wed 12 Jul 2023):
> 4:00 PM → ✕ RED ≈90.4°F, max 1 hr. **Move to 6:00 AM → ! YELLOW, full 2 hrs.** Breaks at 6:20, 6:40, 7:00, 7:20, 7:40 AM.

## How we built it
- **Next.js + TypeScript + Tailwind**, no other dependencies. The chart is hand-written SVG; the AI call is plain `fetch`.
- **Weather:** Open-Meteo forecast, archive and geocoding APIs. These are free, global and keyless, and we fetch them hourly.
- **Science (`lib/wbgt.ts`, pure functions):**
  - The **Ono & Tonouchi (2014)** WBGT regression, used by Japan's Ministry of the Environment for its heat-illness forecasts. We verified all 7 coefficients against the paper.
  - The **US Soccer / KSI** regional flag table, verbatim.
  - The planner, the break scheduler, and the next-flag-change finder.
- **Tested:** `node lib/wbgt.check.ts` asserts every flag boundary in all 3 regions, monotonicity, the humid-beats-dry claim, the planner (minimum-risk window, Red caps 120 → 60 min, Black cancels, keeps an already-safe time), break times, and the message template.
- **AI:** `/api/brief` sends only the planner's facts to Claude Haiku 5.5.
  - The request body is ≤ 2 KB and the language must be on an allowlist.
  - A **deterministic guard** throws out any AI text that doesn't contain every clock time verbatim and falls back to a template.
- **Accessible:**
  - Every flag is icon + text, never color alone, with WCAG AA contrast.
  - Keyboard tabs (arrow keys), focusable chart bars with tooltips, and the chart data as a table.
  - Works at 360px.
  - The print stylesheet prints only the card.

## Challenges we ran into
- **November demo of a summer problem.** We added a replay mode over the historical archive, then scanned three summers to find real weeks that hit Red and Black. Houston had zero Red 4 PM practices in 2024–2025 under the regression but 13 in 2023.
- **A physics bug in a published formula's range.** The SR² term makes the regression *decrease* when sun exceeds 0.836 kW/m², and desert noon gets close to that. We hold sun at the peak, which is conservative, and the self-check guards it.
- **Over-eager planner.** Pure "minimize WBGT" told coaches to move already-Green practices to 6 AM. We added a rule: keep the usual time if moving wouldn't lower the flag.

## Accomplishments we're proud of
- Every safety decision is deterministic, cited and tested. AI only touches wording, and even that gets a deterministic check.
- It works anywhere in the world with no meter, no account and no cost.

## What we learned
Humidity matters more than temperature. The planner is only safe if it's conservative (worst hour, not average) and honest about uncertainty (±2°F, meter override).

## What's next
Push/SMS sending, team rosters, the 14-day heat-acclimatization tracker, lightning and AQI, and calibration against school meter data.

## Built with
Next.js, TypeScript, Tailwind CSS, Open-Meteo API, Claude API (Claude Haiku 5.5), Deployxa.

## AI and third-party disclosure
- Claude Code helped write the code.
- The Claude API writes the family messages.
- Weather data by Open-Meteo.com (CC BY 4.0).
- Guidelines from US Soccer and the Korey Stringer Institute.
- WBGT formula from Ono & Tonouchi (2014).
- Built with Next.js.

---

## Rubric → evidence

| Criterion | Evidence we show |
|---|---|
| Innovation & Originality | Other WBGT apps read the current heat. SidelineSafe **plans forward and prescribes action**: the safest window, a time cap, water-break clock times, and a family message in the parents' language. |
| Technical Execution | Real global weather (forecast and archive), a **peer-reviewed formula verified against the paper**, a tested planner (`node lib/wbgt.check.ts`), and server-side AI with validation, a deterministic time guard and a template fallback. No dependencies beyond Next.js. |
| Impact & Relevance | Cited death and trainer-gap statistics. Named users (volunteer coach, AD/trainer, parents, athletes). Free, global and login-free, so it fits nonprofits, youth leagues, camps and YMCAs. |
| Functionality & UX | Works live on Deployxa. Mobile-first at 360px, icon + text flags, AA contrast, keyboard-navigable, chart-as-table, printable card, share link with no login. |
| Presentation & Communication | The video follows one coach's real Houston week, explains the science with sliders, and every number has a source. |
