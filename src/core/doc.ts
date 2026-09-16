import { MAX_PETS, SPAWN_INTERVAL_DEFAULT_MIN } from '../config.ts'
import { initialFlags } from './achievements.ts'
import { initialStats } from './stats.ts'
import { isValidTraits } from './traits.ts'
import type { ArchiveEntry, Pet, Settings, Stats, Yard } from './types.ts'

/** 持久化文档的当前结构版本。
 * @autodoc:purpose 持久化文档当前结构版本号 */
export const DOC_SCHEMA_VERSION = 2

/**
 * 序列化形态（§L1）：与 Yard 的唯一差异是 usedCombos 用数组存。
 * 结构对应需求 §5；v1（P0 冒烟档）只有 smokeCounter。
 */
export interface SaveDoc {
  readonly schemaVersion: number
  readonly idCounter: number
  readonly cycle: number
  readonly pets: readonly Pet[]
  readonly archive: readonly ArchiveEntry[]
  readonly usedCombos: readonly string[]
  readonly stats: Stats
  readonly settings: Settings
  readonly lastSpawnAt: number
  readonly createdAt: number
  /** 最近活跃时刻（心情衰减基准，P5 加性，缺省建档时刻）。 */
  readonly lastActiveAt?: number
  /** 已通知过明信片的宠物 id（P5 加性）。 */
  readonly postcardSeen?: readonly string[]
}

/** 创建空院子初始存档（当前版本）。
 * @autodoc:purpose 创建全空的初始存档文档（当前版本号） */
export function createInitialDoc(now: number): SaveDoc {
  return {
    schemaVersion: DOC_SCHEMA_VERSION,
    idCounter: 1,
    cycle: 1,
    pets: [],
    archive: [],
    usedCombos: [],
    stats: initialStats(),
    settings: { spawnIntervalMin: SPAWN_INTERVAL_DEFAULT_MIN, artStyle: 'geo', maxPets: MAX_PETS },
    lastSpawnAt: now,
    createdAt: now,
    lastActiveAt: now,
    postcardSeen: [],
  }
}

/** 数字容错取值：非法/缺失回退默认值。
 * @autodoc:purpose 存档字段数字容错取值（非法回退默认） */
function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** 字符串数组容错取值。
 * @autodoc:purpose 存档字段字符串数组容错取值 */
function strArrayOr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** 宠物记录结构校验。
 * @autodoc:purpose 校验未知值是否为合法宠物记录 */
function isPet(v: unknown): v is Pet {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return typeof p.id === 'string' && p.id !== ''
    && typeof p.name === 'string' && p.name !== ''
    && isValidTraits(p.traits)
    && typeof p.passion === 'number'
    && typeof p.arrivedAt === 'number'
    && typeof p.locked === 'boolean'
    && typeof p.cycle === 'number' && p.cycle >= 1
}

/** 图鉴条目结构校验（宠物 + 离场时间）。
 * @autodoc:purpose 校验未知值是否为合法图鉴条目（含离场时间） */
function isArchiveEntry(v: unknown): v is ArchiveEntry {
  return isPet(v) && typeof (v as { leftAt?: unknown }).leftAt === 'number'
}

/** 统计字段容错归一。
 * @autodoc:category auxiliary
 * @autodoc:purpose 存档统计字段容错归一（缺失回退初始值） */
function statsOr(v: unknown): Stats {
  const base = initialStats()
  if (typeof v !== 'object' || v === null) return base
  const s = v as Record<string, unknown>
  return {
    visitCount: numOr(s.visitCount, base.visitCount),
    openCount: numOr(s.openCount, base.openCount),
    visitLog: Array.isArray(s.visitLog)
      ? s.visitLog.filter((x): x is number => typeof x === 'number')
      : [],
    lastVisitDate: typeof s.lastVisitDate === 'string' ? s.lastVisitDate : null,
    streak: numOr(s.streak, base.streak),
    longestStreak: numOr(s.longestStreak, base.longestStreak),
    metTotal: numOr(s.metTotal, base.metTotal),
    photosTaken: numOr(s.photosTaken, base.photosTaken),
    achievements: Array.isArray(s.achievements)
      ? s.achievements.filter((x): x is string => typeof x === 'string')
      : [...base.achievements!],
    flags: { ...initialFlags(), ...(typeof s.flags === 'object' && s.flags !== null ? s.flags : {}) },
  }
}

/** 设置字段容错归一。
 * @autodoc:category auxiliary
 * @autodoc:purpose 存档设置字段容错归一（缺失回退默认间隔） */
function settingsOr(v: unknown): Settings {
  if (typeof v !== 'object' || v === null) {
    return { spawnIntervalMin: SPAWN_INTERVAL_DEFAULT_MIN, artStyle: 'geo', maxPets: MAX_PETS }
  }
  const s = v as Record<string, unknown>
  return {
    spawnIntervalMin: numOr(s.spawnIntervalMin, SPAWN_INTERVAL_DEFAULT_MIN),
    artStyle: s.artStyle === 'real' ? 'real' : 'geo',
    maxPets: typeof s.maxPets === 'number' && Number.isFinite(s.maxPets)
      ? Math.min(10, Math.max(1, Math.round(s.maxPets)))
      : MAX_PETS,
  }
}

/** 按当前版本规范化 v2 形态存档。
 * @autodoc:purpose 将任意 v2 形态原始值规范化为当前版本存档 */
function normalizeV2(doc: Record<string, unknown>, now: number): SaveDoc {
  const fallback = createInitialDoc(now)
  return {
    schemaVersion: DOC_SCHEMA_VERSION,
    idCounter: Math.max(1, Math.floor(numOr(doc.idCounter, fallback.idCounter))),
    cycle: Math.max(1, Math.floor(numOr(doc.cycle, fallback.cycle))),
    pets: Array.isArray(doc.pets) ? doc.pets.filter(isPet) : [],
    archive: Array.isArray(doc.archive) ? doc.archive.filter(isArchiveEntry) : [],
    usedCombos: [...new Set(strArrayOr(doc.usedCombos))],
    stats: statsOr(doc.stats),
    settings: settingsOr(doc.settings),
    lastSpawnAt: numOr(doc.lastSpawnAt, fallback.lastSpawnAt),
    createdAt: numOr(doc.createdAt, fallback.createdAt),
    lastActiveAt: numOr(doc.lastActiveAt, fallback.lastActiveAt!),
    postcardSeen: strArrayOr(doc.postcardSeen),
  }
}

/**
 * 把存储上的文档迁移到当前版本（§L1）。
 * v1（P0 冒烟档）→ v2：只保留 createdAt，其余按首档初始化。
 * 未知版本：按初始档处理（出现真实多版本历史后再收紧）。
 * @autodoc:purpose 把存储上的存档迁移到当前版本（v1→v2 等） */
export function migrate(raw: unknown, now: number): SaveDoc {
  if (typeof raw !== 'object' || raw === null) return createInitialDoc(now)
  const doc = raw as Record<string, unknown>
  switch (doc.schemaVersion) {
    case DOC_SCHEMA_VERSION:
      return normalizeV2(doc, now)
    case 1:
      return { ...createInitialDoc(now), createdAt: numOr(doc.createdAt, now) }
    default:
      return createInitialDoc(now)
  }
}

/** 存档文档 → 内存 Yard（usedCombos 数组转 Set）。
 * @autodoc:purpose 存档文档转内存态 Yard（usedCombos 转 Set） */
export function fromDoc(doc: SaveDoc): Yard {
  return { ...doc, usedCombos: new Set(doc.usedCombos) }
}

/** 内存 Yard → 存档文档（usedCombos Set 转数组 + 版本戳）。
 * @autodoc:purpose 内存态 Yard 转存档文档（usedCombos 转数组并补版本戳） */
export function toDoc(yard: Yard): SaveDoc {
  return { ...yard, usedCombos: [...yard.usedCombos], schemaVersion: DOC_SCHEMA_VERSION }
}
