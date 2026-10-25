import { guess } from 'web-audio-beat-detector'

export type Analysis = { duration: number; bpm: number; offset: number }

/** Decode the clip's audio on-device and find its tempo and first beat. */
export async function analyze(file: Blob): Promise<Analysis> {
  const ctx = new AudioContext()
  try {
    const audio = await ctx.decodeAudioData(await file.arrayBuffer())
    const { bpm, offset } = await guess(audio)
    return { duration: audio.duration, bpm, offset }
  } finally {
    void ctx.close()
  }
}
