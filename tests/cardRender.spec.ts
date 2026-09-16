import { describe, expect, it } from 'vitest'
import { cardFileName, cardSvg } from '../src/client/render/cardRender.ts'
import type { Pet } from '../src/core/types.ts'

const ARRIVED = new Date(2026, 7, 15, 10).getTime()

const PET: Pet = {
  id: 'p_000042',
  name: '汤圆',
  traits: {
    species: 'cat', body: 'round', ears: 'fold', fur: 'cow',
    pattern: 'spots', tail: 'fluffy', eyes: 'odd', accessory: 'bell',
  },
  passion: 72,
  arrivedAt: ARRIVED,
  locked: false,
  cycle: 1,
}

describe('档案卡渲染（M7）', () => {
  it('包含名字/编号/标签/明细/性格/相遇日期/风格名', () => {
    const svg = cardSvg(PET, 'geo')
    expect(svg).toContain('汤圆')
    expect(svg).toContain('№000042')
    expect(svg).toContain('折耳 · 奶牛 · 蓬松大尾 · 铃铛')
    expect(svg).toContain('猫猫 · 圆润 · 斑点 · 异瞳')
    expect(svg).toContain('性格 · 热情')
    expect(svg).toContain(new Date(ARRIVED).toLocaleDateString('zh-CN'))
    expect(svg).toContain('几何简笔')
    expect(svg).not.toContain('二世')
  })

  it('轮回 ≥2 标记二世', () => {
    expect(cardSvg({ ...PET, cycle: 2 }, 'geo')).toContain('二世')
  })

  it('立绘用独立 uid（不与舞台冲突）', () => {
    expect(cardSvg(PET, 'geo')).toContain('card-p_000042')
  })

  it('文件名格式', () => {
    expect(cardFileName(PET)).toBe('档案卡_№000042_汤圆.png')
  })
})
