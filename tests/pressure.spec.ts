import { describe, expect, it } from 'vitest'
import { createInitialDoc, fromDoc } from '../src/core/doc.ts'
import { rngFrom } from '../src/core/rng.ts'
import { dueSpawnCount, setLocked, spawnPet } from '../src/core/spawn.ts'
import { personalityOf, type TraitPools } from '../src/core/traits.ts'
import { MAX_PETS } from '../src/config.ts'
import type { Pet, Yard } from '../src/core/types.ts'

const MIN = 60_000

describe('压力模拟：1000 次到访（默认池，含随机锁定/解锁）', () => {
  it('全程不变量成立', () => {
    let yard: Yard = fromDoc(createInitialDoc(1_000_000_000_000))
    const testRng = rngFrom('pressure-seed')   // 锁定/解锁动作可复现
    let now = 1_000_000_000_000
    let spawnCount = 0
    const speciesCount = { cat: 0, dog: 0 }
    const personalityCount = { eager: 0, calm: 0, aloof: 0 }

    for (let i = 0; i < 1000; i++) {
      now += 31 * MIN   // 间隔 30 分钟，每步推进 31 分钟 → 必到期

      // 随机锁定/解锁（约 1/6 概率动一只）。刻意避免制造"满员全锁定"态——
      // 暂停路径已由 spawn.spec 覆盖，这里要保证 1000 次到访全部发生。
      if (yard.pets.length > 0 && testRng.chance(1 / 6)) {
        const target = testRng.pick(yard.pets)
        const lockedCount = yard.pets.filter(p => p.locked).length
        const wouldAllLock = !target.locked
          && yard.pets.length === MAX_PETS
          && lockedCount === MAX_PETS - 1
        if (!wouldAllLock) {
          yard = setLocked(yard, target.id, !target.locked)
        }
      }

      expect(dueSpawnCount(yard, now)).toBe(1)
      const r = spawnPet(yard, now)
      expect(r.paused).toBe(false)
      expect(r.pet).not.toBeNull()

      // 不变量：淘汰者永不是当前锁定者（对照到访前的锁定集合）
      if (r.left !== null) {
        const lockedBefore = new Set(yard.pets.filter(p => p.locked).map(p => p.id))
        expect(lockedBefore.has(r.left.id)).toBe(false)
      }

      yard = r.yard
      spawnCount++

      // 不变量：数量上限
      expect(yard.pets.length).toBeLessThanOrEqual(MAX_PETS)
      // 不变量：相遇总数 = 在场 + 图鉴 = 已生成数
      expect(yard.pets.length + yard.archive.length).toBe(spawnCount)
      expect(yard.stats.metTotal).toBe(spawnCount)
      expect(yard.idCounter).toBe(spawnCount + 1)
      // 不变量：组合在当前轮回内唯一
      expect(yard.usedCombos.size).toBe(spawnCount)

      speciesCount[r.pet!.traits.species]++
      personalityCount[personalityOf(r.pet!.passion)]++
    }

    // 终态：默认池 76,800 组合，1000 次不触发轮回
    expect(yard.cycle).toBe(1)
    expect(spawnCount).toBe(1000)
    // 分布 sanity（宽区间，防实现性偏差）
    expect(speciesCount.cat).toBeGreaterThan(400)
    expect(speciesCount.cat).toBeLessThan(600)
    for (const [k, v] of Object.entries(personalityCount)) {
      if (k === 'aloof') { expect(v).toBeGreaterThan(150); expect(v).toBeLessThan(250) }
      else { expect(v).toBeGreaterThan(350); expect(v).toBeLessThan(450) }
    }
  })
})

describe('轮回压力：小池强制多代', () => {
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

  /** 与 core 的 comboKeyOf 相同的拼接规则（测试侧独立重算，避免同源假通过）。 */
  function combosKeyOfPet(pet: Pet): string {
    const t = pet.traits
    return `${t.species}|${t.body}|${t.ears}|${t.fur}|${t.pattern}|${t.tail}|${t.eyes}|${t.accessory}`
  }

  it('每代组合内部唯一，代数随生成数上升', () => {
    let yard: Yard = fromDoc(createInitialDoc(1_000_000_000_000))
    let now = 1_000_000_000_000
    const combosByCycle = new Map<number, Set<string>>()
    for (let i = 0; i < 50; i++) {
      now += 31 * MIN
      const r = spawnPet(yard, now, TINY)
      expect(r.paused).toBe(false)
      yard = r.yard
      const pet = r.pet!
      const key = combosKeyOfPet(pet)
      let set = combosByCycle.get(pet.cycle)
      if (set === undefined) {
        set = new Set<string>()
        combosByCycle.set(pet.cycle, set)
      }
      expect(set.has(key)).toBe(false)
      set.add(key)
    }
    // 2 组合/代 → 50 只至少 25 代
    expect(yard.cycle).toBeGreaterThanOrEqual(25)
    expect(yard.stats.metTotal).toBe(50)
  })
})
