# Back PT Flow Tracker

A personal, mobile-first low-back recovery coach that runs entirely in the browser —
no backend, no account, no tracking. Built for a 10-day progressive recovery plan for
an acute mechanical low-back flare, with heavy desk-work survival tooling (a 25/90
work/break timer) because the owner sits at a computer ~12 hours a day.

**This is not a diagnosis app.** It encodes conservative, evidence-aware
self-management guidance (NICE NG59, NHS, ACP 2017, AAOS spine conditioning,
ChoosePT/APTA, and the WalkBack walking evidence). Red flags always override
progression, streaks, and badges.

## What it does

- **Overview** — where you are in recovery: day/phase, today's decision, completion,
  trends (pain, spikes, abdominal pressure, walking, sitting), recovery score, badges,
  next action, and extend/graduate recommendations after Day 10.
- **Today** — morning check-in, "right now" check-in, red-flag check, the day's
  prescription (base vs. adjusted), exercise cards with dose/why/stop-rules/swap/
  illustration/source links, the 25-minute work / 90-second movement-break desk timer,
  and the evening review.
- **Library** — ~30 exercises filterable by training element (relief, walking,
  mobility, activation, stability, functional load, desk reset), stretch/strength,
  safe-when-flared, and avoid-if-spreading. Every prescribed task has **Swap**, which
  offers same-element substitutes at equal-or-lower irritability on yellow/red days.
- **Flow** — the visible decision flowchart with today's path highlighted, so the app
  never feels like a black box.
- **Progress** — every trend, the transparent recovery-score breakdown, decision
  history, and the raw data table (no fake confidence).
- **Settings** — start date, phase override, JSON export/import, URL-hash backup link,
  reset, and a plain-text clinician summary for a PT/doctor visit.

### The decision engine

A pure, unit-tested function maps each day's inputs to one of:
`GET_CHECKED` → `BACK_OFF` → `HOLD` → `DO_MINIMUM` / `ADVANCE`, plus Day-10+
`GRADUATE` / `EXTEND` / formal-help logic. Red flags (new leg weakness, saddle
numbness, bladder/bowel changes, fever, blood, worsening deep abdominal pain, or
abdominal pressure ≥ 7/10) always short-circuit to **Get Checked** and silence all
celebratory UI.

Data lives in `localStorage`, is mirrored into the URL hash after every change (a
bookmark doubles as a backup), and can be exported/imported as JSON.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # decision engine / adjuster / score unit tests (vitest)
npm run build      # typecheck + production build
npm run e2e        # Playwright end-to-end tests (builds are served via vite preview)
npm run icons      # regenerate the placeholder PNG app icons
```

Stack: Vite + React + TypeScript. No runtime dependencies beyond React. Charts and
exercise illustrations are hand-rolled inline SVG. PWA manifest + a minimal
offline-assets-only service worker (registered in production builds only).

## Deploying to GitHub Pages

The app is built with `base: "/pt-progression/"` (see `vite.config.ts`). If your repo
has a different name, change that value to `"/<repo-name>/"`.

### Option A — GitHub Actions (recommended, already set up)

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually). `.github/workflows/deploy.yml`
   runs the unit tests, builds, and publishes `dist/` to Pages.
4. The app appears at `https://<username>.github.io/pt-progression/`.

### Option B — manual

```bash
npm run build
# publish the dist/ folder to the gh-pages branch, e.g.:
git checkout --orphan gh-pages && git rm -rf . && cp -r dist/* . && git add -A && git commit -m "deploy" && git push -u origin gh-pages
```

Then set **Settings → Pages → Source: Deploy from a branch → gh-pages / root**.

## iPhone Safari manual test checklist

Run through this once on the real phone at the real HTTPS Pages URL:

1. **Load** — open `https://<username>.github.io/pt-progression/` in Safari. The app
   renders with no horizontal scrolling and the bottom nav clears the home indicator.
2. **Install** — Share → *Add to Home Screen*. Icon and name ("Back PT") appear;
   launching from the home screen opens standalone (no Safari chrome).
3. **Check-in** — drag the "Pain on waking" slider; stiffness/sleep/worse-than-
   yesterday controls appear; the decision banner updates live.
4. **Decisions** — set "Pain right now" to 7 → banner flips to *Back Off* and the
   plan regresses. Set abdominal pressure to 7 → *Get Checked*, celebration UI stays
   off. Flip a red-flag toggle → *Get Checked*. Reset them and confirm it recovers.
5. **Flowchart** — Flow tab shows the highlighted path matching the banner.
6. **Tasks** — tap a task's circle: satisfying pop animation; tap **Why?** for the
   tooltip; tap the card for the illustration and source links (links open in a new
   tab); tap **Swap** and pick a substitute — the card swaps and persists.
7. **Timer** — start a work block, background Safari for a minute, return: the
   countdown reflects real elapsed time (timestamp-based). Let a block finish with the
   phone unlocked: it flips to the 90-second break (vibration if supported/enabled)
   and increments the day's block count.
8. **Persistence** — force-quit Safari, reopen: all data still there. "Last saved"
   timestamp visible in Settings.
9. **Export/import** — Export JSON downloads a file (Files app); Import restores it.
   *Copy URL backup link* → paste into a note → open in a private tab → data restores
   from the hash.
10. **Evening review** — fill it in; completion below 50% turns the next decision to
    *Hold*; the Progress tab shows the day in trends, decision history, and raw table.
11. **Offline** — after one full load, enable Airplane Mode and relaunch from the home
    screen: the app shell still loads (service worker), and your data is intact.
12. **Dark mode** — toggle iOS dark mode: the whole app (charts included) restyles.

## Automated tests

- `src/engine/*.test.ts` — 55 unit tests over the decision rules, graduation/extension
  logic, plan adjustment, swap eligibility, data integrity, and the recovery score.
- `e2e/app.spec.ts` — 14 Playwright tests: navigation, sliders driving decisions,
  flowchart highlighting, task completion + badges, swap flow, localStorage
  persistence, URL-hash restore, JSON export/import, and clock-driven desk-timer
  transitions (including reload survival).

## Sources encoded in the app

- NICE NG59 — https://www.nice.org.uk/guidance/ng59/chapter/Recommendations
- NHS back pain — https://www.nhs.uk/conditions/back-pain/
- ACP 2017 guideline — https://pubmed.ncbi.nlm.nih.gov/28192789/
- AAOS Spine Conditioning Program — https://orthoinfo.aaos.org/en/recovery/spine-conditioning-program/
- ChoosePT (APTA) low back pain guide — https://www.choosept.com/guide/physical-therapy-guide-low-back-pain
- Walking & recurrence (WalkBack explainer) — https://www.theguardian.com/society/article/2024/jun/19/walking-three-times-a-week-nearly-halves-recurrence-of-low-back-pain

If symptoms worsen, spread, or new red flags appear — stop and see a human.
