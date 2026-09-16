import { describe, expect, it } from 'vitest'
import { createInitialDoc, fromDoc } from '../src/core/doc.ts'
import { ACHIEVEMENTS, evaluateAchievements } from '../src/core/achievements.ts'
import { EARS_POOL, FUR_POOL } from '../src/core/traits.ts'
import { spawnPet } from '../src/core/spawn.ts'
import type { Pet, Yard } from '../src/core/types.ts'

const NOW = 1_700_000_000_000

function yard0(): Yard {
  return fromDoc(createInitialDoc(NOW))
}

function withPets(yard: Yard, pets: Pet[]): Yard {
  return { ...yard, pets }
}

function petOf(id: string, ears: string, fur: string): Pet {
  return {
    id, name: id,
    traits: { species: 'cat', body: 'small', ears: ears as Pet['traits']['ears'], fur: fur as Pet['traits']['fur'], pattern: 'solid', tail: 'long', eyes: 'amber', accessory: 'none' },
    passion: 50, arrivedAt: 0, locked: false, cycle: 1,
  }
}

const byId = (yard: Yard, ids: string[]): string[] =>
  evaluateAchievements(yard).filter(d => ids.includes(d.id)).map(d => d.id)

describe('成就（H8–H11）', () => {
  it('空院子不解锁任何成就', () => {
    expect(evaluateAchievements(yard0())).toEqual([])
  })
  it('探望/相遇/合影类按数值触发', () => {
    let y = yard0()
    y = { ...y, stats: { ...y.stats, visitCount: 1, metTotal: 1, photosTaken: 1 } }
    expect(byId(y, ['first-visit', 'first-meet', 'first-photo'])).toEqual(['first-visit', 'first-meet', 'first-photo'])
    y = { ...y, stats: { ...y.stats, longestStreak: 7 } }
    expect(byId(y, ['streak-7', 'streak-30'])).toEqual(['streak-7'])
  })
  it('目睹旗标类触发', () => {
    let y = yard0()
    y = { ...y, stats: { ...y.stats, flags: { sawChallenge: true, sawCold: true, summonedAloof: true, photoSpotlight: true, lockedOnce: true, lockedFull: true } } }
    const ids = evaluateAchievements(y).map(d => d.id)
    for (const id of ['huddle-photo', 'witness-bump', 'witness-cold', 'summon-aloof', 'first-lock', 'lock-5']) {
      expect(ids).toContain(id)
    }
  })
  it('万物图鉴：耳型+毛色全值各一次', () => {
    const pets: Pet[] = []
    let i = 1
    for (const ears of EARS_POOL) for (const fur of FUR_POOL) {
      pets.push(petOf(`p_${String(i++).padStart(6, '0')}`, ears, fur))
    }
    expect(byId(withPets(yard0(), pets), ['dex-all'])).toEqual(['dex-all'])
    // 缺一整组耳型（精灵耳 ×10）→ 覆盖不完整不解锁（单只删除不破坏集合覆盖）
    expect(byId(withPets(yard0(), pets.slice(0, 30)), ['dex-all'])).toEqual([])
  })
  it('已解锁不再重复', () => {
    let y = yard0()
    y = { ...y, stats: { ...y.stats, visitCount: 1 } }
    y = { ...y, stats: { ...y.stats, achievements: ['first-visit'] } }
    expect(byId(y, ['first-visit'])).toEqual([])
  })
  it('清单 id 唯一且共 14 项', () => {
    expect(ACHIEVEMENTS.length).toBe(14)
    expect(new Set(ACHIEVEMENTS.map(d => d.id)).size).toBe(14)
  })
  it('与 spawn 集成：一次到访解锁 first-meet', () => {
    const y = spawnPet(yard0(), NOW).yard
    expect(byId(y, ['first-meet'])).toEqual(['first-meet'])
  })
})
