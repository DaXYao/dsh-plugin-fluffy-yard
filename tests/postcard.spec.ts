import { describe, expect, it } from 'vitest'
import { POSTCARD_AFTER_DAYS, postcardEligible, postcardTextFor } from '../src/core/postcard.ts'

const DAY = 86_400_000

describe('明信片（H7）', () => {
  it('确定性：同 id 同文案，名字被代入', () => {
    const a = postcardTextFor('p_000001', '汤圆')
    expect(postcardTextFor('p_000001', '汤圆')).toBe(a)
    expect(a).toContain('汤圆')
    const b = postcardTextFor('p_000001', '年糕')
    expect(b).toContain('年糕')
    expect(b).not.toBe(a)
  })
  it('不同 id 产出不同模板（20 个 id 至少 2 种）', () => {
    const set = new Set(Array.from({ length: 20 }, (_, i) => postcardTextFor(`p_${String(i + 1).padStart(6, '0')}`, 'x')))
    expect(set.size).toBeGreaterThanOrEqual(2)
  })
  it('资格边界：满 3 天整为真，差 1ms 为假', () => {
    const left = 1_000_000_000
    expect(postcardEligible(left, left + POSTCARD_AFTER_DAYS * DAY)).toBe(true)
    expect(postcardEligible(left, left + POSTCARD_AFTER_DAYS * DAY - 1)).toBe(false)
  })
})
