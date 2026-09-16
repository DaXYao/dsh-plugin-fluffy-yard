import { describe, expect, it } from 'vitest'
import { SpotlightMachine, type SpotlightPet } from '../src/client/stage/spotlight.ts'

const OPTS = { rotateMs: 15_000, rotateLockedMs: 30_000 }
const T0 = 1_000_000

function petOf(id: string, passion: number, locked = false, arrivedAt = 0): SpotlightPet {
  return { id, passion, locked, arrivedAt }
}

describe('聚光灯状态机（M8）', () => {
  it('非聚光灯档：不活动且无事件', () => {
    const m = new SpotlightMachine(OPTS)
    expect(m.tick([petOf('a', 80)], 'roomy', T0)).toEqual([])
    expect(m.getHolder()).toBeNull()
  })

  it('任命到场最早的热情者', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('b', 80, false, 20), petOf('a', 90, false, 10), petOf('c', 10)]
    expect(m.tick(pets, 'spotlight', T0)).toEqual([{ type: 'appoint', petId: 'a' }])
    expect(m.getHolder()).toBe('a')
  })

  it('无热情者：vacant 一次 + 最早淡定者占台打盹（G9 取代 P3 基础版语义）', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 10), petOf('b', 50)]
    expect(m.tick(pets, 'spotlight', T0)).toEqual([{ type: 'vacant' }, { type: 'nap', petId: 'b' }])
    expect(m.tick(pets, 'spotlight', T0 + 9999)).toEqual([])
    expect(m.getHolder()).toBeNull()
  })

  it('轮换到期：唯一热情挑战者顶替现任', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 70, false, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 14_999)).toEqual([])
    const ev = m.tick(pets, 'spotlight', T0 + 15_000)
    expect(ev).toEqual([{ type: 'challenge', challengerId: 'b', previousHolderId: 'a' }])
    expect(m.getHolder()).toBe('b')
  })

  it('锁定持有者时长 30s（15s 时未轮换）', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, true, 10), petOf('b', 70, false, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 29_999)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 30_000)[0]?.type).toBe('challenge')
  })

  it('没有其他热情者：到期续期，第 2 次到期触发 excursion（G8 取代 P3 基础版语义）', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 30)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 60_000)).toEqual([{ type: 'excursion', petId: 'a' }])
    expect(m.getHolder()).toBe('a')
  })

  it('持有者离场：立即重新任命', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 70, false, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick([pets[1]!], 'spotlight', T0 + 100)).toEqual([{ type: 'appoint', petId: 'b' }])
  })

  it('离开聚光灯档后重置，重进重新任命', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90)]
    m.tick(pets, 'spotlight', T0)
    m.tick(pets, 'crowded', T0 + 1)
    expect(m.getHolder()).toBeNull()
    expect(m.tick(pets, 'spotlight', T0 + 2)).toEqual([{ type: 'appoint', petId: 'a' }])
  })
})
