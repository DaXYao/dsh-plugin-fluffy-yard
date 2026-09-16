import type { Stats } from './types.ts'
import { initialFlags } from './achievements.ts'

/** 本地自然日键（YYYY-MM-DD）。统计口径按用户本地时区（§L9，需求 §3.6）。
 * @autodoc:purpose 时间戳格式化为本地自然日键 YYYY-MM-DD */
export function dateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** ms 所在自然日的本地昨日键（用日历减日，规避夏令时偏移）。
 * @autodoc:purpose 计算指定时间的本地昨日自然日键 */
export function yesterdayKey(ms: number): string {
  const d = new Date(ms)
  d.setDate(d.getDate() - 1)
  return dateKey(d.getTime())
}

/** 全零初始统计。
 * @autodoc:purpose 创建全零初始统计对象 */
export function initialStats(): Stats {
  return {
    visitCount: 0,
    openCount: 0,
    visitLog: [],
    lastVisitDate: null,
    streak: 0,
    longestStreak: 0,
    metTotal: 0,
    photosTaken: 0,
    achievements: [],
    flags: initialFlags(),
  }
}

/**
 * 记录一次“打开面板”（§L9）：自然日内首次打开计为一次探望
 * （visitCount/visitLog/streak 推进），同日再开只加 openCount。
 * @autodoc:purpose 记录一次打开面板：自然日首开计探望，同日再开只计打开 */
export function recordOpen(stats: Stats, now: number): Stats {
  const today = dateKey(now)
  if (stats.lastVisitDate === today) {
    return { ...stats, openCount: stats.openCount + 1 }
  }
  const streak = stats.lastVisitDate === yesterdayKey(now) ? stats.streak + 1 : 1
  return {
    visitCount: stats.visitCount + 1,
    openCount: stats.openCount + 1,
    visitLog: [...stats.visitLog, now],
    lastVisitDate: today,
    streak,
    longestStreak: Math.max(stats.longestStreak, streak),
    metTotal: stats.metTotal,
    photosTaken: stats.photosTaken,
  }
}
