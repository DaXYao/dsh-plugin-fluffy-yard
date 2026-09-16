import { describe, expect, it } from 'vitest'
import { PHASE_COLORS, phaseOfHour } from '../src/client/dayNight.ts'

describe('昼夜（H4）', () => {
  it('三段边界', () => {
    expect(phaseOfHour(5)).toBe('night')
    expect(phaseOfHour(6)).toBe('day')
    expect(phaseOfHour(15)).toBe('day')
    expect(phaseOfHour(16)).toBe('dusk')
    expect(phaseOfHour(18)).toBe('dusk')
    expect(phaseOfHour(19)).toBe('night')
    expect(phaseOfHour(23)).toBe('night')
  })
  it('三套配色齐全', () => {
    for (const c of Object.values(PHASE_COLORS)) {
      expect(c.sky.length).toBeGreaterThan(0)
      expect(c.grass.length).toBeGreaterThan(0)
    }
  })
})
