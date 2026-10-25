// 5-6-7-8 count-in clicks, scheduled on the Web Audio clock so they stay
// on tempo even if the main thread hiccups.

let ctx: AudioContext | null = null

/**
 * Call from a tap handler. iOS Safari keeps audio locked until a
 * user-initiated resume plus a played buffer.
 */
export function unlockAudio() {
  ctx ??= new AudioContext()
  void ctx.resume()
  const silent = ctx.createBuffer(1, 1, 22050)
  const src = ctx.createBufferSource()
  src.buffer = silent
  src.connect(ctx.destination)
  src.start()
}

const COUNTS = [5, 6, 7, 8] as const

/**
 * Click four times, `beat` seconds apart (already divided by speed).
 * `onBeat` fires as each click sounds; `onDone` fires on the following "1".
 * Returns a cancel function.
 */
export function countIn(
  beat: number,
  onBeat: (count: (typeof COUNTS)[number]) => void,
  onDone: () => void,
) {
  unlockAudio()
  const audio = ctx!
  const start = audio.currentTime + 0.08
  const nodes: OscillatorNode[] = []
  const timers: number[] = []

  COUNTS.forEach((count, i) => {
    const t = start + i * beat
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = count === 5 ? 1320 : 880 // accent the first click
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + 0.1)
    nodes.push(osc)
    timers.push(window.setTimeout(() => onBeat(count), (t - audio.currentTime) * 1000))
  })
  const end = start + COUNTS.length * beat
  timers.push(window.setTimeout(onDone, (end - audio.currentTime) * 1000))

  return () => {
    timers.forEach(clearTimeout)
    nodes.forEach((n) => {
      try {
        n.stop()
      } catch {
        // already stopped
      }
    })
  }
}
