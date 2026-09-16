import { describe, expect, it } from 'vitest'
import { petSpriteMarkup } from '../src/client/render/petSprite.ts'
import { GEO_STYLE, REAL_STYLE, STYLE_REGISTRY, availableStyles, styleOf } from '../src/client/render/styles.ts'
import type { Traits } from '../src/core/types.ts'

const TRAITS: Traits = {
  species: 'cat', body: 'round', ears: 'fold', fur: 'cow',
  pattern: 'spots', tail: 'fluffy', eyes: 'odd', accessory: 'bell',
}

describe('美术风格注册表（M1）', () => {
  it('geo 已注册且渲染等价 petSpriteMarkup', () => {
    expect(STYLE_REGISTRY.geo).toBe(GEO_STYLE)
    expect(GEO_STYLE.render(TRAITS, 'u1')).toBe(petSpriteMarkup(TRAITS, 'u1'))
  })
  it("注册后 styleOf('real') 返回软萌手绘（美术工作流 A12 取代 P3 预留语义）", () => {
    expect(styleOf('real')).toBe(REAL_STYLE)
    expect(styleOf('geo')).toBe(GEO_STYLE)
  })
  it('可选风格 = 已注册风格，带中文名与合法裁剪框', () => {
    const list = availableStyles()
    expect(list.map(s => s.id)).toContain('geo')
    expect(list.map(s => s.id)).toContain('real')
    for (const s of list) {
      expect(s.labelZh.length).toBeGreaterThan(0)
      expect(s.portraitBox.w).toBeGreaterThan(0)
      expect(s.portraitBox.h).toBeGreaterThan(0)
    }
  })
})
