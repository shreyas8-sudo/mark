# mark.

A practice room for learning choreography from video. Add a clip, and in under 30 seconds it's mirrored, counted in 8s and split into bars.

- **Learn**: up close. Mirror, crop to your dancer, any speed from 0.25× to 1.25× with pitch kept, jump by bar, step by beat, loop a bar, and see the count on screen.
- **Rehearse**: across the room. Pick a bar range, get a 5-6-7-8 count-in, and run loops (speed × plays) hands-free.

Everything runs in the browser. Video never leaves your device: it's stored in IndexedDB, and beat detection runs locally with the Web Audio API.

Works on phones (portrait and landscape) and laptops / TVs (≥1024px, with keyboard shortcuts).

## Keyboard (laptop)

| Key | Learn | Rehearse |
|---|---|---|
| Space | Play / pause | Pause / play |
| R | Restart | Restart loop |
| ← → | Step a beat | |
| [ ] | Prev / next bar | Prev / next loop |
| L | Loop this bar | |
| M | Mirror | |
| F | Edit frame | |
| Esc | Close popover | End rehearsal |

## Develop

```bash
npm install
npm run dev
```

```bash
npm test
```

Stack: Vite + React + TypeScript, plain CSS on the design tokens in `src/styles/tokens.css`. Runtime dependencies: `react`, `react-dom`, `web-audio-beat-detector`, `idb-keyval`.

See [SPEC.md](SPEC.md) for the full spec, acceptance criteria and build notes.
