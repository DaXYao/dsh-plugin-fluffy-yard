import { ACCESSORY_RATE, COMBO_RETRY_LIMIT } from '../config.ts'
import { rngFrom, type Rng } from './rng.ts'
import { makeDefaultName } from './namer.ts'
import type {
  Accessory, Body, Ears, Eyes, Fur, Pattern, Personality, Species, Tail, Traits,
} from './types.ts'

/**
 * 特征维度取值池（需求 §3.2 维度表）。
 * 顺序即生成顺序（§L3）；accessory 池不含 'none'（none 是未命中分支）。
 */
export const SPECIES_POOL = ['cat', 'dog'] as const
export const BODY_POOL = ['small', 'round', 'large'] as const
export const EARS_POOL = ['erect', 'fold', 'droop', 'elf'] as const
export const FUR_POOL = [
  'white', 'black', 'orange', 'gray', 'latte',
  'cow', 'calico', 'bluegray', 'cream', 'smokybrown',
] as const
export const PATTERN_POOL = ['solid', 'spots', 'tabby', 'gradient', 'mittens'] as const
export const TAIL_POOL = ['short', 'long', 'fluffy', 'curl'] as const
export const EYES_POOL = ['amber', 'lakeblue', 'emerald', 'odd'] as const
export const ACCESSORY_POOL = ['scarf', 'bell', 'bowtie'] as const

/** 可注入的维度池：默认全量；测试注入小池以强制触发轮回（§L5）。 */
export interface TraitPools {
  readonly species: readonly Species[]
  readonly body: readonly Body[]
  readonly ears: readonly Ears[]
  readonly fur: readonly Fur[]
  readonly pattern: readonly Pattern[]
  readonly tail: readonly Tail[]
  readonly eyes: readonly Eyes[]
  readonly accessory: readonly Accessory[]
}

export const DEFAULT_POOLS: TraitPools = {
  species: SPECIES_POOL,
  body: BODY_POOL,
  ears: EARS_POOL,
  fur: FUR_POOL,
  pattern: PATTERN_POOL,
  tail: TAIL_POOL,
  eyes: EYES_POOL,
  accessory: ACCESSORY_POOL,
}

/** 全量默认池下的组合空间（含 none 配饰）：2×3×4×10×5×4×4×4 = 76,800。
 * @autodoc:purpose 计算给定维度池下的特征组合总数（含 none 配饰） */
export function totalCombos(pools: TraitPools): number {
  return pools.species.length * pools.body.length * pools.ears.length * pools.fur.length
    * pools.pattern.length * pools.tail.length * pools.eyes.length
    * (pools.accessory.length + 1)
}

export const TOTAL_COMBOS = totalCombos(DEFAULT_POOLS)

/** 组合唯一键：8 维度按固定顺序拼接（§L4）。
 * @autodoc:purpose 将特征组合序列化为唯一键（历史唯一性判定用） */
export function comboKeyOf(traits: Traits): string {
  const t = traits
  return `${t.species}|${t.body}|${t.ears}|${t.fur}|${t.pattern}|${t.tail}|${t.eyes}|${t.accessory}`
}

/** 热情度 → 性格（需求 §3.7 阈值；§L10）。
 * @autodoc:purpose 热情度 0-100 映射为热情/淡定/高冷三档性格 */
export function personalityOf(passion: number): Personality {
  if (passion >= 60) return 'eager'
  if (passion >= 20) return 'calm'
  return 'aloof'
}

/** 用 rng 从池中随机摇一套特征（配饰低概率命中，none 是未命中分支）。
 * @autodoc:purpose 从特征池随机摇出一套完整特征（内部） */
function rollTraits(rng: Rng, pools: TraitPools): Traits {
  return {
    species: rng.pick(pools.species),
    body: rng.pick(pools.body),
    ears: rng.pick(pools.ears),
    fur: rng.pick(pools.fur),
    pattern: rng.pick(pools.pattern),
    tail: rng.pick(pools.tail),
    eyes: rng.pick(pools.eyes),
    accessory: rng.chance(ACCESSORY_RATE) && pools.accessory.length > 0 ? rng.pick(pools.accessory) : 'none',
  }
}

/** 由 id 种子推导的全部出生属性。 */
export interface DerivedPet {
  readonly traits: Traits
  readonly comboKey: string
  readonly passion: number
  readonly personality: Personality
  readonly defaultName: string
  /** 所属轮回代；> 传入的 cycle 表示本只触发了新轮回（调用方负责清空 usedCombos，§L5）。 */
  readonly cycle: number
}

/**
 * 从 id 推导一只宠物的全部出生属性（implementation-plan §3.3）。
 * 纯函数：同 (id, usedCombos 内容, cycle, pools) 必产出同一结果。
 * 冲突 → 同流继续重摇，至多 COMBO_RETRY_LIMIT 次；
 * 重摇耗尽、或 usedCombos 已覆盖全空间 → 接受下一摇并标记 cycle+1。
 * @autodoc:purpose 从宠物 id 种子推导全部出生属性（特征/热情/名字），冲突重摇，耗尽进入轮回 */
export function derivePet(
  id: string,
  usedCombos: ReadonlySet<string>,
  cycle: number,
  pools: TraitPools = DEFAULT_POOLS,
): DerivedPet {
  const rng = rngFrom(id)
  let traits: Traits | null = null
  if (usedCombos.size < totalCombos(pools)) {
    for (let attempt = 0; attempt < COMBO_RETRY_LIMIT; attempt++) {
      const rolled = rollTraits(rng, pools)
      if (!usedCombos.has(comboKeyOf(rolled))) {
        traits = rolled
        break
      }
    }
  }
  const enteredNextCycle = traits === null
  if (traits === null) traits = rollTraits(rng, pools)
  const passion = Math.floor(rng.next() * 101)
  return {
    traits,
    comboKey: comboKeyOf(traits),
    passion,
    personality: personalityOf(passion),
    defaultName: makeDefaultName(rng, traits.species),
    cycle: enteredNextCycle ? cycle + 1 : cycle,
  }
}

/** 存档载入时的特征合法性校验（doc.ts 使用；P2 渲染前的防线）。
 * @autodoc:purpose 校验未知值是否为合法特征组合（存档载入防线） */
export function isValidTraits(value: unknown): value is Traits {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return SPECIES_POOL.includes(t.species as Species)
    && BODY_POOL.includes(t.body as Body)
    && EARS_POOL.includes(t.ears as Ears)
    && FUR_POOL.includes(t.fur as Fur)
    && PATTERN_POOL.includes(t.pattern as Pattern)
    && TAIL_POOL.includes(t.tail as Tail)
    && EYES_POOL.includes(t.eyes as Eyes)
    && (t.accessory === 'none' || (ACCESSORY_POOL as readonly Accessory[]).includes(t.accessory as Accessory))
}
