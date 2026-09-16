import { ID_PAD, MAX_PETS, OFFLINE_SPAWN_CAP, PET_NAME_MAX } from '../config.ts'
import { DEFAULT_POOLS, derivePet, type TraitPools } from './traits.ts'
import type { ArchiveEntry, Pet, Yard } from './types.ts'

/** 本院在场上限（P6+ UX：settings.maxPets 加性字段，缺省 MAX_PETS）。
 * @autodoc:purpose 读取当前院子的在场宠物数量上限 */
export function maxPetsOf(yard: Yard): number {
  return yard.settings.maxPets ?? MAX_PETS
}

/** id 序号 → 'p_000042' 形态（§L12）。
 * @autodoc:purpose 宠物 id 序号格式化为 'p_000042' 形态 */
export function formatPetId(counter: number): string {
  return `p_${String(counter).padStart(ID_PAD, '0')}`
}

/** 到访间隔（毫秒）。
 * @autodoc:purpose 读取设置中的到访间隔并换算为毫秒 */
export function spawnIntervalMs(yard: Yard): number {
  return yard.settings.spawnIntervalMin * 60_000
}

/** 全锁定暂停：满员且全部被锁定（§L7；上限随 settings.maxPets）。
 * @autodoc:purpose 判定到访是否因满员且全锁定而暂停 */
export function isSpawnPaused(yard: Yard): boolean {
  return yard.pets.length >= maxPetsOf(yard) && yard.pets.every(p => p.locked)
}

/**
 * 时钟判定：距上次到访是否已满一个间隔（§L8）。
 * 离线补算上限：无论过了多久，最多 1 只。全锁定暂停时恒 0。
 * @autodoc:purpose 时钟判定距上次到访是否满一个间隔，离线最多补 1 只 */
export function dueSpawnCount(yard: Yard, now: number): number {
  if (isSpawnPaused(yard)) return 0
  if (now - yard.lastSpawnAt < spawnIntervalMs(yard)) return 0
  return Math.min(1, OFFLINE_SPAWN_CAP)
}

export interface SpawnResult {
  /** 新状态；未发生到访（暂停）时与传入 yard 为同一引用。 */
  readonly yard: Yard
  /** 新到访者；暂停时为 null。 */
  readonly pet: Pet | null
  /** 被淘汰离场者；未触发淘汰为 null。 */
  readonly left: ArchiveEntry | null
  /** true = 满员且全锁定，到访被暂停（状态不变）。 */
  readonly paused: boolean
}

/**
 * 让一次到访立刻发生（不检查时钟；时钟判定用 dueSpawnCount，§L8）。
 * 满员时淘汰到场最早的未锁定宠物（§L6）；锁定者永不参与淘汰。
 * @autodoc:purpose 让一次到访立刻发生：生成新宠物，满员时淘汰最早未锁定者 */
export function spawnPet(yard: Yard, now: number, pools?: TraitPools): SpawnResult {
  let pets = [...yard.pets]
  let left: ArchiveEntry | null = null
  if (pets.length >= maxPetsOf(yard)) {
    const unlocked = pets.filter(p => !p.locked)
    if (unlocked.length === 0) {
      return { yard, pet: null, left: null, paused: true }
    }
    const victim = unlocked.reduce((a, b) => (a.arrivedAt <= b.arrivedAt ? a : b))
    pets = pets.filter(p => p.id !== victim.id)
    left = { ...victim, leftAt: now }
  }
  const id = formatPetId(yard.idCounter)
  const derived = derivePet(id, yard.usedCombos, yard.cycle, pools)
  let usedCombos = yard.usedCombos
  let cycle = yard.cycle
  if (derived.cycle > yard.cycle) {
    cycle = derived.cycle
    usedCombos = new Set()
  }
  usedCombos = new Set(usedCombos).add(derived.comboKey)
  const pet: Pet = {
    id,
    name: derived.defaultName,
    traits: derived.traits,
    passion: derived.passion,
    arrivedAt: now,
    locked: false,
    cycle,
  }
  return {
    yard: {
      ...yard,
      idCounter: yard.idCounter + 1,
      cycle,
      pets: [...pets, pet],
      archive: left === null ? yard.archive : [...yard.archive, left],
      usedCombos,
      stats: { ...yard.stats, metTotal: yard.stats.metTotal + 1 },
      lastSpawnAt: now,
    },
    pet,
    left,
    paused: false,
  }
}

/** 锁定/解锁（需求 §3.4）。解锁后按原 arrivedAt 自然重新参与淘汰（§L6），无需额外字段。
 * @autodoc:purpose 锁定或解锁指定宠物，返回新状态 */
export function setLocked(yard: Yard, petId: string, locked: boolean): Yard {
  return {
    ...yard,
    pets: yard.pets.map(p => (p.id === petId ? { ...p, locked } : p)),
  }
}

/** 重命名（需求 §3.5：自动名可被用户覆盖）。空名/纯空白忽略。
 * @autodoc:purpose 重命名指定宠物（空名忽略，截断到长度上限） */
export function renamePet(yard: Yard, petId: string, name: string): Yard {
  const trimmed = name.trim().slice(0, PET_NAME_MAX)
  return {
    ...yard,
    pets: yard.pets.map(p => (p.id === petId && trimmed !== '' ? { ...p, name: trimmed } : p)),
  }
}
