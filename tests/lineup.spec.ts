import { describe, expect, it } from 'vitest'
import { lineupFor, type LineupPet } from '../src/client/stage/lineup.ts'

const PETS: LineupPet[] = [
  { id: 'a', passion: 30, arrivedAt: 10 },
  { id: 'b', passion: 90, arrivedAt: 20 },
  { id: 'c', passion: 10, arrivedAt: 30 },
  { id: 'e', passion: 70, arrivedAt: 40 },
]

describe('格位分配（G2/G3）', () => {
  it('拥挤：纯到场时间', () => {
    const r = lineupFor('crowded', PETS, 2)
    expect(r.slotIds).toEqual(['a', 'b'])
    expect(r.overflowIds).toEqual(['c', 'e'])
  })
  it('狭小：热情优先，再到场时间', () => {
    const r = lineupFor('narrow', PETS, 2)
    expect(r.slotIds).toEqual(['b', 'e'])
    expect(r.overflowIds).toEqual(['a', 'c'])
  })
  it('slots ≥ 数量 → 全员占位', () => {
    const r = lineupFor('narrow', PETS, 4)
    expect(r.slotIds).toEqual(['a', 'b', 'c', 'e'])
    expect(r.overflowIds).toEqual([])
  })
  it('空场安全', () => {
    expect(lineupFor('crowded', [], 3)).toEqual({ slotIds: [], overflowIds: [] })
  })
})
