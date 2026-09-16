import { describe, expect, it } from 'vitest'
import { bowlMarkup, propLayout, sofaMarkup, tableMarkup, wallMarkup } from '../src/client/stage/props.ts'

describe('家具布局与 markup（F2/F3/F6）', () => {
  it('比例位置与降级阈值', () => {
    const wide = propLayout(800)
    expect(wide.showFurniture).toBe(true)
    expect(wide.showBowls).toBe(true)
    expect(wide.windowX).toBe(240)
    expect(wide.sofaX).toBe(128)
    expect(wide.tableX).toBe(672)
    expect(wide.foodX).toBe(480)
    expect(propLayout(419).showFurniture).toBe(false)
    expect(propLayout(419).showBowls).toBe(true)
    expect(propLayout(239).showBowls).toBe(false)
    expect(propLayout(239).showFurniture).toBe(false)
  })
  it('markup 用阶段 CSS 变量（不写死颜色）', () => {
    for (const m of [wallMarkup(800, 300, 240), sofaMarkup(128, 300), tableMarkup(672, 300)]) {
      expect(m).toContain('var(--py-prop')
    }
    expect(wallMarkup(800, 300, 240)).toContain('var(--py-glass)')
  })
  it('食盆食物点随份数切换；水碗恒有水面', () => {
    const full = bowlMarkup('food', 100, 300, true)
    const empty = bowlMarkup('food', 100, 300, false)
    expect(full).toContain('#b07a3f')
    expect(empty).not.toContain('#b07a3f')
    expect(bowlMarkup('water', 100, 300, false)).toContain('#a8cfe8')
  })
  it('盆带 data-prop 点击标记', () => {
    expect(bowlMarkup('food', 0, 0, true)).toContain('data-prop="food"')
    expect(bowlMarkup('water', 0, 0, true)).toContain('data-prop="water"')
  })
})
