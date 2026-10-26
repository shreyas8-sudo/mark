import { guess } from 'web-audio-beat-detector'
import { computePeaks } from './peaks'

export type Analysis = {
  duration: number
  bpm: number
  offset: number // the detector's guess; the First beat step confirms it
  peaks: Float32Array
  audio: AudioBuffer // kept in memory for the First beat step, never stored
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

/** Decode the clip's audio on-device and find its tempo and first beat. */
export async function analyze(file: Blob): Promise<Analysis> {
  const audio = await decodeAudio(file)
  const { bpm, offset } = await guess(audio)
  return { duration: audio.duration, bpm, offset, peaks: computePeaks(audio.getChannelData(0)), audio }
}
