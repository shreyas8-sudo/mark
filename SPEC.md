# Spec: mark. — a practice room for learning choreography from video

> Living document. Source of truth for the build. Update it when decisions change.
> Design source: Figma file **Palantir Design Challenge** → page **Hi-fi** (section "Hi-fi v1 · mark.") and page **Brand** (design system). Tokens: `tokens.css` (exported from Figma).
> Built solo by Shreya Shanmugam for the Palantir product design challenge (Lens A: Make it work). Time-boxed to **3 hours of build**.

---

## What

A responsive web app (phone first, works on laptop/TV) that turns any dance video into a practice session in under 30 seconds. Everything runs in the browser. Nothing is uploaded.

It has two modes, which share one video and one set of bars:

- **Learn** (blue accent): up close, breaking down nuance. Mirror, crop to the dancer, any speed with the pitch kept, navigate by **bars** (1 bar = 8 counts) and by single beats, loop one bar, and see the current count on screen.
- **Rehearse** (coral accent): running it from across the room. Pick a bar range, get a 5-6-7-8 count-in, and run a sequence of **loops** (each loop = a speed × a number of plays) hands-free, with big controls and a clear way out.

Flow: **Library → Add a dance → Getting it ready (mirror, beat, bars) → Setup · Frame → Learn ⇄ Rehearse.** Setup runs once per dance. After that a dance opens straight into Learn.

Stack: **Vite + React + TypeScript**, plain CSS using `tokens.css` (Tailwind optional, mapped to the same vars), deployed as a static site on **Vercel**. No backend.

## Why

Learning choreography from a TikTok today means screen recording it, mirroring it in Photos, sending it to yourself, importing it into iMovie, zooming in by hand, and picking from preset speeds. That's about 10 steps across 4 apps before you dance a single count. Even then the tools are built for editing a movie: there's no count-in, restart is hidden, and you navigate by timestamps instead of counts.

The insight from mapping my own practice: learning a dance is two different jobs. **Learning** happens on the phone, close up. **Rehearsing** happens at a distance, often on a bigger screen. Existing apps (DanceBeat, LeapNow, STEEZY) treat practice as one generic player. This is for dancers who learn from video. I'm the first user, and the dance team I'm on is the second.

---

## Screens (map 1:1 to Figma frames)

| # | Figma frame | Purpose | Key elements |
|---|---|---|---|
| 01 | Library | Home | `mark.` wordmark, "Your dances", **+** (only add CTA), 2-col grid of tall cards (thumb, name, `0:48 · 4 BARS · 0.75×`), DEMO tag, **⋯** per card |
| 01a | Library · Delete | Card menu | Rename (edit icon), Change frame, **Delete dance** (danger) |
| 01b | (empty state) | No dances yet | Big dropzone "Add your first dance" + "Try the demo clip" |
| 02 | Getting it ready | Processing | Thumbnail, checklist: Mirrored ✓ · Found the beat · 96 BPM ✓ · Split into 14 bars ✓ → **Check the frame** |
| 03 | Setup · Frame | Crop | Pinch/drag crop box, "Is this the right frame?", Vertical/Horizontal, Mirror toggle (on), Reset / **Looks right** |
| 04 | Learn | Practice | Full-bleed video, top: back · **LEARN · REHEARSE** · ⋯, count badge (`3 OF 8`), right rail (Sound, Mirror, Loop, Frame), bottom: bar chips, beat scrubber (counts 1–8, ‹ › step a beat), transport (Restart · Prev bar · ▶︎ shutter · Next bar · speed pill `0.6×`) |
| 05 | Learn · Speed | Popover | Value `0.60×`, slider 0.25–1.25, chips 0.5×/0.75×/1×, "PITCH KEPT" |
| 06 | Learn · Sound | Popover | Music · Music + counts · Counts only |
| 07 | Rehearse · Setup | Configure run | Bar range strip (drag ends, default 1→4), Count-in toggle (on), LOOPS list (default 0.5× / 0.75× / 1×, × 1 each, delete per row), + Add loop, **Start rehearsing** |
| 07a | Rehearse · Add loop | Sheet | Speed slider + chips (0.5–1.25), Plays stepper (× n), Cancel / **Add loop** |
| 08 | Rehearse · Running | Hands-free | Video only (no giant count), pill `LOOP 1 OF 3 · 0.5×`, `BARS 1 → 4`, loop progress chips, transport (Prev loop · Restart · ▶︎ · Next loop), **End rehearsal** at the bottom |
| 09 | Learn · Landscape | Phone, horizontal | Camera-app layout: shutter column on the right, tools row at the top, bars + beat scrubber at the bottom |
| 10 | Rehearse · Laptop/TV | ≥1024px | Video at its real aspect, centred, with a blurred ambient backdrop. "This run" panel on the right, keyboard card on the left. **Docked bottom bar**: bar/count timeline, loop status, transport, End rehearsal |
| 11 | Learn · Laptop | ≥1024px | Same frame as 10. Left: **Bars list** (click to jump, double-click to loop). Right: **Tools** inline (speed slider, sound segmented control, mirror, edit frame). Bottom bar: beat timeline, step-a-beat, transport + loop, shortcut hints |

Use Figma MCP `get_design_context` on these frames for exact layout. Use `tokens.css` for every colour, radius, space and type style. Don't hardcode hex values.

---

## Core logic

**Data model (IndexedDB, on-device)**
```ts
type Dance = {
  id: string; name: string; createdAt: number;
  video: Blob;                 // original file
  duration: number;            // seconds
  bpm: number; offset: number; // from beat detection; offset = time of first "1"
  bars: number;                // floor((duration - offset) / barLen)
  mirror: boolean;             // default true
  crop: { x: number; y: number; w: number; h: number }; // normalized 0–1
  orientation: 'vertical' | 'horizontal';
  lastSpeed: number;           // remembered per dance
  sound: 'music' | 'music+counts' | 'counts';
  run: { barStart: number; barEnd: number; countIn: boolean;
         loops: { speed: number; plays: number }[] };  // default 1→4, [0.5,0.75,1] ×1
};
```

**Beat → counts**
```ts
const beatLen = 60 / bpm;          // seconds per count at 1×
const barLen  = beatLen * 8;
const beatIndex = Math.floor((t - offset) / beatLen);
const count = (beatIndex % 8) + 1; // 1–8, shown in the count badge
const bar   = Math.floor(beatIndex / 8) + 1;
```
Drive the UI from `requestVideoFrameCallback` (fallback: `requestAnimationFrame`) reading `video.currentTime`, not from `timeupdate`, which is too coarse.

**Beat detection:** decode the file's audio with `AudioContext.decodeAudioData(await file.arrayBuffer())` and run `web-audio-beat-detector`'s `guess(audioBuffer)` → `{ bpm, offset }`. The demo clip ships with precomputed `{bpm, offset}` in JSON so it opens instantly.

**Playback**
- Speed: `video.playbackRate` (0.25–1.25) with `video.preservesPitch = true`.
- Mirror: CSS `transform: scaleX(-1)` on the video only, never on the UI.
- Crop: the video sits inside an `overflow:hidden` stage and is scaled and translated from `crop`. Don't re-encode.
- Loop a bar: when `t >= barEnd`, set `currentTime = barStart`.
- Step a beat: `currentTime = offset + (beatIndex ± 1) * beatLen`, paused.

**Count-in (5-6-7-8):** pause at the loop start, then schedule 4 clicks (or voice clips) with Web Audio at `beatLen / speed` spacing, then play. A large overlay shows 5 · 6 · 7 · 8.

**Rehearse runner:** a state machine `idle → countIn → playing(loopIdx, playIdx) → (next play | next loop | done)`. Prev/next loop jumps `loopIdx`. Restart re-enters `countIn` for the current loop. End returns to Rehearse · Setup.

**Keyboard (laptop):** Space play/pause · R restart · ← → step a beat · [ ] prev/next bar (Learn) or loop (Rehearse) · L loop bar · M mirror · Esc end.

**Responsive:** `<768px` portrait = screens 04–08. Landscape phone (`orientation: landscape` and height `<500px`) = 09. `≥1024px` = 10/11 layouts.

---

## Acceptance Criteria

**Setup**
- [ ] From the Library, a user can add a local video (mp4/mov) with one tap on **+**.
- [ ] After adding, the app automatically mirrors it, detects the BPM and first beat, and splits it into bars, showing each step as it completes.
- [ ] Setup · Frame lets the user pinch/drag (touch) or drag/scroll (mouse) to crop, toggle mirror, and switch Vertical/Horizontal. **Looks right** saves the settings and opens Learn.
- [ ] Dances persist across reloads (IndexedDB). Cards show name, length, bars and last speed. ⋯ lets the user rename or delete a dance, and change its frame.
- [ ] The demo dance is available on first load without uploading anything.

**Learn**
- [ ] The count badge shows the current count (1–8) in sync with the music, to within one beat.
- [ ] Tapping a bar chip jumps to the start of that bar. ‹ › steps exactly one beat.
- [ ] Speed can be set to any value from 0.25 to 1.25 by slider, or to a preset by chip. Pitch doesn't change, and the speed is remembered per dance.
- [ ] Loop on repeats the current bar seamlessly.
- [ ] Restart and Play/Pause are always visible, labelled buttons. There are no hidden gestures.
- [ ] Sound: **Music + counts** shows the badge. **Music** hides it.

**Rehearse**
- [ ] Defaults to bars 1→4 with count-in on and three loops: 0.5×, 0.75×, 1×, each played once.
- [ ] The user can change the bar range, add a loop (speed + plays), and delete a loop.
- [ ] **Start rehearsing** plays the 5-6-7-8 count-in, then runs every loop in order with no taps needed. The pill always shows `LOOP n OF N · speed`.
- [ ] Prev loop, Next loop, Restart and Pause work mid-run. **End rehearsal** stops and returns to setup.
- [ ] The accent switches to coral in Rehearse and back to blue in Learn (via `data-mode`).

**Platform**
- [ ] Works on iPhone Safari (`playsinline`, audio unlocked on first tap) and desktop Chrome.
- [ ] Laptop layout (≥1024px) shows the video at its real aspect with the docked bottom bar, and all keyboard shortcuts work.
- [ ] Deployed on Vercel at a public URL, loads in under 3s on 4G, and no video data leaves the device.

## Tests / Success Criteria

| Scenario | Input | Expected |
|---|---|---|
| Demo opens | First visit → tap demo card | Learn loads in under 2s with counts in sync, mirrored |
| Steady tempo | 96 BPM clip, tap bar 3 | Video jumps to `offset + 2 × barLen`, badge shows 1 |
| Speed | Set 0.6× | `playbackRate === 0.6`, audio pitch unchanged by ear, badge still in sync |
| Step | Paused on count 3, tap › | Paused on count 4, exactly `beatLen` later |
| Loop bar | Loop on at bar 5 | After count 8 it returns to count 1 of bar 5, repeatedly |
| Default run | Start rehearsing, defaults | 5-6-7-8 → bars 1–4 at 0.5× → 0.75× → 1× → done state |
| Edit run | Delete loop 02, add 1.25× × 2 | Runner plays 0.5×, 1×, 1.25×, 1.25× |
| Persistence | Add a clip, reload | Clip, crop, mirror and last speed are restored |
| Delete | ⋯ → Delete dance | Card removed, IndexedDB entry gone |
| iOS audio | Fresh iPhone Safari session | First tap unlocks audio, count-in clicks are audible |
| Laptop keys | Space, R, ←, →, [, ], Esc | Each does the documented action |
| Tempo-change mix (known risk) | Desi comp mix with tempo changes | Counts may drift. Documented as a known limit; future fix is tap-to-sync |

**Manual QA before submitting:** real iPhone (portrait + landscape), MacBook Chrome, and a TV via AirPlay or HDMI.

## Alternatives (What Not to Build)

- **No backend, accounts, cloud storage or analytics.** Everything stays on the device. Cloud library is a future feature.
- **No Watch mode.** It was cut because it's covered by Learn.
- **No cue words** ("kick back side") **and no per-section mirror flip.** Both were cut: one isn't needed, the other is too confusing.
- **No AI pose comparison, AI move breakdown or musical-hit detection** in the MVP. These are future features. Musical hits is a stretch goal only if time remains.
- **No manual count correction / tap-to-sync** in the MVP. That's future work if detection lands on the wrong beat.
- **No direct import from TikTok/Instagram** and **no voice control.** Both are future features.
- **No re-encoding or exporting video.** Mirror and crop are display-only.
- **"Counts only" voice sound** is a stretch goal: 8 short recorded clips, played on the beats.

## Constraints

**Never:** upload user video anywhere; add a server or database; hardcode colours or fonts outside `tokens.css`; ship copyrighted choreography footage as the demo (use my own recorded clip).
**Ask first:** adding any dependency beyond `react`, `react-dom`, `web-audio-beat-detector`, `idb-keyval` (or `idb`); changing the screen flow; anything that would push the build past the 3-hour cap.

## Build order (3-hour budget, deploy after each phase)

1. **0:00–0:15** Scaffold Vite + React + TS, add `tokens.css` and fonts, deploy an empty app to Vercel.
2. **0:15–0:55** Core: file input → `<video playsinline>`, mirror, crop stage, speed slider with pitch kept. Demo clip + JSON.
3. **0:55–1:40** Counts: beat detection, bar/count math, count badge, bar chips, beat scrubber, step, loop bar.
4. **1:40–2:20** Rehearse: setup screen (range, count-in, loops CRUD), runner state machine, Running screen, End.
5. **2:20–2:45** Library + IndexedDB persistence, delete/rename, responsive landscape and laptop layouts, keyboard.
6. **2:45–3:00** Glass polish, iPhone test, fix the worst bug, final deploy.

If a phase overruns, cut from the end: laptop panels → landscape → rename. Never cut Learn or Rehearse.

## Open questions

- Is the demo clip my own recording? (Required before a public deploy.)
- Exact BPM/offset of the demo clip: compute once and commit it as JSON.
