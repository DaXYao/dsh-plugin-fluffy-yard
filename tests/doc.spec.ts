import { describe, expect, it } from 'vitest'
import { SPAWN_INTERVAL_DEFAULT_MIN } from '../src/config.ts'
import {
  DOC_SCHEMA_VERSION, createInitialDoc, fromDoc, migrate, toDoc,
} from '../src/core/doc.ts'
import { initialStats } from '../src/core/stats.ts'

const NOW = 1_700_000_000_000

describe('createInitialDoc', () => {
  it('首档字段完整', () => {
    const doc = createInitialDoc(NOW)
    expect(doc.schemaVersion).toBe(2)
    expect(doc.idCounter).toBe(1)
    expect(doc.cycle).toBe(1)
    expect(doc.pets).toEqual([])
    expect(doc.archive).toEqual([])
    expect(doc.usedCombos).toEqual([])
    expect(doc.settings.spawnIntervalMin).toBe(SPAWN_INTERVAL_DEFAULT_MIN)
    expect(doc.lastSpawnAt).toBe(NOW)
  })
})

describe('migrate（§L1）', () => {
  it('v1 冒烟档 → v2：保留 createdAt，其余初始化', () => {
    const doc = migrate({ schemaVersion: 1, smokeCounter: 3, createdAt: 123 }, NOW)
    expect(doc.schemaVersion).toBe(DOC_SCHEMA_VERSION)
    expect(doc.createdAt).toBe(123)
    expect(doc.pets).toEqual([])
    expect(doc.stats).toEqual(initialStats())
  })

  it('空输入 → 初始档', () => {
    expect(migrate(null, NOW)).toEqual(createInitialDoc(NOW))
  })

  it('未知版本 → 初始档', () => {
    const doc = migrate({ schemaVersion: 99 }, NOW)
    expect(doc.schemaVersion).toBe(DOC_SCHEMA_VERSION)
    expect(doc.createdAt).toBe(NOW)
  })

  it('v2 损坏字段回退：pets 非数组→[]，usedCombos 去重并过滤非字符串', () => {
    const doc = migrate({
      schemaVersion: 2,
      idCounter: 5,
      cycle: 1,
      pets: 'oops',
      archive: [],
      usedCombos: ['a', 'a', 42, 'b'],
      stats: { visitCount: 'x', openCount: 2 },
      settings: { spawnIntervalMin: 30 },
      lastSpawnAt: NOW,
      createdAt: 1,
    }, NOW)
    expect(doc.pets).toEqual([])
    expect(doc.usedCombos).toEqual(['a', 'b'])
    expect(doc.stats.visitCount).toBe(0)
    expect(doc.stats.openCount).toBe(2)
  })

  it('v2 非法宠物条目被过滤（traits 不合法）', () => {
    const badPet = {
      id: 'p_000001', name: 'x', traits: { species: 'cat', body: '?', ears: 'erect', fur: 'white', pattern: 'solid', tail: 'long', eyes: 'amber', accessory: 'none' },
      passion: 50, arrivedAt: 1, locked: false, cycle: 1,
    }
    const doc = migrate({ schemaVersion: 2, idCounter: 2, cycle: 1, pets: [badPet], archive: [], usedCombos: [], stats: {}, settings: {}, lastSpawnAt: 1, createdAt: 1 }, NOW)
    expect(doc.pets).toEqual([])
  })
})

describe('Yard ↔ SaveDoc 往返（§L1）', () => {
  it('fromDoc/toDoc 往返保持全部字段（usedCombos Set↔数组）', () => {
    const doc = createInitialDoc(NOW)
    const round = toDoc(fromDoc(doc))
    expect(round).toEqual(doc)
    expect(fromDoc(doc).usedCombos instanceof Set).toBe(true)
  })
})
