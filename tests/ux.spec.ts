import { describe, expect, it } from 'vitest'
import { MAX_PETS, SPAWN_INTERVAL_MIN_MIN } from '../src/config.ts'
import { createInitialDoc, fromDoc, migrate } from '../src/core/doc.ts'
import { isSpawnPaused, maxPetsOf, setLocked, spawnIntervalMs, spawnPet } from '../src/core/spawn.ts'
import type { Yard } from '../src/core/types.ts'

const NOW = 1_700_000_000_000

function yardMax(max: number): Yard {
  const doc = migrate({
    schemaVersion: 2,
    idCounter: 1, cycle: 1, pets: [], archive: [], usedCombos: [],
    stats: {}, settings: { spawnIntervalMin: 30, maxPets: max },
    lastSpawnAt: NOW, createdAt: NOW,
  }, NOW)
  return fromDoc(doc)
}

describe('UX-3：在场上限（settings.maxPets）', () => {
  it('缺省上限 = MAX_PETS', () => {
    expect(maxPetsOf(fromDoc(createInitialDoc(NOW)))).toBe(MAX_PETS)
  })
  it('自定义上限被 spawn 遵守：满员后到访淘汰最早者', () => {
    let y = yardMax(3)
    expect(maxPetsOf(y)).toBe(3)
    for (let i = 0; i < 3; i++) y = spawnPet(y, NOW + i * 1000).yard
    expect(y.pets).toHaveLength(3)
    const r = spawnPet(y, NOW + 10_000)
    expect(r.paused).toBe(false)
    expect(r.left?.id).toBe('p_000001')
    expect(r.yard.pets).toHaveLength(3)
  })
  it('满员全锁定暂停按自定义上限判定', () => {
    let y = yardMax(2)
    y = spawnPet(y, NOW).yard
    y = spawnPet(y, NOW + 1000).yard
    for (const p of y.pets) y = setLocked(y, p.id, true)
    expect(isSpawnPaused(y)).toBe(true)
  })
  it('settings 归一：maxPets 钳制 1–10，缺省 5', () => {
    const read = (raw: unknown): number =>
      migrate({ schemaVersion: 2, idCounter: 1, cycle: 1, pets: [], archive: [], usedCombos: [], stats: {}, settings: raw, lastSpawnAt: 1, createdAt: 1 }, NOW).settings.maxPets ?? 0
    expect(read({ maxPets: 99 })).toBe(10)
    expect(read({ maxPets: 0 })).toBe(1)
    expect(read({ maxPets: 2.7 })).toBe(3)
    expect(read({})).toBe(5)
  })
})

describe('UX-3：到访间隔下限 30 秒', () => {
  it('下限常量 = 0.5 分钟（30 秒）', () => {
    expect(SPAWN_INTERVAL_MIN_MIN).toBe(0.5)
  })
  it('小数分钟间隔换算毫秒（0.5 分钟 = 30 秒）', () => {
    let y = fromDoc(createInitialDoc(NOW))
    y = { ...y, settings: { ...y.settings, spawnIntervalMin: SPAWN_INTERVAL_MIN_MIN } }
    expect(spawnIntervalMs(y)).toBe(30_000)
    expect(y.settings.maxPets).toBe(MAX_PETS)
  })
})
