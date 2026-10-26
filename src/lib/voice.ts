// Spoken counts "one"…"eight", decoded once and played on
// the AudioContext clock. Never speechSynthesis: it lags and drifts.
import { audioContext } from './countIn'

export type VoiceName = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
const NAMES: VoiceName[] = ['1', '2', '3', '4', '5', '6', '7', '8']

type Clip = { buffer: AudioBuffer; lead: number }
let loading: Promise<Map<VoiceName, Clip>> | null = null

/**
 * Seconds of near-silence before the word starts (MP3 encoder padding plus
 * breath). Scheduling `lead` early puts the word's onset on the beat.
 */
function onset(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > 0.02) return i / buffer.sampleRate
  return 0
}

export function loadVoices() {
  loading ??= (async () => {
    const ctx = audioContext()
    const entries = await Promise.all(
      NAMES.map(async (name) => {
        const res = await fetch(`/voice/${name}.mp3`)
        const buffer = await ctx.decodeAudioData(await res.arrayBuffer())
        return [name, { buffer, lead: onset(buffer) }] as const
      }),
    )
    return new Map(entries)
  })()
  loading.catch(() => {
    loading = null // allow a retry after a network blip
  })
  return loading
}

export type Scheduled = { cancel: () => void }

/** Play each clip so its word starts at `at` (AudioContext time). */
export function playVoices(
  voices: Map<VoiceName, Clip>,
  items: { name: VoiceName; at: number }[],
  volume = 1,
): Scheduled {
  const ctx = audioContext()
  const gain = ctx.createGain()
  gain.gain.value = volume
  gain.connect(ctx.destination)
  const sources: AudioBufferSourceNode[] = []
  for (const { name, at } of items) {
    const clip = voices.get(name)
    if (!clip) continue
    const start = at - clip.lead
    if (start < ctx.currentTime - 0.01) continue // already past
    const src = ctx.createBufferSource()
    src.buffer = clip.buffer
    src.connect(gain)
    src.start(Math.max(start, ctx.currentTime), Math.max(0, ctx.currentTime - start))
    sources.push(src)
  }
  return {
    cancel: () => {
      for (const s of sources) {
        try {
          s.stop()
        } catch {
          // already ended
        }
      }
      gain.disconnect()
    },
  }
}
