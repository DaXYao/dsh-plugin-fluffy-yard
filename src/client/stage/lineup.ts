import type { Tier } from './tiers.ts'

export interface LineupPet {
  readonly id: string
  readonly passion: number
  readonly arrivedAt: number
}

export interface Lineup {
  /** 占格位者的 id（按站位顺序）。 */
  readonly slotIds: readonly string[]
  /** 溢出贴边者的 id。 */
  readonly overflowIds: readonly string[]
}

/**
 * 拥挤/狭小档的格位分配（G2/G3）：
 * 拥挤 = 按到场时间；狭小 = 热情优先再按到场时间（卡位死守）。
 * slots ≥ 数量或 0 → 全员占位（宽裕/极小的站位由引擎另行处理）。
 */
export function lineupFor(tier: Tier, pets: readonly LineupPet[], slots: number): Lineup {
  const byArrival = pets.slice().sort((a, b) => a.arrivedAt - b.arrivedAt)
  if (slots <= 0 || slots >= pets.length) {
    return { slotIds: byArrival.map(p => p.id), overflowIds: [] }
  }
  const ordered = tier === 'narrow'
    ? pets.slice().sort((a, b) => {
        const eagerDiff = (Number(b.passion >= 60) - Number(a.passion >= 60))
        return eagerDiff !== 0 ? eagerDiff : a.arrivedAt - b.arrivedAt
      })
    : byArrival
  return {
    slotIds: ordered.slice(0, slots).map(p => p.id),
    overflowIds: ordered.slice(slots).map(p => p.id),
  }
}
