// Waveform peaks: max |sample| per bucket from channel 0. Computed once
// from the decoded audio and cached on the dance, so drawing a waveform
// never needs the audio again.

export const PEAK_BUCKETS = 4000

export function computePeaks(samples: Float32Array, buckets = PEAK_BUCKETS): Float32Array {
  const n = Math.max(1, Math.min(buckets, samples.length))
  const out = new Float32Array(n)
  const size = samples.length / n
  for (let b = 0; b < n; b++) {
    const start = Math.floor(b * size)
    const end = Math.max(start + 1, Math.floor((b + 1) * size))
    let max = 0
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i])
      if (v > max) max = v
    }
    out[b] = max
  }
  return out
}

/** Peaks for just [from, to) seconds of the audio, at a finer resolution. */
export function windowPeaks(samples: Float32Array, sampleRate: number, from: number, to: number, buckets: number) {
  const a = Math.max(0, Math.floor(from * sampleRate))
  const b = Math.min(samples.length, Math.ceil(to * sampleRate))
  return computePeaks(samples.subarray(a, Math.max(a + 1, b)), buckets)
}

/** The slice of whole-song peaks covering [from, to) seconds. */
export function slicePeaks(peaks: Float32Array, duration: number, from: number, to: number) {
  const per = peaks.length / duration
  return peaks.subarray(Math.max(0, Math.floor(from * per)), Math.min(peaks.length, Math.ceil(to * per)))
}

/** Largest peak, for normalising a drawing (never 0). */
export function peakMax(peaks: Float32Array) {
  let m = 0
  for (const v of peaks) if (v > m) m = v
  return m || 1
}
