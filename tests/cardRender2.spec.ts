import { describe, expect, it } from 'vitest'
import { cardSvg } from '../src/client/render/cardRender.ts'
import type { Pet } from '../src/core/types.ts'

const ARRIVED = new Date(2026, 7, 15, 10).getTime()
const LEFT = new Date(2026, 7, 28, 9).getTime()
const PET: Pet = {
  id: 'p_000009', name: '煤球',
  traits: { species: 'dog', body: 'large', ears: 'droop', fur: 'black', pattern: 'solid', tail: 'curl', eyes: 'amber', accessory: 'none' },
  passion: 10, arrivedAt: ARRIVED, locked: false, cycle: 2,
}

describe('档案卡告别日期（G12）', () => {
  it('无 leftAt：不含告别于（二世标记仍生效）', () => {
    const svg = cardSvg(PET, 'geo')
    expect(svg).not.toContain('告别于')
    expect(svg).toContain('二世')
  })
  it('有 leftAt：页脚含相遇与告别日期', () => {
    const svg = cardSvg(PET, 'geo', { leftAt: LEFT })
    expect(svg).toContain('告别于')
    expect(svg).toContain(new Date(ARRIVED).toLocaleDateString('zh-CN'))
    expect(svg).toContain(new Date(LEFT).toLocaleDateString('zh-CN'))
  })
})
