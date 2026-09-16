import { describe, expect, it } from 'vitest'
import { REAL_BODY, accessoryPart, bodyPath, earsPart, eyesPart, patternPart, tailPart } from '../src/client/render/real/parts.ts'
import { realSpriteMarkup } from '../src/client/render/realSprite.ts'
import type { Traits } from '../src/core/types.ts'

describe('real 主体（A2/A6）', () => {
  it('包络高度对齐 geo ±4（气泡锚点耦合）', () => {
    const geoHeight = { small: 48, round: 50, large: 60 }
    for (const [body, g] of Object.entries(REAL_BODY)) {
      expect(Math.abs(g.h - geoHeight[body as keyof typeof geoHeight])).toBeLessThanOrEqual(4)
    }
  })
  it('身体路径闭合且以脚底为原点（含 M…Z）', () => {
    for (const g of Object.values(REAL_BODY)) {
      const d = bodyPath(g)
      expect(d.startsWith('M ')).toBe(true)
      expect(d.endsWith('Z')).toBe(true)
      expect(d.match(/Z/g)?.length).toBe(1)
    }
  })
  it('体型单调：rx 与 h 随 small→large 递增', () => {
    expect(REAL_BODY.small.rx).toBeLessThan(REAL_BODY.round.rx)
    expect(REAL_BODY.round.rx).toBeLessThan(REAL_BODY.large.rx)
    expect(REAL_BODY.small.h).toBeLessThan(REAL_BODY.large.h)
  })
})

describe('real 五官与配件（A5–A8）', () => {
  const G = REAL_BODY.round
  it('四耳型 × 二物种全部产出非空描边图形', () => {
    for (const ears of ['erect', 'fold', 'droop', 'elf'] as const) {
      for (const species of ['cat', 'dog'] as const) {
        const s = earsPart(G, ears, species)
        expect(s.length).toBeGreaterThan(40)
        expect(s).toContain('stroke="var(--ln)"')
      }
    }
  })
  it('异瞳双色 / 常规眼同色', () => {
    const odd = eyesPart(G, 'odd')
    expect(odd).toContain('#c9852f')
    expect(odd).toContain('#4f9bd1')
    const amber = eyesPart(G, 'amber')
    expect(amber.match(/#c9852f/g)?.length).toBe(2)
    expect(amber).not.toContain('#4f9bd1')
  })
  it('花纹裁剪引用 uid clipPath；奶牛固有斑', () => {
    expect(patternPart(G, 'spots', 'gray', 'u1')).toContain('url(#u1-body)')
    expect(patternPart(G, 'solid', 'cow', 'u1')).toContain('var(--rd)')
    expect(patternPart(G, 'solid', 'white', 'u1')).toBe('')
  })
  it('配饰三件产出固定色；none 为空', () => {
    expect(accessoryPart(G, 'scarf')).toContain('#e07a5f')
    expect(accessoryPart(G, 'bell')).toContain('#f0c04a')
    expect(accessoryPart(G, 'bowtie')).toContain('#e07a5f')
    expect(accessoryPart(G, 'none')).toBe('')
  })
  it('四尾型非空', () => {
    for (const t of ['short', 'long', 'fluffy', 'curl'] as const) {
      expect(tailPart(G, t).length).toBeGreaterThan(30)
    }
  })
})

describe('real 组装（A2/A3/A5）', () => {
  const T: Traits = {
    species: 'cat', body: 'round', ears: 'erect', fur: 'orange',
    pattern: 'solid', tail: 'fluffy', eyes: 'amber', accessory: 'none',
  }
  it('五变量注入 + clipPath uid + 结构', () => {
    const s = realSpriteMarkup(T, 'u9')
    for (const v of ['--rb', '--rd', '--rl', '--rw', '--ln']) expect(s).toContain(`${v}:`)
    expect(s).toContain('id="u9-body"')
    expect(s).toContain('class="py-sprite"')
    expect(s.endsWith('</g>')).toBe(true)
  })
  it('包络缩放：三体型高度符合 A2（h/92 等比）', () => {
    for (const body of ['small', 'round', 'large'] as const) {
      const s = realSpriteMarkup({ ...T, body }, 'env-' + body)
      const expected = Math.round((REAL_BODY[body].h / 92) * 1000) / 1000
      expect(s).toContain(`scale(${expected})`)
    }
  })
  it('全维度组合抽样 2000：非空且 uid 隔离', () => {
    const bodies = ['small', 'round', 'large'] as const
    const ears = ['erect', 'fold', 'droop', 'elf'] as const
    const furs = ['white', 'black', 'orange', 'gray', 'latte', 'cow', 'calico', 'bluegray', 'cream', 'smokybrown'] as const
    const patterns = ['solid', 'spots', 'tabby', 'gradient', 'mittens'] as const
    const tails = ['short', 'long', 'fluffy', 'curl'] as const
    const eyes = ['amber', 'lakeblue', 'emerald', 'odd'] as const
    const accs = ['none', 'scarf', 'bell', 'bowtie'] as const
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const traits: Traits = {
        species: i % 2 === 0 ? 'cat' : 'dog',
        body: bodies[i % 3]!, ears: ears[i % 4]!, fur: furs[i % 10]!,
        pattern: patterns[i % 5]!, tail: tails[i % 4]!, eyes: eyes[i % 4]!, accessory: accs[i % 4]!,
      }
      const s = realSpriteMarkup(traits, `s${i}`)
      expect(s.length).toBeGreaterThan(120)
      expect(s).toContain(`id="s${i}-body"`)
      seen.add(s)
    }
    expect(seen.size).toBe(2000)   // 组合互异（不同 traits 产出不同 markup）
  })
  it('确定性：同 traits 同 uid 同输出', () => {
    expect(realSpriteMarkup(T, 'a1')).toBe(realSpriteMarkup(T, 'a1'))
  })
})
