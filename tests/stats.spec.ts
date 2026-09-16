import { describe, expect, it } from 'vitest'
import { dateKey, initialStats, recordOpen, yesterdayKey } from '../src/core/stats.ts'

/** 本地时区时间戳（月用 1-12 的人类习惯）。
 * @autodoc:category auxiliary
 * @autodoc:purpose 按本地时区构造测试时间戳（月用 1-12） */
const T = (y: number, m: number, d: number, h = 10): number => new Date(y, m - 1, d, h).getTime()

describe('自然日键', () => {
  it('dateKey 输出补零的本地日期', () => {
    expect(dateKey(T(2026, 8, 5))).toBe('2026-08-05')
    expect(dateKey(T(2026, 12, 31))).toBe('2026-12-31')
  })
  it('yesterdayKey 跨月正确', () => {
    expect(yesterdayKey(T(2026, 3, 1))).toBe('2026-02-28')
    expect(yesterdayKey(T(2024, 3, 1))).toBe('2024-02-29')
    expect(yesterdayKey(T(2026, 1, 1))).toBe('2025-12-31')
  })
})

describe('recordOpen 探望口径（§L9）', () => {
  it('首次打开：streak=1，visitCount=1，openCount=1', () => {
    const s = recordOpen(initialStats(), T(2026, 8, 28))
    expect(s.visitCount).toBe(1)
    expect(s.openCount).toBe(1)
    expect(s.streak).toBe(1)
    expect(s.longestStreak).toBe(1)
    expect(s.lastVisitDate).toBe('2026-08-28')
    expect(s.visitLog).toHaveLength(1)
  })

  it('同日再开：只加 openCount', () => {
    let s = recordOpen(initialStats(), T(2026, 8, 28, 9))
    s = recordOpen(s, T(2026, 8, 28, 21))
    expect(s.visitCount).toBe(1)
    expect(s.openCount).toBe(2)
    expect(s.streak).toBe(1)
    expect(s.visitLog).toHaveLength(1)
  })

  it('次日打开：streak +1', () => {
    let s = recordOpen(initialStats(), T(2026, 8, 28))
    s = recordOpen(s, T(2026, 8, 29))
    expect(s.streak).toBe(2)
    expect(s.visitCount).toBe(2)
  })

  it('隔一天（昨日未开）：streak 重置为 1', () => {
    let s = recordOpen(initialStats(), T(2026, 8, 28))
    s = recordOpen(s, T(2026, 8, 30))
    expect(s.streak).toBe(1)
    expect(s.visitCount).toBe(2)
  })

  it('longestStreak 在断档后保持历史纪录', () => {
    let s = initialStats()
    s = recordOpen(s, T(2026, 8, 26))
    s = recordOpen(s, T(2026, 8, 27))
    s = recordOpen(s, T(2026, 8, 28))
    expect(s.streak).toBe(3)
    s = recordOpen(s, T(2026, 8, 31))
    expect(s.streak).toBe(1)
    expect(s.longestStreak).toBe(3)
  })

  it('跨月连续：1-31 → 2-1', () => {
    let s = recordOpen(initialStats(), T(2026, 1, 31))
    s = recordOpen(s, T(2026, 2, 1))
    expect(s.streak).toBe(2)
  })

  it('跨年连续：12-31 → 1-1', () => {
    let s = recordOpen(initialStats(), T(2025, 12, 31))
    s = recordOpen(s, T(2026, 1, 1))
    expect(s.streak).toBe(2)
  })
})
