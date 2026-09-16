export type DayPhase = 'day' | 'dusk' | 'night'

/** 本地小时 → 三段（H4）。 */
export function phaseOfHour(hour: number): DayPhase {
  if (hour >= 6 && hour < 16) return 'day'
  if (hour >= 16 && hour < 19) return 'dusk'
  return 'night'
}

export function phaseOf(ms: number): DayPhase {
  return phaseOfHour(new Date(ms).getHours())
}

/** 三套场景配色（inline style 覆盖 CSS 类；H4/H14）。 */
export const PHASE_COLORS: Record<DayPhase, { readonly sky: string; readonly grass: string }> = {
  day: { sky: '#dcecf5', grass: '#c4e0b8' },
  dusk: { sky: '#f5dcc8', grass: '#c8c39a' },
  night: { sky: '#3d4661', grass: '#5c6e63' },
}
