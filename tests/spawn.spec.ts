import { describe, expect, it } from 'vitest'
import { createInitialDoc, fromDoc } from '../src/core/doc.ts'
import { comboKeyOf, totalCombos, type TraitPools } from '../src/core/traits.ts'
import {
  dueSpawnCount, formatPetId, isSpawnPaused, setLocked, spawnIntervalMs, spawnPet,
} from '../src/core/spawn.ts'
import type { Yard } from '../src/core/types.ts'

const MIN = 60_000
const T0 = 1_700_000_000_000

/** 空院子初始态（测试用）。
 * @autodoc:category auxiliary
 * @autodoc:purpose 创建空院子初始态（测试夹具） */
function yard0(now = T0): Yard {
  return fromDoc(createInitialDoc(now))
}

/** 顺序到访 n 次（时间每次 +1ms，保证 arrivedAt 严格递增）。
 * @autodoc:category auxiliary
 * @autodoc:purpose 连续到访 n 次生成测试状态（时间严格递增） */
function spawnTimes(yard: Yard, n: number): Yard {
  let cur = yard
  for (let i = 0; i < n; i++) {
    const r = spawnPet(cur, T0 + 1_000 + i)
    if (r.paused) throw new Error('unexpected pause')
    cur = r.yard
  }
  return cur
}

describe('时钟判定 dueSpawnCount（§L8）', () => {
  it('间隔未到 → 0', () => {
    expect(dueSpawnCount(yard0(), T0 + 29 * MIN)).toBe(0)
  })
  it('正好到间隔 → 1', () => {
    expect(dueSpawnCount(yard0(), T0 + 30 * MIN)).toBe(1)
  })
  it('离线再久也只补 1 只', () => {
    expect(dueSpawnCount(yard0(), T0 + 300 * MIN)).toBe(1)
    expect(dueSpawnCount(yard0(), T0 + 30 * 24 * 60 * MIN)).toBe(1)
  })
  it('间隔毫秒数随设置走', () => {
    const y: Yard = { ...yard0(), settings: { spawnIntervalMin: 10 } }
    expect(dueSpawnCount(y, T0 + 9 * MIN)).toBe(0)
    expect(dueSpawnCount(y, T0 + 10 * MIN)).toBe(1)
  })
})

describe('到访与淘汰（§L6/L7/L12）', () => {
  it('空院首次到访：宠物入档，统计与键位齐全', () => {
    const r = spawnPet(yard0(), T0 + MIN)
    expect(r.paused).toBe(false)
    expect(r.pet?.id).toBe('p_000001')
    expect(r.yard.pets).toHaveLength(1)
    expect(r.yard.idCounter).toBe(2)
    expect(r.yard.stats.metTotal).toBe(1)
    expect(r.yard.usedCombos.size).toBe(1)
    expect(r.yard.lastSpawnAt).toBe(T0 + MIN)
    expect(r.left).toBeNull()
  })

  it('连续到访 5 只不触发淘汰', () => {
    const y = spawnTimes(yard0(), 5)
    expect(y.pets).toHaveLength(5)
    expect(y.archive).toHaveLength(0)
    expect(y.stats.metTotal).toBe(5)
  })

  it('满员后到访：最早的未锁定者离场进图鉴', () => {
    const y = spawnTimes(yard0(), 5)
    const r = spawnPet(y, T0 + 10_000)
    expect(r.left?.id).toBe('p_000001')
    expect(r.left?.leftAt).toBe(T0 + 10_000)
    expect(r.yard.pets).toHaveLength(5)
    expect(r.yard.archive).toHaveLength(1)
    expect(r.yard.stats.metTotal).toBe(6)
    // 新到访者在场，离场者不在
    expect(r.yard.pets.map(p => p.id)).toContain('p_000006')
    expect(r.yard.pets.map(p => p.id)).not.toContain('p_000001')
  })

  it('锁定者不被淘汰：淘汰顺位跳到下一只未锁定者', () => {
    const y = spawnTimes(yard0(), 5)
    const locked = setLocked(y, 'p_000001', true)
    const r = spawnPet(locked, T0 + 10_000)
    expect(r.left?.id).toBe('p_000002')
  })

  it('解锁后按原到场时间重新排队（§L6）', () => {
    // A(p1,最早) B(p2) C(p3) D(p4) E(p5)；锁 A → 淘汰 B；解锁 A → 下一只淘汰 A
    let y = spawnTimes(yard0(), 5)
    y = setLocked(y, 'p_000001', true)
    const r1 = spawnPet(y, T0 + 10_000)
    expect(r1.left?.id).toBe('p_000002')
    const unlocked = setLocked(r1.yard, 'p_000001', false)
    const r2 = spawnPet(unlocked, T0 + 20_000)
    expect(r2.left?.id).toBe('p_000001')
  })

  it('未满员时全锁定不暂停到访', () => {
    let y = spawnTimes(yard0(), 3)
    for (const p of y.pets) y = setLocked(y, p.id, true)
    expect(isSpawnPaused(y)).toBe(false)
    const r = spawnPet(y, T0 + 10_000)
    expect(r.paused).toBe(false)
    expect(r.yard.pets).toHaveLength(4)
  })

  it('满员且全锁定：暂停，状态引用不变', () => {
    let y = spawnTimes(yard0(), 5)
    for (const p of y.pets) y = setLocked(y, p.id, true)
    expect(isSpawnPaused(y)).toBe(true)
    const r = spawnPet(y, T0 + 10_000)
    expect(r.paused).toBe(true)
    expect(r.pet).toBeNull()
    expect(r.yard).toBe(y)
    expect(dueSpawnCount(y, T0 + 100 * MIN)).toBe(0)
  })

  it('id 形态与 arrivedAt 单调', () => {
    const y = spawnTimes(yard0(), 3)
    expect(y.pets.map(p => p.id)).toEqual(['p_000001', 'p_000002', 'p_000003'])
    for (let i = 1; i < y.pets.length; i++) {
      expect(y.pets[i]!.arrivedAt).toBeGreaterThan(y.pets[i - 1]!.arrivedAt)
    }
  })
})

describe('轮回（§L5）', () => {
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

  it('小池 2 组合用尽后，第 3 只触发新轮回并清空键位', () => {
    expect(totalCombos(TINY)).toBe(2)
    let y = yard0()
    for (let i = 0; i < 2; i++) {
      const r = spawnPet(y, T0 + i, TINY)
      expect(r.pet?.cycle).toBe(1)
      y = r.yard
    }
    expect(y.usedCombos.size).toBe(2)
    const r3 = spawnPet(y, T0 + 2, TINY)
    expect(r3.pet?.cycle).toBe(2)
    expect(r3.yard.cycle).toBe(2)
    // 新轮回键位清空后只含新到访者的键
    expect(r3.yard.usedCombos.size).toBe(1)
    expect(r3.yard.usedCombos.has(comboKeyOf(r3.pet!.traits))).toBe(true)
    // metTotal 照常累计
    expect(r3.yard.stats.metTotal).toBe(3)
  })
})
