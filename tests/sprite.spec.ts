import { describe, expect, it } from 'vitest'
import { petSpriteMarkup } from '../src/client/render/petSprite.ts'
import { bodyGeom } from '../src/client/render/parts.ts'
import type { Fur, Pattern, Traits } from '../src/core/types.ts'

/** 固定基准 traits（其余维度不变，按用例覆盖单项）。 */
const BASE: Traits = {
  species: 'cat',
  body: 'round',
  ears: 'erect',
  fur: 'white',
  pattern: 'solid',
  tail: 'long',
  eyes: 'amber',
  accessory: 'none',
}

describe('petSpriteMarkup（占位立绘）', () => {
  it('毛色三阶色注入：orange → --fur-base:#e8964f', () => {
    const svg = petSpriteMarkup({ ...BASE, fur: 'orange' }, 'u1')
    expect(svg).toContain('--fur-base:#e8964f')
  })

  it('uid 隔离 clipPath：u1/u2 各自持有 ${uid}-body 且互不包含', () => {
    const a = petSpriteMarkup(BASE, 'u1')
    const b = petSpriteMarkup(BASE, 'u2')
    expect(a).toContain('id="u1-body"')
    expect(b).toContain('id="u2-body"')
    expect(a).not.toContain('u2-body')
    expect(b).not.toContain('u1-body')
  })

  it("eyes: 'odd' 同时含异瞳双色；'amber' 琥珀出现 2 次、湖蓝 0 次", () => {
    const odd = petSpriteMarkup({ ...BASE, eyes: 'odd' }, 'u1')
    expect(odd).toContain('#d98e32')
    expect(odd).toContain('#5aa8d8')
    const amber = petSpriteMarkup({ ...BASE, eyes: 'amber' }, 'u1')
    expect(amber.split('#d98e32')).toHaveLength(3)
    expect(amber.includes('#5aa8d8')).toBe(false)
  })

  it("accessory: 'bell' 含铃铛金色；'none' 不含", () => {
    const bell = petSpriteMarkup({ ...BASE, accessory: 'bell' }, 'u1')
    expect(bell).toContain('#e8b93c')
    const none = petSpriteMarkup({ ...BASE, accessory: 'none' }, 'u1')
    expect(none.includes('#e8b93c')).toBe(false)
  })

  it("pattern: 'mittens' 的 --fur-light ≥ 4 次；'solid' 恰 1 次（仅肚皮高光）", () => {
    const mittens = petSpriteMarkup({ ...BASE, pattern: 'mittens' }, 'u1')
    expect(mittens.split('var(--fur-light)').length - 1).toBeGreaterThanOrEqual(4)
    const solid = petSpriteMarkup({ ...BASE, pattern: 'solid' }, 'u1')
    expect(solid.split('var(--fur-light)').length - 1).toBe(1)
  })

  it('抽样 10 毛色 × 5 花纹 = 50 组合全部非空、以 </g> 结尾、带 py-sprite', () => {
    const furs: Fur[] = ['white', 'black', 'orange', 'gray', 'latte', 'cow', 'calico', 'bluegray', 'cream', 'smokybrown']
    const patterns: Pattern[] = ['solid', 'spots', 'tabby', 'gradient', 'mittens']
    for (const fur of furs) {
      for (const pattern of patterns) {
        const svg = petSpriteMarkup({ ...BASE, fur, pattern }, `sample-${fur}-${pattern}`)
        expect(svg.length).toBeGreaterThan(0)
        expect(svg.endsWith('</g>')).toBe(true)
        expect(svg).toContain('class="py-sprite"')
      }
    }
  })

  it('bodyGeom 的 rx 按 small < round < large 严格递增', () => {
    const small = bodyGeom('small')
    const round = bodyGeom('round')
    const large = bodyGeom('large')
    expect(small.rx).toBeLessThan(round.rx)
    expect(round.rx).toBeLessThan(large.rx)
  })
})
