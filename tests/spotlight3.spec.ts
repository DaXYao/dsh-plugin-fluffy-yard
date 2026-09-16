import { describe, expect, it } from 'vitest'
import { SpotlightMachine, type SpotlightPet } from '../src/client/stage/spotlight.ts'

const OPTS = { rotateMs: 15_000, rotateLockedMs: 30_000 }
const T0 = 1_000_000

function petOf(id: string, passion: number, arrivedAt = 0): SpotlightPet {
  return { id, passion, locked: false, arrivedAt }
}

describe('心情加演（H5）', () => {
  it('calmChallenge 开：淡定者可顶替热情现任', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, 10), petOf('b', 40, 20)]
    m.tick(pets, 'spotlight', T0)
    const ev = m.tick(pets, 'spotlight', T0 + 15_000, { calmChallenge: true })
    expect(ev[0]).toEqual({ type: 'challenge', challengerId: 'b', previousHolderId: 'a' })
  })
  it('calmChallenge 关（默认）：淡定者在场不构成挑战（延续 P4 语义）', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, 10), petOf('b', 40, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000)).toEqual([])
  })
  it('高冷（<20）即使 calmChallenge 也不参与', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, 10), petOf('c', 10, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000, { calmChallenge: true })).toEqual([])
  })
})
