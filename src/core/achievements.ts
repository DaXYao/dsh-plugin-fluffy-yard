import { EARS_POOL, FUR_POOL } from './traits.ts'
import type { AchievementFlags, Yard } from './types.ts'

export function initialFlags(): AchievementFlags {
  return {
    sawChallenge: false, sawCold: false, summonedAloof: false,
    photoSpotlight: false, lockedOnce: false, lockedFull: false,
  }
}

export interface AchievementDef {
  readonly id: string
  readonly titleZh: string
  readonly descZh: string
  readonly check: (yard: Yard) => boolean
}

const flagsOf = (yard: Yard): AchievementFlags => ({ ...initialFlags(), ...yard.stats.flags })

/** 在场 + 图鉴的 traits 收集（万物图鉴，H10）。 */
function seenTraitValues(yard: Yard): { ears: Set<string>; fur: Set<string> } {
  const ears = new Set<string>()
  const fur = new Set<string>()
  for (const x of [...yard.pets, ...yard.archive]) {
    ears.add(x.traits.ears)
    fur.add(x.traits.fur)
  }
  return { ears, fur }
}

/** 成就清单（H9；id 冻结）。 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-visit', titleZh: '初来乍到', descZh: '第一次探望', check: y => y.stats.visitCount >= 1 },
  { id: 'streak-7', titleZh: '常客', descZh: '连续探望 7 天', check: y => y.stats.longestStreak >= 7 },
  { id: 'streak-30', titleZh: '铁粉', descZh: '连续探望 30 天', check: y => y.stats.longestStreak >= 30 },
  { id: 'first-meet', titleZh: '初次相遇', descZh: '迎来第 1 只宠物', check: y => y.stats.metTotal >= 1 },
  { id: 'meet-50', titleZh: '缘分不浅', descZh: '相遇 50 只', check: y => y.stats.metTotal >= 50 },
  {
    id: 'dex-all', titleZh: '万物图鉴', descZh: '集齐所有耳型与毛色各一次',
    check: y => {
      const seen = seenTraitValues(y)
      return EARS_POOL.every(v => seen.ears.has(v)) && FUR_POOL.every(v => seen.fur.has(v))
    },
  },
  { id: 'first-photo', titleZh: '全家福', descZh: '第一次合影', check: y => y.stats.photosTaken >= 1 },
  { id: 'photo-20', titleZh: '摄影师', descZh: '累计合影 20 张', check: y => y.stats.photosTaken >= 20 },
  { id: 'first-lock', titleZh: '此心安处', descZh: '第一次锁定', check: y => flagsOf(y).lockedOnce },
  { id: 'lock-5', titleZh: '五口之家', descZh: '同时锁定 5 只', check: y => flagsOf(y).lockedFull },
  { id: 'huddle-photo', titleZh: '挤挤更亲密', descZh: '聚光灯档完成一次合影', check: y => flagsOf(y).photoSpotlight },
  { id: 'witness-bump', titleZh: '让让我嘛', descZh: '亲眼见证一次争宠顶替', check: y => flagsOf(y).sawChallenge },
  { id: 'witness-cold', titleZh: '今日冷淡', descZh: '亲历一次冷场模式', check: y => flagsOf(y).sawCold },
  { id: 'summon-aloof', titleZh: '勉强营业', descZh: '点名一只高冷宠物上台', check: y => flagsOf(y).summonedAloof },
]

/** 评估新解锁（纯函数，H8）。 */
export function evaluateAchievements(yard: Yard): readonly AchievementDef[] {
  const unlocked = new Set(yard.stats.achievements ?? [])
  return ACHIEVEMENTS.filter(def => !unlocked.has(def.id) && def.check(yard))
}
