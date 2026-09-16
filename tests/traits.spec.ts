import { describe, expect, it } from 'vitest'
import { comboKeyOf, derivePet, isValidTraits, personalityOf, totalCombos, DEFAULT_POOLS, type DerivedPet, type TraitPools } from '../src/core/traits.ts'
import { rngFrom } from '../src/core/rng.ts'
import { allCatNames, allDogNames, makeDefaultName } from '../src/core/namer.ts'

const TINY: TraitPools = {
  species: ['cat', 'dog'],
  body: ['small'],
  ears: ['erect'],
  fur: ['white'],
  pattern: ['solid'],
  tail: ['long'],
  eyes: ['amber'],
  accessory: [],
}

const TINY_KEYS = [
  'cat|small|erect|white|solid|long|amber|none',
  'dog|small|erect|white|solid|long|amber|none',
] as const

describe('derivePet 确定性', () => {
  it('同 (id, usedCombos, cycle) 连续两次结果 deep-equal（非空 usedCombos）', () => {
    const used = new Set(['cat|round|fold|black|spots|curl|odd|bell'])
    const a = derivePet('p_000042', used, 1)
    const b = derivePet('p_000042', used, 1)
    expect(b).toEqual(a)
  })

  it('同 (id, 空集, cycle) 连续两次结果 deep-equal', () => {
    const a = derivePet('p_000007', new Set(), 1)
    const b = derivePet('p_000007', new Set(), 1)
    expect(b).toEqual(a)
  })
})

describe('组合键与性格阈值', () => {
  it('comboKeyOf 按固定顺序 8 维拼接', () => {
    expect(comboKeyOf({
      species: 'cat', body: 'small', ears: 'erect', fur: 'white',
      pattern: 'solid', tail: 'long', eyes: 'amber', accessory: 'none',
    })).toBe('cat|small|erect|white|solid|long|amber|none')
  })

  it('personalityOf 阈值：60/100 eager、59/20 calm、19/0 aloof', () => {
    expect(personalityOf(60)).toBe('eager')
    expect(personalityOf(100)).toBe('eager')
    expect(personalityOf(59)).toBe('calm')
    expect(personalityOf(20)).toBe('calm')
    expect(personalityOf(19)).toBe('aloof')
    expect(personalityOf(0)).toBe('aloof')
  })

  it('全量默认池组合空间 = 76800', () => {
    expect(totalCombos(DEFAULT_POOLS)).toBe(76800)
  })
})

describe('唯一性与合法性（正常路径 500 只）', () => {
  const used = new Set<string>()
  const derived: DerivedPet[] = []
  for (let i = 1; i <= 500; i++) {
    const d = derivePet(`p_${String(i).padStart(6, '0')}`, used, 1)
    expect(used.has(d.comboKey)).toBe(false)
    used.add(d.comboKey)
    derived.push(d)
  }

  it('500 个组合键互异', () => {
    expect(new Set(derived.map(d => d.comboKey)).size).toBe(500)
  })

  it('全部通过 isValidTraits 且 passion ∈ [0, 100]', () => {
    for (const d of derived) {
      expect(isValidTraits(d.traits)).toBe(true)
      expect(d.passion).toBeGreaterThanOrEqual(0)
      expect(d.passion).toBeLessThanOrEqual(100)
    }
  })
})

describe('分布（10,000 个独立 id，各自空集）', () => {
  const N = 10_000
  const species = { cat: 0, dog: 0 }
  const personality = { eager: 0, calm: 0, aloof: 0 }
  let accessoryHits = 0
  for (let i = 1; i <= N; i++) {
    const d = derivePet(`dist_${i}`, new Set(), 1)
    species[d.traits.species]++
    personality[d.personality]++
    if (d.traits.accessory !== 'none') accessoryHits++
  }

  it('物种猫/狗各 4000–6000', () => {
    expect(species.cat).toBeGreaterThanOrEqual(4000)
    expect(species.cat).toBeLessThanOrEqual(6000)
    expect(species.dog).toBeGreaterThanOrEqual(4000)
    expect(species.dog).toBeLessThanOrEqual(6000)
  })

  it('性格 eager/calm 各 3500–4500、aloof 1500–2500', () => {
    expect(personality.eager).toBeGreaterThanOrEqual(3500)
    expect(personality.eager).toBeLessThanOrEqual(4500)
    expect(personality.calm).toBeGreaterThanOrEqual(3500)
    expect(personality.calm).toBeLessThanOrEqual(4500)
    expect(personality.aloof).toBeGreaterThanOrEqual(1500)
    expect(personality.aloof).toBeLessThanOrEqual(2500)
  })

  it('配饰非 none 占比 12%–18%', () => {
    const rate = accessoryHits / N
    expect(rate).toBeGreaterThanOrEqual(0.12)
    expect(rate).toBeLessThanOrEqual(0.18)
  })
})

describe('轮回（§L5）', () => {
  it('小池全空间 = 2', () => {
    expect(totalCombos(TINY)).toBe(2)
  })

  it('耗尽快路径：两个键都被占用 → cycle+1', () => {
    const full = new Set<string>(TINY_KEYS)
    const d = derivePet('p_999999', full, 1, TINY)
    expect(d.cycle).toBe(2)
    expect(TINY_KEYS).toContain(d.comboKey)
  })

  it('正常路径：空集 → cycle 保持 1 且键在 2 个可能值之内', () => {
    const d = derivePet('p_000001', new Set(), 1, TINY)
    expect(d.cycle).toBe(1)
    expect(TINY_KEYS).toContain(d.comboKey)
  })
})

describe('makeDefaultName', () => {
  it('同种子两次调用结果相等（确定性）', () => {
    expect(makeDefaultName(rngFrom('x1'), 'cat')).toBe(makeDefaultName(rngFrom('x1'), 'cat'))
  })

  it('100 个种子的猫名/狗名均落在各自全集', () => {
    const cats = allCatNames()
    const dogs = allDogNames()
    for (let i = 0; i < 100; i++) {
      expect(cats).toContain(makeDefaultName(rngFrom(`cat_${i}`), 'cat'))
      expect(dogs).toContain(makeDefaultName(rngFrom(`dog_${i}`), 'dog'))
    }
  })

  it('名字长度恒为 2', () => {
    for (let i = 0; i < 50; i++) {
      expect(makeDefaultName(rngFrom(`len_cat_${i}`), 'cat')).toHaveLength(2)
      expect(makeDefaultName(rngFrom(`len_dog_${i}`), 'dog')).toHaveLength(2)
    }
  })

  it('derivePet 的 defaultName 与该宠物物种的名字全集匹配', () => {
    const d = derivePet('p_000123', new Set(), 1)
    const pool = d.traits.species === 'cat' ? allCatNames() : allDogNames()
    expect(pool).toContain(d.defaultName)
  })
})
