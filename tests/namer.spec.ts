import { describe, expect, it } from 'vitest'
import { allCatNames, allDogNames, makeDefaultName } from '../src/core/namer.ts'
import { derivePet } from '../src/core/traits.ts'
import { rngFrom } from '../src/core/rng.ts'

describe('起名器', () => {
  it("makeDefaultName(rngFrom('x1'), 'cat') 两次调用结果相等", () => {
    expect(makeDefaultName(rngFrom('x1'), 'cat')).toBe(makeDefaultName(rngFrom('x1'), 'cat'))
  })

  it('100 个种子的猫名 ∈ allCatNames()、狗名 ∈ allDogNames()', () => {
    const cats = allCatNames()
    const dogs = allDogNames()
    for (let i = 0; i < 100; i++) {
      expect(cats).toContain(makeDefaultName(rngFrom(`n_cat_${i}`), 'cat'))
      expect(dogs).toContain(makeDefaultName(rngFrom(`n_dog_${i}`), 'dog'))
    }
  })

  it('名字长度恒为 2', () => {
    for (let i = 0; i < 100; i++) {
      expect(makeDefaultName(rngFrom(`l_cat_${i}`), 'cat')).toHaveLength(2)
      expect(makeDefaultName(rngFrom(`l_dog_${i}`), 'dog')).toHaveLength(2)
    }
  })

  it("derivePet('p_000123', new Set(), 1).defaultName 与该宠物 species 的名字全集匹配", () => {
    const d = derivePet('p_000123', new Set(), 1)
    const pool = d.traits.species === 'cat' ? allCatNames() : allDogNames()
    expect(pool).toContain(d.defaultName)
  })
})
