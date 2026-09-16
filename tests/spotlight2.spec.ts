import { describe, expect, it } from 'vitest'
import { SpotlightMachine, type SpotlightPet } from '../src/client/stage/spotlight.ts'

const OPTS = { rotateMs: 15_000, rotateLockedMs: 30_000 }
const T0 = 1_000_000

function petOf(id: string, passion: number, locked = false, arrivedAt = 0): SpotlightPet {
  return { id, passion, locked, arrivedAt }
}

describe('聚光灯全量（G6–G9）', () => {
  it('summon：任意性格可上台顶替，时长按锁定', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 30, false, 20)]
    m.tick(pets, 'spotlight', T0)
    const ev = m.summon('b', pets, 'spotlight', T0 + 100)
    expect(ev).toEqual([{ type: 'challenge', challengerId: 'b', previousHolderId: 'a' }])
    expect(m.getHolder()).toBe('b')
    expect(m.tick(pets, 'spotlight', T0 + 100 + 14_999)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 100 + 15_000).length).toBeGreaterThan(0)
  })

  it('summon：点名现任自己/非聚光灯档 → 无事件', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90)]
    m.tick(pets, 'spotlight', T0)
    expect(m.summon('a', pets, 'spotlight', T0 + 1)).toEqual([])
    expect(m.summon('a', pets, 'roomy', T0 + 1)).toEqual([])
  })

  it('单热情者：到期第 2 次触发 excursion', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 30)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 30_000)).toEqual([{ type: 'excursion', petId: 'a' }])
    expect(m.getHolder()).toBe('a')
  })

  it('冷场：vacant 与 nap 各发一次，occupant 稳定', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 10, false, 30), petOf('b', 40, false, 10), petOf('c', 50, false, 20)]
    const first = m.tick(pets, 'spotlight', T0)
    expect(first).toEqual([{ type: 'vacant' }, { type: 'nap', petId: 'b' }])
    expect(m.getNapper()).toBe('b')
    expect(m.tick(pets, 'spotlight', T0 + 9999)).toEqual([])
  })

  it('冷场：全高冷（无淡定者）只发 vacant', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 10), petOf('b', 5)]
    expect(m.tick(pets, 'spotlight', T0)).toEqual([{ type: 'vacant' }])
    expect(m.getNapper()).toBeNull()
  })

  it('热情者到场，好戏立即恢复并清冷场', () => {
    const m = new SpotlightMachine(OPTS)
    const cold = [petOf('a', 40)]
    m.tick(cold, 'spotlight', T0)
    const pets = [petOf('a', 40, false, 10), petOf('e', 70, false, 20)]
    expect(m.tick(pets, 'spotlight', T0 + 100)).toEqual([{ type: 'appoint', petId: 'e' }])
    expect(m.getNapper()).toBeNull()
  })
})
