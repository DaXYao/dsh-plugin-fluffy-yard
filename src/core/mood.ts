import type { Pet } from './types.ts'

export type MoodBand = 'drowsy' | 'calm' | 'happy'

export const MOOD_ZH: Record<MoodBand, string> = { drowsy: '瞌睡', calm: '平静', happy: '开心' }

/** 缺省心情（新宠物/旧档未存时的解释值，H1）。 */
export const MOOD_DEFAULT = 60

export function clampMood(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function moodBandOf(mood: number): MoodBand {
  if (mood >= 80) return 'happy'
  if (mood >= 40) return 'calm'
  return 'drowsy'
}

export function petMood(pet: Pet): number {
  return pet.mood ?? MOOD_DEFAULT
}

/** 全院心情增减（探望 +12 / 合影 +15 等），钳制 0–100（H2）。 */
export function withMoodDelta(pets: readonly Pet[], delta: number): readonly Pet[] {
  return pets.map(p => ({ ...p, mood: clampMood(petMood(p) + delta) }))
}

/** 离线衰减：满 1 小时起每小时 −2，上限 60，不足 1 小时不扣（H2）。 */
export function decayMood(pets: readonly Pet[], elapsedMs: number): readonly Pet[] {
  const hours = Math.max(0, elapsedMs) / 3_600_000
  if (hours < 1) return pets
  const drop = Math.min(60, hours * 2)
  return pets.map(p => ({ ...p, mood: clampMood(petMood(p) - drop) }))
}

export function averageMood(pets: readonly Pet[]): number {
  if (pets.length === 0) return 0
  return pets.reduce((sum, p) => sum + petMood(p), 0) / pets.length
}
