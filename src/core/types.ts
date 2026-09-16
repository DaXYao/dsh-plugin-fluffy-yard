/**
 * 领域模型（需求 §3.2/§3.7/§5）。
 * 取值集合与生成顺序在 traits.ts 冻结（§L3）。
 */

export type Species = 'cat' | 'dog'
export type Body = 'small' | 'round' | 'large'
export type Ears = 'erect' | 'fold' | 'droop' | 'elf'
export type Fur =
  | 'white' | 'black' | 'orange' | 'gray' | 'latte'
  | 'cow' | 'calico' | 'bluegray' | 'cream' | 'smokybrown'
export type Pattern = 'solid' | 'spots' | 'tabby' | 'gradient' | 'mittens'
export type Tail = 'short' | 'long' | 'fluffy' | 'curl'
export type Eyes = 'amber' | 'lakeblue' | 'emerald' | 'odd'
export type Accessory = 'none' | 'scarf' | 'bell' | 'bowtie'

/** 一只宠物的完整特征（组合唯一性的单位，§L4）。 */
export interface Traits {
  readonly species: Species
  readonly body: Body
  readonly ears: Ears
  readonly fur: Fur
  readonly pattern: Pattern
  readonly tail: Tail
  readonly eyes: Eyes
  readonly accessory: Accessory
}

/** 热情度 → 三档性格（需求 §3.7）。 */
export type Personality = 'eager' | 'calm' | 'aloof'

/** 在场宠物（需求 §5）。traits/passion 出生时生成并持久化（§L2）。 */
export interface Pet {
  readonly id: string
  readonly name: string
  readonly traits: Traits
  /** 热情度 0–100，出生决定、终生不变。 */
  readonly passion: number
  /** 到场时间戳（决定淘汰顺序）。 */
  readonly arrivedAt: number
  readonly locked: boolean
  /** 心情 0–100（P5 加性；缺省按 60 解释，见 mood.ts）。 */
  readonly mood?: number
  /** 所属组合轮回代；1 = 初代，≥2 = “二世”（需求 §3.2 耗尽策略）。 */
  readonly cycle: number
}

/** 图鉴条目：已离开的宠物（需求 §5 archive）。 */
export interface ArchiveEntry {
  readonly id: string
  readonly name: string
  readonly traits: Traits
  readonly passion: number
  readonly arrivedAt: number
  readonly leftAt: number
  readonly cycle: number
}

/** 目睹类成就旗标（H8/H11）。 */
export interface AchievementFlags {
  readonly sawChallenge: boolean
  readonly sawCold: boolean
  readonly summonedAloof: boolean
  readonly photoSpotlight: boolean
  readonly lockedOnce: boolean
  readonly lockedFull: boolean
}

export interface Stats {
  /** 总探望次数：每个自然日首次打开面板计 1（需求 §3.6）。 */
  readonly visitCount: number
  /** 累计打开次数（参考指标，§L9）。 */
  readonly openCount: number
  /** 每次探望的时间戳。 */
  readonly visitLog: readonly number[]
  /** 最近一次计为探望的自然日（本地时区 YYYY-MM-DD）。 */
  readonly lastVisitDate: string | null
  readonly streak: number
  readonly longestStreak: number
  /** 相遇总数：历史到访过的宠物总数（=== idCounter - 1，§L12）。 */
  readonly metTotal: number
  /** 合影次数（P4 产出，P1 恒为 0）。 */
  readonly photosTaken: number
  /** 已解锁成就 id（P5 加性）。 */
  readonly achievements?: readonly string[]
  /** 目睹类成就旗标（P5 加性）。 */
  readonly flags?: AchievementFlags
}

/** 立绘美术风格 id：'geo' 几何简笔（P2 形象转正）；'real' 预留给最终版美术。 */
export type ArtStyleId = 'geo' | 'real'

export interface Settings {
  /** 到访间隔（分钟）。 */
  readonly spawnIntervalMin: number
  /**
   * 立绘美术风格（用户决策 #11；持久化于存档，M1/M2）。
   * 类型上可选：受保护的既有测试（spawn.spec）内联 Settings 字面量不含本字段；
   * 运行时由 createInitialDoc/settingsOr 保证恒有值（M2 兜底 'geo'）。
   */
  readonly artStyle?: ArtStyleId
  /** 在场宠物数量上限 1–10（P6+ UX；缺省按 MAX_PETS 解释）。 */
  readonly maxPets?: number
}

/**
 * 内存态领域模型（§L1）。与 SaveDoc 的唯一差异：usedCombos 是 Set。
 * 所有规则函数纯函数式地返回新 Yard（§L11）。
 */
export interface Yard {
  /** 下一个待分配的 id 序号（§L12）。 */
  readonly idCounter: number
  /** 当前组合轮回代。 */
  readonly cycle: number
  readonly pets: readonly Pet[]
  readonly archive: readonly ArchiveEntry[]
  readonly usedCombos: ReadonlySet<string>
  readonly stats: Stats
  readonly settings: Settings
  readonly lastSpawnAt: number
  readonly createdAt: number
  /** 最近活跃时刻（心情衰减基准，P5 加性）。 */
  readonly lastActiveAt?: number
  /** 已通知过明信片的宠物 id（P5 加性）。 */
  readonly postcardSeen?: readonly string[]
}
