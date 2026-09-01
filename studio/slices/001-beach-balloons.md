# Slice 001 — beach + canvas water balloons
Status: ready-to-look (tighten)
Owner: Dex
From: David 2026-09-01 ~11:29am ET. Use the beach pack, but draw tied water balloons in canvas instead of the orbs.

Repo: /workspace/mathslash (https://github.com/WillyRelwitten/MathSlash)
PLAYABLE: look. From one 90s play, it is a beach-day slash game, not Fruit Ninja. The thing you swipe is a tied water balloon with a big friendly number. Correct pops water. Wrong fizzles.

## Download (free, approved)
[Free Beach 2D Game Backgrounds](https://craftpix.net/freebies/free-beach-2d-game-backgrounds/)
Put it under `public/assets/craftpix/` in this repo. Pick the quietest of the four colorways so flying numbers stay readable. Crop/scale the vector for portrait. Landscape file can stay for wide screens.

Do **not** download the water-effects pack. Do **not** copy PipTales underwater orbs. Do **not** pay.

## Look
- Dojo photo is out. Beach is the playfield (and menus if it still reads).
- Fruit sprites are out. Home row of fruit is out.
- Each toss is a tied rubber water balloon: round body, little knot/neck, glossy highlight, beach-toy colors. Big friendly number on the face. Readable in one glance.
- Draw them in canvas. Not a PNG overlay on fruit. Not the underwater bubbles.
- Correct slash: water burst. Droplets, splash, wet celebration. No fruit halves. No red juice stains.
- Wrong slash: fizzle / deflate. Not blood. Not a fruit split.
- Swipe trail can stay. Think beat, lives, combo, problems.ts stay.

## Files Dex may touch
- `src/game/assets.ts` (drop fruit kinds; load beach bg)
- `src/game/engine.ts` (draw balloons, pop water, skip halves/juice)
- `src/game/audio.ts` only if the slice pop should sound wet instead of a fruit chop
- `src/components/overlays.tsx` (no fruit on home)
- `src/styles.css` (dojo-photo → beach)
- `public/` beach files. Fruit PNGs can stay on disk unused.

Do not edit problems.ts, store.ts, save.ts, types.ts math. No GitHub push.

## Proof
Hard-refresh the MathSlash preview (vite 8080 from `/workspace/mathslash`). Play ~90s.
- TAKEOFF: beach, not a dojo.
- TOSS: tied water balloons with numbers. Not fruit.
- CORRECT: water burst. WRONG: fizzle. Miss still costs a life.
- Prompt, lives, combo still work.

## How Rhea should look
Quote: Does it look like a beach day, not Fruit Ninja? Are the numbers on tied water balloons? Does a correct slash splash water?

## After
Mark ready-to-look in this file. Vite 8080. Stop. Tell Mission Control. No 002.

## Hop notes
- Colorway 2: `public/assets/craftpix/free-beach-2d-game-backgrounds/PNG/game_background_2/game_background_2.png` copied to `beach-landscape.png` / `beach-portrait.png` (landscape 1920x1080, portrait 1080x1920 cover-crop).
- Canvas tied rubber water balloons (beach-toy pink/yellow/cyan/lime/orange/magenta). Big number on the balloon (dark fill + light stroke), not a fruit badge disc.
- Correct: cyan/white/aqua water burst droplets. Wrong: fizzle/deflate (shrink + pale specks). Miss still costs a life.
- Vite 8080 from `/workspace/mathslash` (PipTales vite on that port stopped).


## Tighten (Rhea 2026-09-01 ~11:57am ET)
Look landed. Slash did not. ~7 drags including a serpentine over the right half. 48-frame strip: balloons float through the path intact. No swipe trail. Score stayed 0. Lives only dropped from expiry. Water burst and fizzle were never seen.

Make a swipe actually pop a balloon on this preview. A correct hit must splash water. A wrong hit must fizzle. The trail should show while you drag.

Hypothesis (check, don't assume): pointer events never reach the canvas on Rhea's hop (no trail is the tell), so mouse/touch never get a chance. Hit size / MIN_SWIPE / overlay stealing clicks are backups. Do not use debug sliceValue as the proof. Do not change the beach or balloon look.

Same repo. tsc. 8080. Ready-to-look. Stop. Tell MC. No 002.

## Tighten hop (2026-09-01 ~12:05pm ET)
Cause: pointer only on the canvas; HUD overlay sits above it. No trail = events never arrived.
Fix: window capture pointer + mouse + touch (skip buttons). Hit 1.25r. MIN_SWIPE 12. Trail 0.45s so a drag is visible.
Beach and balloon look unchanged. Proof is a real drag, not sliceValue.

Hard-refresh 8080. Drag through a balloon. Expect trail + water splash (correct) or fizzle (wrong).


## Look accepted (Rhea 2026-09-01 ~12:24pm ET)
Beach day and tied water balloons landed. Miss costs a life.
Splash/fizzle/trail unproven: Rhea's hop is slower than a 3-life expiry (~17s run, drag at ~18.6s on RUN OVER). First hop's overlay bug was the tighten. This hop did not re-prove slash is broken.
No 002 until David.


## Splash parked (David 2026-09-01 ~1:44pm ET)
David will try the slash. No longer toss for Rhea. No 002 until he asks.


## Accepted (David 2026-09-01 ~1:45pm ET)
Slice feels good. Beach, tied water balloons, slash. Splash proof parked on Rhea's hop; David felt it. No 002 until he asks.
