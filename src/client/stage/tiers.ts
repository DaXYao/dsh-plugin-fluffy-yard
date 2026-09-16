import { CELL_W, MIN_STAGE_W } from '../../config.ts'

/** 场景档位（需求 §3.7 分档行为；P2 只计算与广播，分档行为全量在 P4）。 */
export type Tier = 'tiny' | 'spotlight' | 'narrow' | 'crowded' | 'roomy'

/** 可见格位数 = floor(宽 / 舒适格位宽)。 */
export function slotsFor(width: number): number {
  return Math.max(0, Math.floor(width / CELL_W))
}

/**
 * 档位判定（implementation-plan §3.5，按序判定）：
 * 宽 < MIN_STAGE_W → 极小；格位 ≥ 在场数 → 宽裕；格位 ≥ 3 → 拥挤；
 * 格位 = 2 → 狭小；其余（格位 ≤ 1）→ 聚光灯。
 */
export function computeTier(width: number, petCount: number): Tier {
  if (width < MIN_STAGE_W) return 'tiny'
  const slots = slotsFor(width)
  if (slots >= petCount) return 'roomy'
  if (slots >= 3) return 'crowded'
  if (slots === 2) return 'narrow'
  return 'spotlight'
}

export const TIER_LABEL_ZH: Record<Tier, string> = {
  tiny: '极小',
  spotlight: '聚光灯',
  narrow: '狭小',
  crowded: '拥挤',
  roomy: '宽裕',
}
