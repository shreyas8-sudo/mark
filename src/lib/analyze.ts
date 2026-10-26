import { guess } from 'web-audio-beat-detector'
import { computePeaks } from './peaks'

export type Analysis = {
  duration: number
  /** The detector's guess (the First beat step confirms it), or null if it found no beat. */
  beat: { bpm: number; offset: number } | null
  peaks: Float32Array
  audio: AudioBuffer // kept in memory for the setup steps, never stored
}

/** Decode a clip's audio on-device. AudioBuffers outlive their context. */
export async function decodeAudio(src: Blob | string): Promise<AudioBuffer> {
  const data = src instanceof Blob ? await src.arrayBuffer() : await (await fetch(src)).arrayBuffer()
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(data)
  } finally {
    void ctx.close()
  }
}

/**
 * Decode the clip's audio on-device and find its tempo and first beat.
 * No beat found is not an error: the dancer sets the counts by hand.
 */
export async function analyze(file: Blob): Promise<Analysis> {
  const audio = await decodeAudio(file)
  const beat = await guess(audio).catch((err: unknown) => {
    console.warn('No beat found', err)
    return null
  })
  const ok = beat && Number.isFinite(beat.bpm) && beat.bpm > 0
  return { duration: audio.duration, beat: ok ? beat : null, peaks: computePeaks(audio.getChannelData(0)), audio }
}
