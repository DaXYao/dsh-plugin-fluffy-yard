import { describe, expect, it } from 'vitest'
import { computeTier, slotsFor, TIER_LABEL_ZH, type Tier } from '../src/client/stage/tiers.ts'

describe('档位计算（implementation-plan §3.5）', () => {
  it('宽 < 120 → 极小（无论数量）', () => {
    expect(computeTier(60, 1)).toBe('tiny')
    expect(computeTier(119, 5)).toBe('tiny')
  })
  it('格位 ≥ 在场数 → 宽裕', () => {
    expect(computeTier(700, 3)).toBe('roomy')
    expect(computeTier(140, 1)).toBe('roomy')
    expect(computeTier(1400, 5)).toBe('roomy')
  })
  it('格位 < 在场数且 ≥ 3 → 拥挤', () => {
    expect(computeTier(700, 6)).toBe('crowded')
    expect(computeTier(420, 4)).toBe('crowded')
  })
  it('格位 = 2 → 狭小', () => {
    expect(computeTier(300, 5)).toBe('narrow')
    expect(computeTier(300, 3)).toBe('narrow')
  })
  it('格位 ≤ 1（且宽 ≥ 120）→ 聚光灯', () => {
    expect(computeTier(200, 3)).toBe('spotlight')
    expect(computeTier(130, 1)).toBe('spotlight')
  })
  it('空场恒宽裕', () => {
    expect(computeTier(300, 0)).toBe('roomy')
  })
  it('格位数 = floor(宽/140)', () => {
    expect(slotsFor(139)).toBe(0)
    expect(slotsFor(140)).toBe(1)
    expect(slotsFor(279)).toBe(1)
    expect(slotsFor(280)).toBe(2)
  })
  it('标签表覆盖全部档位', () => {
    const tiers: Tier[] = ['tiny', 'spotlight', 'narrow', 'crowded', 'roomy']
    for (const tier of tiers) expect(TIER_LABEL_ZH[tier].length).toBeGreaterThan(0)
  })
})
