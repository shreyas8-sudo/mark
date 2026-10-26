import { describe, expect, it } from 'vitest'
import { migrate } from './migrate'

describe('migrate', () => {
  it('upgrades a v1 record', () => {
    const m = migrate({ id: 'a', lastSpeed: 0.75, sound: 'music+counts' })
    expect(m).toMatchObject({ id: 'a', speed: 0.75, sound: 'voice', countIn: true })
    expect(m).not.toHaveProperty('lastSpeed')
  })

  it('keeps v1 "music" as music only', () => {
    expect(migrate({ sound: 'music' }).sound).toBe('music')
  })

  it('leaves a current record alone', () => {
    expect(migrate({ speed: 1, sound: 'music+voice', countIn: false })).toMatchObject({
      speed: 1,
      sound: 'music+voice',
      countIn: false,
    })
  })

  it('defaults to 0.5× with voice counts', () => {
    expect(migrate({})).toMatchObject({ speed: 0.5, sound: 'voice', countIn: true })
  })
})
