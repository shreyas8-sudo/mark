# SPEC v2 — changes only

> Apply on top of the existing `SPEC.md` (v1). Where this file conflicts with SPEC.md or the Figma frames, **this file wins**. Everything not mentioned here stays as is.
> Source: first round of testing the live build.

## Why these changes
Testing showed three problems: the first count lands on the wrong beat, Learn and Rehearse feel too similar, and the screen gives too much space to tools and not enough to the dancer and the counts.

---

## 1. New setup step: confirm the first beat (before Setup · Frame)
- Flow becomes: Getting it ready → **Setup · First beat** → Setup · Frame → Learn.
- Show the waveform of the first ~8 seconds with beat ticks and a draggable **"1" marker** at the detected offset.
- Copy: "Is this where your first count starts?"
- ▶︎ **Preview** plays from the marker with spoken counts 1–8. **‹ ›** nudges the marker by exactly one beat. Tapping the waveform places the marker.
- **Sounds right** saves `offset`. Treat the detected offset as a first guess only.
- Compute waveform peaks once from the decoded `AudioBuffer` (channel 0, ~4000 max-abs buckets), cache them on the dance as `peaks`, and render them on `<canvas>`.

## 2. Learn becomes guided, one bar at a time
- Opening a dance goes to `currentBar` (default 1) and **loops that bar at 0.5× with spoken counts**.
- New **Got it ✓** button in the transport row. Tapping it adds the bar to `learned` and opens a small sheet: "Bar 3 learned · 3 of 14" with:
  - **Next bar** (primary): `currentBar + 1`, loops at the slow speed.
  - **Run 1–N together**: plays bars 1…N once in a row, then returns to the sheet.
  - **Rehearse what I've learned**: switches to Rehearse with range 1 → `max(learned)`.
- The user can still tap any bar to jump to it. Long-pressing a learned bar lets them untick it.
- Optional nudge after 3 loops of the same bar at the same speed: a toast saying "Feeling it? Try 0.75×" with one tap to apply. Never change speed automatically.
- Library cards show `n OF m LEARNED` instead of last speed.

## 3. Rehearse is scoped to learned bars
- Default range = bar 1 → last learned bar (bar 1 if nothing is learned yet). The user can drag the end past it.
- Everything else in Rehearse stays the same (count-in on, loops 0.5× / 0.75× / 1× × 1).

## 4. One bar waveform replaces bar chips and the 1–8 strip
- **Remove:** bar chips, the 1–8 beat strip, and the desktop **Bars panel**.
- **Add:** a single strip showing the full song waveform, split into bar chunks by thin gaps at `offset + n × barLen`.
  - Learned = solid `--mk-text-primary` at 70%. Current = `--mk-accent-primary` with a soft glow. Not yet = `--mk-glass-fill-strong`.
  - A playhead moves across the current chunk. Tap a chunk to jump to it. Long-press (or right-click) to loop it.
  - Phone: max 56px tall, scrolls horizontally to keep the current bar centred, with the bar number shown only under the current chunk. Laptop: bar numbers under every chunk.
- Rehearse · Setup uses the same strip with a draggable range selection instead of the 14-cell bar strip.
- Keep ‹ › step-a-beat.

## 5. Big pulsing count
- At least **2× the current size**: about 96px on phone (top-right), 160–200px on laptop (beside the video frame). Use tabular digits.
- On every beat the number swaps and scales 1 → 1.25 → 1 over ~180ms (`cubic-bezier(.2,.8,.2,1)`). **Count 1** pulses to 1.35 and flashes the accent colour.
- The 5-6-7-8 count-in uses the same display, in the accent colour.
- Under `prefers-reduced-motion`: swap only, no scale.
- Also shown in Rehearse · Running.

## 6. Spoken counts, on by default
- Ship `/public/voice/1.mp3` … `8.mp3` and `your-turn.mp3`. **Don't use `speechSynthesis`**, because it lags and drifts.
- Decode the clips once and schedule each on the `AudioContext` at the exact beat time (adjusted for `playbackRate`). Re-sync on every play and seek.
- Sound options become: **Voice counts** (default in Learn, video muted) · Music + voice (voice at ~70%) · Music only (default in Rehearse).
- `sound` type changes to `'voice' | 'music+voice' | 'music'`.

## 7. Defaults
- Default speed **0.5×** (was 1×).
- Default sound in Learn: **Voice counts**.
- Learn count-in (5-6-7-8) toggle moves into the **right rail** as its own button, so it's visible without opening Sound.

## 8. Tap anywhere to pause
- Tapping the video toggles play/pause in Learn and Rehearse. Taps on controls, the waveform, pinch and swipe don't.
- Keep the visible Play/Pause and Restart buttons.

## 9. Video as big as possible
- The video stage is sized to the largest area the viewport allows using `object-fit: contain` logic (respecting the user's crop). No UI sits over the dancer's body except the floating glass controls.
- **Laptop (Learn and Rehearse):** remove both side panels (Bars, Tools / This run, Keyboard). One bottom row **≤ 72px**: bar waveform · transport · speed (Learn) or loop pill (Rehearse) · Got it ✓ / End. Tools (sound, mirror, count-in, frame) become small glass icons over the top-right of the video, each opening a popover. Keyboard hints move to a `?` popover.
- **Phone:** waveform + transport together take ≤ 160px.

## 10. Onboarding (first visit only)
- 3 dismissible coach marks over the demo in Learn:
  1. "Tap a chunk to jump to a bar"
  2. "Start slow. Speed up when it clicks"
  3. "Got it? Tap ✓, then rehearse what you've learned"
- Skip link. Stored in localStorage so they never show again.

## 11. Stretch: "Your turn" echo mode
- A toggle in Learn's Sound popover. The video plays counts 1–4, then pauses while the voice says "your turn" and counts 5–8 for the user, then repeats.

---

## Data model additions
```ts
peaks: Float32Array;   // cached waveform
learned: number[];     // bars marked "Got it"
currentBar: number;    // where guided Learn resumes (default 1)
speed: number;         // default 0.5
sound: 'voice' | 'music+voice' | 'music';
// run.barEnd defaults to max(learned) || 1
```

## Keyboard additions
`Enter` = Got it ✓ (Learn) · `?` = show shortcuts

## New tests
| Scenario | Expected |
|---|---|
| Detector puts "1" late, user drags marker to the real downbeat | Preview counts land on the moves, Learn bar 1 starts there |
| Tap › once in First beat | Marker moves exactly one beat |
| Open a new dance | Bar 1 loops at 0.5× with spoken 1–8 |
| ✓ on bar 1 → Next bar | Bar 1 chunk fills, bar 2 loops at 0.5× |
| Learned 1–3 → Run 1–3 together | Bars 1–3 play once in a row, then the sheet returns |
| Learned 1–3 → Rehearse | Range preset to 1 → 3, can drag to 5 |
| Play at 1× | Count pulses every beat, count 1 is bigger and accent-coloured |
| Voice mode at 0.5× | Spoken counts stay on the beat across a 4-bar loop |
| Tap the dancer | Pauses. Tapping the waveform seeks, it doesn't pause |
| Laptop 1440×900, vertical clip | Video fills the height above the ≤72px bar, no side panels |
| Learn 2 bars, reload | Learned bars and offset restored |
| First visit | 3 coach marks show, Skip hides them permanently |

## Removed from v1
- Bar chips, the 1–8 beat strip, desktop Bars panel, desktop Tools / This run / Keyboard panels.
- "Last speed" on library cards.
- "No manual count correction" in *What not to build*: it's now built (First beat step).
- Spoken counts as a stretch goal: they're now core.

## Build order
1. First beat step + waveform peaks
2. Big pulsing count, tap to pause, video sizing, laptop panels removed
3. Bar waveform strip (phone, landscape, laptop, Rehearse setup)
4. Spoken counts + new defaults
5. Guided Learn (Got it ✓, sheet, learned state, scoped Rehearse)
6. Onboarding
7. Stretch: echo mode, speed-up nudge

---

## Build notes (v2, decisions made while building)

- **Count-in stays as beeps** (owner's call); spoken counts are 1–8 only.
- **Voice clips** are generated offline with macOS "Samantha", trimmed to the word onset and loudness-normalised (`public/voice/`). Scheduled on the AudioContext clock; measured within about ±8 ms of the beat in Chrome.
- **First beat:** the 1 can be dropped anywhere (not just on the detected grid), snapping to a clear hit's onset within ±60 ms. The video scrubs with the marker while dragging. Also reachable later from the library ⋯ menu ("Change first beat").
- **Layout (owner's direction after step 2):** the big count stays on the left; the 1–8 strip and bar chips are replaced by the bar waveform strip; on phone the transport floats over the bottom of the video, and the strip is the only band below it (97 px). The video stops above the strip in portrait and landscape, so nothing covers the dancer's feet.
- **Phone transport:** Restart · ‹ beat · ▶︎ · beat › · speed · ✓. Previous/next bar is done by tapping the strip (`[ ]` on laptop).
- **Long-press / right-click on the strip:** unticks a learned bar; loops any other bar.
- **Rehearse:** music only by default, with an optional "Spoken counts" toggle in setup. The range follows the last learned bar until the dancer drags it.
- **Echo mode (rhythm kept):** the video plays 1–3, the voice says "your turn" on 4, the video freezes on 5, the voice counts 5–8 on the beat, and the video restarts on the next 1 (the voice says that 1). Taken literally, the spec's "pause, then say your turn, then 5–8" would add a beat to every bar.
- **Speed nudge:** after 3 laps of the same bar at the same speed, a toast suggests the next preset (0.5 → 0.75 → 1 → 1.25). It's shown once per bar and speed, auto-hides after 8 s, and never changes speed by itself.
- **Not verified on a real device:** iPhone audio (ringer switch, count-in, voice), pinch, long-press feel, and timing on a visible screen (all measurements were taken in a background browser pane, where frame callbacks are throttled).
