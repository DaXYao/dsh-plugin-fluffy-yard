import { describe, expect, it } from 'vitest'
import { createInitialDoc, migrate } from '../src/core/doc.ts'

const NOW = 1_700_000_000_000
const V2_BASE = {
  idCounter: 1, cycle: 1, pets: [], archive: [], usedCombos: [],
  stats: {}, settings: {}, lastSpawnAt: 1, createdAt: 1,
}

describe('Settings.artStyle（M2：加性字段，不升 schemaVersion）', () => {
  it('首档默认 geo', () => {
    expect(createInitialDoc(NOW).settings.artStyle).toBe('geo')
  })
  it('v2 旧档无 artStyle → 默认 geo', () => {
    expect(migrate({ ...V2_BASE, schemaVersion: 2 }, NOW).settings.artStyle).toBe('geo')
  })
  it('合法值保留（含预留 real）', () => {
    const doc = migrate({ ...V2_BASE, schemaVersion: 2, settings: { spawnIntervalMin: 30, artStyle: 'real' } }, NOW)
    expect(doc.settings.artStyle).toBe('real')
    const doc2 = migrate({ ...V2_BASE, schemaVersion: 2, settings: { artStyle: 'geo' } }, NOW)
    expect(doc2.settings.artStyle).toBe('geo')
  })
  it('非法值回退 geo', () => {
    const doc = migrate({ ...V2_BASE, schemaVersion: 2, settings: { artStyle: 'weird' } }, NOW)
    expect(doc.settings.artStyle).toBe('geo')
  })
})
