import { describe, expect, it } from 'vitest'
import {
  MOOD_DEFAULT, averageMood, clampMood, decayMood, moodBandOf, petMood, withMoodDelta,
} from '../src/core/mood.ts'
import type { Pet } from '../src/core/types.ts'

const PET: Pet = {
  id: 'p_000001', name: 'x',
  traits: { species: 'cat', body: 'small', ears: 'erect', fur: 'white', pattern: 'solid', tail: 'long', eyes: 'amber', accessory: 'none' },
  passion: 50, arrivedAt: 0, locked: false, cycle: 1,
}

describe('心情（H1/H2）', () => {
  it('三档边界', () => {
    expect(moodBandOf(39)).toBe('drowsy')
    expect(moodBandOf(40)).toBe('calm')
    expect(moodBandOf(79)).toBe('calm')
    expect(moodBandOf(80)).toBe('happy')
  })
  it('缺省 60；clamp 0–100', () => {
    expect(petMood(PET)).toBe(MOOD_DEFAULT)
    expect(petMood({ ...PET, mood: 90 })).toBe(90)
    expect(clampMood(120)).toBe(100)
    expect(clampMood(-5)).toBe(0)
  })
  it('增减钳制', () => {
    expect(withMoodDelta([{ ...PET, mood: 95 }], 12)[0]!.mood).toBe(100)
    expect(withMoodDelta([{ ...PET, mood: 5 }], -12)[0]!.mood).toBe(0)
  })
  it('离线衰减：每小时 -2、上限 60、不足 1 点不扣', () => {
    expect(decayMood([{ ...PET, mood: 80 }], 1_800_000)).toEqual([{ ...PET, mood: 80 }])
    expect(decayMood([{ ...PET, mood: 80 }], 3_600_000)[0]!.mood).toBe(78)
    expect(decayMood([{ ...PET, mood: 80 }], 100 * 3_600_000)[0]!.mood).toBe(20)
  })
  it('均值（缺省按 60）', () => {
    expect(averageMood([PET, { ...PET, mood: 80 }])).toBe(70)
    expect(averageMood([])).toBe(0)
  })
})
