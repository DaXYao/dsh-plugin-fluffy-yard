# P1 执行方案：领域内核（执行手册）

> 版本：v1.0 · 对应 `docs/implementation-plan.md` 的 P1 阶段（前置：P0 已验收，见 `docs/p0-report.md`）
> **执行者须知**：本文档为线性执行手册。所有算法与规则语义已由主代理设计并固化为代码模板——**按顺序执行，照抄模板，遇分支走决策树**。本阶段的代码模板即"领域法典"：测试用来验证它，而不是反过来。

---

## 0. 任务说明

### 0.1 目标（= implementation-plan P1 验收门）

实现宠物插件的**全部领域规则**（纯逻辑、零 DOM、零 React、零 DSH 依赖）：

1. 领域模型 + SaveDoc v2（含版本迁移 v1→v2）
2. Seeded RNG（id → 可复现随机流）
3. 特征生成、组合历史唯一、轮回（"二世"）
4. 自动起名（猫/狗音节池）
5. 到访 / 淘汰 / 全锁定暂停 / 解锁重排队 / 离线补 1 只
6. 探望统计（自然日 streak）
7. 全量单测 + 1000 次到访压力模拟
8. 面板更新为「内核冒烟面板」（顺带修复 P0 遗留 #2：深色主题下按钮文字不可见）

**验收门**：`npm run typecheck`、`npm run test` 全绿（含压力模拟）；真实 `dsh --profile pets` 中面板可模拟到访/锁定，旧 v1 存档无损迁移。

### 0.2 检查点映射

| 检查点 | 内容 | 对应任务 |
|---|---|---|
| CP1 | 常量与领域类型（config.ts + types.ts） | P1-1 |
| CP2 | Seeded RNG（rng.ts） | P1-2 |
| CP3 | 特征生成/唯一性/轮回 + 起名（traits.ts + namer.ts） | P1-2/P1-3/P1-4 |
| CP4 | 到访与淘汰规则（spawn.ts） | P1-5 |
| CP5 | 探望统计（stats.ts） | P1-6 |
| CP6 | SaveDoc v2 + 迁移 + persist 更新（doc.ts + persist.ts） | P1-1/P1-7 |
| CP7 | 内核冒烟面板（PetYardView.tsx 重写 + 按钮颜色修复） | P0 遗留 #2 |
| CP8 | 压力模拟 + 全量回归 + 浏览器冒烟 | P1-7 + 验收 |

### 0.3 执行规则（必须遵守）

1. **工作目录** `E:/dsh-plugin-pet`；文件用绝对路径创建/覆写。
2. **不修改**：`docs/` 下所有既有文档（报告写新文件 `docs/p1-report.md`）、`package.json`、`tsdown.config.ts`、`cordis.patch.yml`、`src/index.ts`、`src/client/index.ts`、`src/client/locales.ts`、`src/client/pngExport.ts`——P0 验证过的装载结构一概不动。
3. **模板代码原样落地**。唯一允许的改动：决策树（§10）明确列出的分支。任何偏离记入报告。
4. **测试即验收**：禁止删除/弱化/跳过断言来让测试通过。测试失败时按决策树 D2 处置。
5. **每个检查点先验证再前进**（`npm run typecheck` + 相关测试）。
6. **不引入新依赖**（纯 TS + vitest，现有 devDependencies 足够）。
7. 长驻命令（`dsh --profile pets`）用后台任务；浏览器验证无法自动化时输出清单请用户确认并如实记录。
8. 文件内的中文注释原样保留——它们是规则语义的一部分。

---

## 1. 设计决策速查（领域法典摘要）

执行中遇到"这段为什么这样写"时查这里；不要改语义。

| # | 决策 | 依据 |
|---|---|---|
| L1 | **Yard（内存态）与 SaveDoc（序列化态）分离**：唯一差异是 `usedCombos`——前者 `Set<string>`，后者 `string[]`。转换函数在 doc.ts。 | Set 查重 O(1)；JSON 可序列化 |
| L2 | **出生即持久化**：traits/passion/defaultName 在生成时写入存档，不做纯 id 重推导。 | 冲突重摇使推导依赖历史状态（implementation-plan §3.1 已确认的偏差） |
| L3 | **生成顺序冻结**：species→body→ears→fur→pattern→tail→eyes→accessory→passion→名字。改顺序 = 改变所有未来宠物的长相与性格，禁止。 | 可复现性 |
| L4 | **组合键 = 8 维度按序拼接**（含 accessory），全量组合空间 76,800。需求估算 14,400 未计配饰；含配饰更宽裕，唯一性定义"完整特征组合"更严格。 | 需求 §3.2 |
| L5 | **冲突重摇同流继续**：同一条随机流连续摇下一组，上限 2000 次；重摇耗尽或 `usedCombos.size ≥ 全空间` → 接受下一摇并标记进入新轮回（cycle+1），调用方清空 usedCombos。 | implementation-plan §3.3 |
| L6 | **淘汰**：仅满员（5 只）时触发；目标是到场最早的**未锁定**宠物；解锁后按原 `arrivedAt` 自然重新排队（无额外字段）。 | 需求 §3.1/§3.4 |
| L7 | **暂停**：满员且全部锁定 → 到访暂停；未满员时锁定不影响到访（无淘汰需求）。 | 需求 §3.1 |
| L8 | **时钟**：`now - lastSpawnAt ≥ interval` 才到访，离线再多也只补 1；`lastSpawnAt` 仅在实际到访时推进（暂停期间不推进——解锁后立即补一只，可接受）。 | 需求 §3.1 |
| L9 | **探望口径**：本地自然日内首次"打开"计探望（streak/visitCount/visitLog），同日再开只加 openCount；自然日按**本地时区** `YYYY-MM-DD`。 | 需求 §3.6 |
| L10 | **热情度**：`floor(rng.next()*101)` ∈ [0,100]；≥60 热情 / 20–59 淡定 / <20 高冷（约 41%/40%/20%）。 | 需求 §3.7 |
| L11 | **纯函数风格**：所有规则函数 `(state, …) → 新 state`，不改入参。 | 可测性 |
| L12 | id 分配：`p_` + 6 位补零序号；`idCounter` 存"下一个待分配序号"，分配后 +1；`metTotal === idCounter - 1` 恒成立。 | 需求 §5 |

---

## 2. CP1 — 常量与领域类型

**`src/config.ts`**（新建，原样照抄）

```ts
/**
 * 全部调参常量（implementation-plan §6）。
 * 改这里不动逻辑；运行期不重新读取。
 */

/** 在场宠物数量上限（需求 §3.1）。 */
export const MAX_PETS = 5

/** 到访间隔默认值（分钟；需求 §3.1：默认 30，可配 10 分钟 ~ 24 小时）。 */
export const SPAWN_INTERVAL_DEFAULT_MIN = 30
export const SPAWN_INTERVAL_MIN_MIN = 10
export const SPAWN_INTERVAL_MAX_MIN = 24 * 60

/** 离线补访上限（需求 §3.1：最多补 1 只）。 */
export const OFFLINE_SPAWN_CAP = 1

/** 配饰出现概率（需求 §3.2：低概率；命中后等概率选围巾/铃铛/蝴蝶结）。 */
export const ACCESSORY_RATE = 0.15

/** 特征组合冲突重摇上限；耗尽即进入下一轮回（§L5）。 */
export const COMBO_RETRY_LIMIT = 2000

/** 宠物 id 序号补零宽度：p_000042。 */
export const ID_PAD = 6

/** 用户重命名的最大长度。 */
export const PET_NAME_MAX = 12
```

**`src/core/types.ts`**（新建，原样照抄）

```ts
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
}

export interface Settings {
  /** 到访间隔（分钟），P1 无 UI，恒为默认值。 */
  readonly spawnIntervalMin: number
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
}
```

**验证**：`npm run typecheck` 通过（此时 doc.ts 仍是 P0 版，types.ts 无引用方，纯编译检查）。

---

## 3. CP2 — Seeded RNG

**`src/core/rng.ts`**（新建，原样照抄）

```ts
/**
 * 带种子的随机数（implementation-plan §3.3）。
 * id → xfnv1a 哈希 → mulberry32 流；同 id 必产生同一流（§L3 可复现性的基座）。
 */

/** xfnv1a 变体：字符串 → 32 位无符号种子。 */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  // 末尾雪花化一拍，让短串也散开
  h = (h + (h << 15)) >>> 0
  h ^= h >>> 13
  h = (h + (h << 2)) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

/** mulberry32：种子 → [0, 1) 均匀随机流。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  /** [0, 1)。 */
  next(): number
  /** [0, maxExclusive) 均匀整数。 */
  int(maxExclusive: number): number
  /** 非空数组均匀选取。 */
  pick<T>(items: readonly T[]): T
  /** 以概率 p 命中。 */
  chance(p: number): boolean
}

export function createRng(rand: () => number): Rng {
  return {
    next: rand,
    int: maxExclusive => Math.floor(rand() * maxExclusive),
    pick: items => items[Math.floor(rand() * items.length)],
    chance: p => rand() < p,
  }
}

/** 由任意字符串种子创建随机流（宠物 id 即种子）。 */
export function rngFrom(seedStr: string): Rng {
  return createRng(mulberry32(hashSeed(seedStr)))
}
```

**`tests/rng.spec.ts`**（新建，按以下用例清单编写；断言自行组织，语义不得弱化）

1. `mulberry32(12345)` 两次调用产生的前 100 项序列逐项相等。
2. `mulberry32` 对 10 个不同种子（0–9）产生的首值中，至少 9 个互不相同（散列质量 sanity）。
3. `hashSeed('p_000001')` 两次调用相等，且结果 ∈ [0, 2^32)。
4. `createRng(mulberry32(7)).int(5)` 连续调用 1000 次，全部 ∈ [0, 5)。
5. `rng.pick(['a','b','c','d','e'])` 调 1000 次，每个元素都至少出现一次。
6. `chance(0)` 恒为 false；`chance(1)` 恒为 true。
7. `rngFrom('p_000042')` 两次创建的流，前 10 项逐项相等。

---

## 4. CP3 — 特征生成、唯一性、轮回与起名

**`src/core/namer.ts`**（新建，原样照抄；**音节池内容冻结**——它是可复现推导的一部分）

```ts
import type { Rng } from './rng.ts'
import type { Species } from './types.ts'

/**
 * 自动起名器（需求 §4.1）：音节前缀+后缀拼接，猫狗各有风格池。
 * 名字允许重复（唯一性只约束特征组合）；池内容冻结不改（§L3）。
 */
export const CAT_PREFIX = [
  '汤', '年', '布', '团', '雪', '奶', '麻', '豆', '橘', '糯',
  '芝', '椰', '杏', '芋', '糖', '云', '雾', '抹', '小', '圆',
] as const

export const CAT_SUFFIX = [
  '圆', '糕', '丁', '团', '球', '糖', '薯', '包', '子', '茸',
  '蓉', '泥', '卷', '露', '咪', '花', '瓜', '苏', '苔', '豆',
] as const

export const DOG_PREFIX = [
  '闪', '憨', '煤', '大', '旺', '来', '皮', '铁', '豆', '胖',
  '奔', '灰', '蹦', '雷', '风', '黑', '黄', '奥', '麒', '哮',
] as const

export const DOG_SUFFIX = [
  '电', '憨', '壮', '财', '福', '蛋', '虎', '跑', '哥', '崽',
  '神', '侠', '王', '拳', '铃', '追', '旋', '摸', '鱼', '尾',
] as const

/** 猫名全集（测试用）：前缀×后缀。 */
export function allCatNames(): readonly string[] {
  return CAT_PREFIX.flatMap(p => CAT_SUFFIX.map(s => p + s))
}

/** 狗名全集（测试用）。 */
export function allDogNames(): readonly string[] {
  return DOG_PREFIX.flatMap(p => DOG_SUFFIX.map(s => p + s))
}

export function makeDefaultName(rng: Rng, species: Species): string {
  return species === 'cat'
    ? rng.pick(CAT_PREFIX) + rng.pick(CAT_SUFFIX)
    : rng.pick(DOG_PREFIX) + rng.pick(DOG_SUFFIX)
}
```

**`src/core/traits.ts`**（新建，原样照抄）

```ts
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

/** 全量默认池下的组合空间（含 none 配饰）：2×3×4×10×5×4×4×4 = 76,800。 */
export function totalCombos(pools: TraitPools): number {
  return pools.species.length * pools.body.length * pools.ears.length * pools.fur.length
    * pools.pattern.length * pools.tail.length * pools.eyes.length
    * (pools.accessory.length + 1)
}

export const TOTAL_COMBOS = totalCombos(DEFAULT_POOLS)

/** 组合唯一键：8 维度按固定顺序拼接（§L4）。 */
export function comboKeyOf(traits: Traits): string {
  const t = traits
  return `${t.species}|${t.body}|${t.ears}|${t.fur}|${t.pattern}|${t.tail}|${t.eyes}|${t.accessory}`
}

/** 热情度 → 性格（需求 §3.7 阈值；§L10）。 */
export function personalityOf(passion: number): Personality {
  if (passion >= 60) return 'eager'
  if (passion >= 20) return 'calm'
  return 'aloof'
}

function rollTraits(rng: Rng, pools: TraitPools): Traits {
  return {
    species: rng.pick(pools.species),
    body: rng.pick(pools.body),
    ears: rng.pick(pools.ears),
    fur: rng.pick(pools.fur),
    pattern: rng.pick(pools.pattern),
    tail: rng.pick(pools.tail),
    eyes: rng.pick(pools.eyes),
    accessory: rng.chance(ACCESSORY_RATE) ? rng.pick(pools.accessory) : 'none',
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
 */
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

/** 存档载入时的特征合法性校验（doc.ts 使用；P2 渲染前的防线）。 */
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
    && (t.accessory === 'none' || ACCESSORY_POOL.includes(t.accessory as Accessory))
}
```

**`tests/traits.spec.ts`**（新建，按用例清单编写）

1. **确定性**：`derivePet('p_000042', new Set(['cat|…任意预填键…']), 1)` 连续两次结果 deep-equal；空集亦测。
2. **组合键格式**：手工构造 traits `{species:'cat',body:'small',ears:'erect',fur:'white',pattern:'solid',tail:'long',eyes:'amber',accessory:'none'}` → `comboKeyOf` 精确等于 `'cat|small|erect|white|solid|long|amber|none'`。
3. **性格阈值**：`personalityOf(60/100)→'eager'`、`personalityOf(59/20)→'calm'`、`personalityOf(19/0)→'aloof'`。
4. **全空间**：`totalCombos(DEFAULT_POOLS) === 76800`。
5. **唯一性（正常路径）**：循环 500 次，每次以当前累积 Set 调 `derivePet('p_'+i)`，断言每次返回的 comboKey 不在集合内，然后加入；最终 500 个键互异。
6. **取值合法**：上述 500 次结果全部通过 `isValidTraits`，且 passion ∈ [0,100]。
7. **分布**：对 10,000 个不同 id（空集逐个生成——注意每个 id 用自己的空集调用即可）统计：species 猫/狗各 4,000–6,000；personality eager/calm 各 3,500–4,500、aloof 1,500–2,500；accessory 非 none 占比 12%–18%。
8. **轮回（耗尽快路径）**：小池 `TINY`（见下）`totalCombos === 2`；预填两个可能键的 Set（构造：`new Set([comboKeyOf({species:'cat',…全 small/erect/white/solid/long/amber/none}), comboKeyOf({species:'dog',…同上})])`）→ `derivePet(任意id, 该Set, 1, TINY)` 返回 `cycle === 2`。
9. **轮回（正常路径）**：`derivePet(id, new Set(), 1, TINY)` 返回 `cycle === 1` 且键在 2 个可能值之内。

`TINY` 定义（放在测试文件顶部）：

```ts
const TINY: TraitPools = {
  species: ['cat', 'dog'],
  body: ['small'],
  ears: ['erect'],
  fur: ['white'],
  pattern: ['solid'],
  tail: ['long'],
  eyes: ['amber'],
  accessory: [],
}
```

**`tests/namer.spec.ts`**（新建，按用例清单编写）

1. `makeDefaultName(rngFrom('x1'), 'cat')` 两次调用结果相等（确定性）。
2. 猫名 ∈ `allCatNames()`、狗名 ∈ `allDogNames()`：各用 100 个不同种子断言。
3. 名字长度恒为 2。
4. `derivePet('p_000123', new Set(), 1).defaultName` 与该宠物 species 对应的名字全集匹配。

**验证**：`npm run typecheck && npx vitest run tests/rng.spec.ts tests/traits.spec.ts tests/namer.spec.ts` 全绿。

---

## 5. CP4 — 到访与淘汰

**`src/core/spawn.ts`**（新建，原样照抄）

```ts
import { ID_PAD, MAX_PETS, OFFLINE_SPAWN_CAP, PET_NAME_MAX } from '../config.ts'
import { DEFAULT_POOLS, derivePet, type TraitPools } from './traits.ts'
import type { ArchiveEntry, Pet, Yard } from './types.ts'

/** id 序号 → 'p_000042' 形态（§L12）。 */
export function formatPetId(counter: number): string {
  return `p_${String(counter).padStart(ID_PAD, '0')}`
}

/** 到访间隔（毫秒）。 */
export function spawnIntervalMs(yard: Yard): number {
  return yard.settings.spawnIntervalMin * 60_000
}

/** 全锁定暂停：满员且全部被锁定（§L7）。 */
export function isSpawnPaused(yard: Yard): boolean {
  return yard.pets.length >= MAX_PETS && yard.pets.every(p => p.locked)
}

/**
 * 时钟判定：距上次到访是否已满一个间隔（§L8）。
 * 离线补算上限：无论过了多久，最多 1 只。全锁定暂停时恒 0。
 */
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
 */
export function spawnPet(yard: Yard, now: number, pools?: TraitPools): SpawnResult {
  let pets = [...yard.pets]
  let left: ArchiveEntry | null = null
  if (pets.length >= MAX_PETS) {
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

/** 锁定/解锁（需求 §3.4）。解锁后按原 arrivedAt 自然重新参与淘汰（§L6），无需额外字段。 */
export function setLocked(yard: Yard, petId: string, locked: boolean): Yard {
  return {
    ...yard,
    pets: yard.pets.map(p => (p.id === petId ? { ...p, locked } : p)),
  }
}

/** 重命名（需求 §3.5：自动名可被用户覆盖）。空名/纯空白忽略。 */
export function renamePet(yard: Yard, petId: string, name: string): Yard {
  const trimmed = name.trim().slice(0, PET_NAME_MAX)
  return {
    ...yard,
    pets: yard.pets.map(p => (p.id === petId && trimmed !== '' ? { ...p, name: trimmed } : p)),
  }
}
```

**`tests/spawn.spec.ts`**（新建，**完整照抄**——这是规则验收的核心）

```ts
import { describe, expect, it } from 'vitest'
import { createInitialDoc, fromDoc } from '../src/core/doc.ts'
import { comboKeyOf, totalCombos, type TraitPools } from '../src/core/traits.ts'
import {
  dueSpawnCount, formatPetId, isSpawnPaused, setLocked, spawnIntervalMs, spawnPet,
} from '../src/core/spawn.ts'
import type { Yard } from '../src/core/types.ts'

const MIN = 60_000
const T0 = 1_700_000_000_000

function yard0(now = T0): Yard {
  return fromDoc(createInitialDoc(now))
}

/** 顺序到访 n 次（时间每次 +1ms，保证 arrivedAt 严格递增）。 */
function spawnTimes(yard: Yard, n: number): Yard {
  let cur = yard
  for (let i = 0; i < n; i++) {
    const r = spawnPet(cur, T0 + 1_000 + i)
    if (r.paused) throw new Error('unexpected pause')
    cur = r.yard
  }
  return cur
}

describe('时钟判定 dueSpawnCount（§L8）', () => {
  it('间隔未到 → 0', () => {
    expect(dueSpawnCount(yard0(), T0 + 29 * MIN)).toBe(0)
  })
  it('正好到间隔 → 1', () => {
    expect(dueSpawnCount(yard0(), T0 + 30 * MIN)).toBe(1)
  })
  it('离线再久也只补 1 只', () => {
    expect(dueSpawnCount(yard0(), T0 + 300 * MIN)).toBe(1)
    expect(dueSpawnCount(yard0(), T0 + 30 * 24 * 60 * MIN)).toBe(1)
  })
  it('间隔毫秒数随设置走', () => {
    const y: Yard = { ...yard0(), settings: { spawnIntervalMin: 10 } }
    expect(dueSpawnCount(y, T0 + 9 * MIN)).toBe(0)
    expect(dueSpawnCount(y, T0 + 10 * MIN)).toBe(1)
  })
})

describe('到访与淘汰（§L6/L7/L12）', () => {
  it('空院首次到访：宠物入档，统计与键位齐全', () => {
    const r = spawnPet(yard0(), T0 + MIN)
    expect(r.paused).toBe(false)
    expect(r.pet?.id).toBe('p_000001')
    expect(r.yard.pets).toHaveLength(1)
    expect(r.yard.idCounter).toBe(2)
    expect(r.yard.stats.metTotal).toBe(1)
    expect(r.yard.usedCombos.size).toBe(1)
    expect(r.yard.lastSpawnAt).toBe(T0 + MIN)
    expect(r.left).toBeNull()
  })

  it('连续到访 5 只不触发淘汰', () => {
    const y = spawnTimes(yard0(), 5)
    expect(y.pets).toHaveLength(5)
    expect(y.archive).toHaveLength(0)
    expect(y.stats.metTotal).toBe(5)
  })

  it('满员后到访：最早的未锁定者离场进图鉴', () => {
    const y = spawnTimes(yard0(), 5)
    const r = spawnPet(y, T0 + 10_000)
    expect(r.left?.id).toBe('p_000001')
    expect(r.left?.leftAt).toBe(T0 + 10_000)
    expect(r.yard.pets).toHaveLength(5)
    expect(r.yard.archive).toHaveLength(1)
    expect(r.yard.stats.metTotal).toBe(6)
    // 新到访者在场，离场者不在
    expect(r.yard.pets.map(p => p.id)).toContain('p_000006')
    expect(r.yard.pets.map(p => p.id)).not.toContain('p_000001')
  })

  it('锁定者不被淘汰：淘汰顺位跳到下一只未锁定者', () => {
    const y = spawnTimes(yard0(), 5)
    const locked = setLocked(y, 'p_000001', true)
    const r = spawnPet(locked, T0 + 10_000)
    expect(r.left?.id).toBe('p_000002')
  })

  it('解锁后按原到场时间重新排队（§L6）', () => {
    // A(p1,最早) B(p2) C(p3) D(p4) E(p5)；锁 A → 淘汰 B；解锁 A → 下一只淘汰 A
    let y = spawnTimes(yard0(), 5)
    y = setLocked(y, 'p_000001', true)
    const r1 = spawnPet(y, T0 + 10_000)
    expect(r1.left?.id).toBe('p_000002')
    const unlocked = setLocked(r1.yard, 'p_000001', false)
    const r2 = spawnPet(unlocked, T0 + 20_000)
    expect(r2.left?.id).toBe('p_000001')
  })

  it('未满员时全锁定不暂停到访', () => {
    let y = spawnTimes(yard0(), 3)
    for (const p of y.pets) y = setLocked(y, p.id, true)
    expect(isSpawnPaused(y)).toBe(false)
    const r = spawnPet(y, T0 + 10_000)
    expect(r.paused).toBe(false)
    expect(r.yard.pets).toHaveLength(4)
  })

  it('满员且全锁定：暂停，状态引用不变', () => {
    let y = spawnTimes(yard0(), 5)
    for (const p of y.pets) y = setLocked(y, p.id, true)
    expect(isSpawnPaused(y)).toBe(true)
    const r = spawnPet(y, T0 + 10_000)
    expect(r.paused).toBe(true)
    expect(r.pet).toBeNull()
    expect(r.yard).toBe(y)
    expect(dueSpawnCount(y, T0 + 100 * MIN)).toBe(0)
  })

  it('id 形态与 arrivedAt 单调', () => {
    const y = spawnTimes(yard0(), 3)
    expect(y.pets.map(p => p.id)).toEqual(['p_000001', 'p_000002', 'p_000003'])
    for (let i = 1; i < y.pets.length; i++) {
      expect(y.pets[i]!.arrivedAt).toBeGreaterThan(y.pets[i - 1]!.arrivedAt)
    }
  })
})

describe('轮回（§L5）', () => {
  const TINY: TraitPools = {
    species: ['cat', 'dog'],
    body: ['small'],
    ears: ['erect'],
    fur: ['white'],
    pattern: ['solid'],
    tail: ['long'],
    eyes: ['amber'],
    accessory: [],
  }

  it('小池 2 组合用尽后，第 3 只触发新轮回并清空键位', () => {
    expect(totalCombos(TINY)).toBe(2)
    let y = yard0()
    for (let i = 0; i < 2; i++) {
      const r = spawnPet(y, T0 + i, TINY)
      expect(r.pet?.cycle).toBe(1)
      y = r.yard
    }
    expect(y.usedCombos.size).toBe(2)
    const r3 = spawnPet(y, T0 + 2, TINY)
    expect(r3.pet?.cycle).toBe(2)
    expect(r3.yard.cycle).toBe(2)
    // 新轮回键位清空后只含新到访者的键
    expect(r3.yard.usedCombos.size).toBe(1)
    expect(r3.yard.usedCombos.has(comboKeyOf(r3.pet!.traits))).toBe(true)
    // metTotal 照常累计
    expect(r3.yard.stats.metTotal).toBe(3)
  })
})
```

> 注：`spawn.spec.ts` 引用的 `createInitialDoc/fromDoc` 在 CP6 才改写为 v2——**先写 CP6 的 doc.ts 再跑本测试**，或按检查点顺序执行到 CP6 后统一跑全量。推荐执行顺序：CP1→CP5 全部文件落完后，CP6 一并落地，然后统一 `npx vitest run`。

---

## 6. CP5 — 探望统计

**`src/core/stats.ts`**（新建，原样照抄）

```ts
import type { Stats } from './types.ts'

/** 本地自然日键（YYYY-MM-DD）。统计口径按用户本地时区（§L9，需求 §3.6）。 */
export function dateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** ms 所在自然日的本地昨日键（用日历减日，规避夏令时偏移）。 */
export function yesterdayKey(ms: number): string {
  const d = new Date(ms)
  d.setDate(d.getDate() - 1)
  return dateKey(d.getTime())
}

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
  }
}

/**
 * 记录一次“打开面板”（§L9）：自然日内首次打开计为一次探望
 * （visitCount/visitLog/streak 推进），同日再开只加 openCount。
 */
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
```

**`tests/stats.spec.ts`**（新建，完整照抄——时区鲁棒：全部用本地 `new Date(y, m-1, d, h)` 构造时间戳，测试在任何时区跑结果一致）

```ts
import { describe, expect, it } from 'vitest'
import { dateKey, initialStats, recordOpen, yesterdayKey } from '../src/core/stats.ts'

/** 本地时区时间戳（月用 1-12 的人类习惯）。 */
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
```

---

## 7. CP6 — SaveDoc v2 与迁移

**`src/core/doc.ts`**（**整文件覆写**，替换 P0 版本）

```ts
import { SPAWN_INTERVAL_DEFAULT_MIN } from '../config.ts'
import { initialStats } from './stats.ts'
import { isValidTraits } from './traits.ts'
import type { ArchiveEntry, Pet, Settings, Stats, Yard } from './types.ts'

/** 持久化文档的当前结构版本。 */
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
}

export function createInitialDoc(now: number): SaveDoc {
  return {
    schemaVersion: DOC_SCHEMA_VERSION,
    idCounter: 1,
    cycle: 1,
    pets: [],
    archive: [],
    usedCombos: [],
    stats: initialStats(),
    settings: { spawnIntervalMin: SPAWN_INTERVAL_DEFAULT_MIN },
    lastSpawnAt: now,
    createdAt: now,
  }
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function strArrayOr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

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

function isArchiveEntry(v: unknown): v is ArchiveEntry {
  return isPet(v) && typeof (v as ArchiveEntry).leftAt === 'number'
}

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
  }
}

function settingsOr(v: unknown): Settings {
  if (typeof v !== 'object' || v === null) return { spawnIntervalMin: SPAWN_INTERVAL_DEFAULT_MIN }
  return { spawnIntervalMin: numOr((v as Record<string, unknown>).spawnIntervalMin, SPAWN_INTERVAL_DEFAULT_MIN) }
}

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
  }
}

/**
 * 把存储上的文档迁移到当前版本（§L1）。
 * v1（P0 冒烟档）→ v2：只保留 createdAt，其余按首档初始化。
 * 未知版本：按初始档处理（出现真实多版本历史后再收紧）。
 */
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

export function fromDoc(doc: SaveDoc): Yard {
  return { ...doc, usedCombos: new Set(doc.usedCombos) }
}

export function toDoc(yard: Yard): SaveDoc {
  return { ...yard, usedCombos: [...yard.usedCombos] }
}
```

**`src/client/persist.ts`**（**整文件覆写**）

```ts
import { fromDoc, migrate, toDoc } from '../core/doc.ts'
import type { Yard } from '../core/types.ts'

const STORAGE_KEY = 'dsh-plugin-pet/state'

/** 载入院子状态；读取失败时备份原文并回退初始档，绝不静默丢弃。 */
export function loadYard(now: number): Yard {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return fromDoc(migrate(null, now))
    return fromDoc(migrate(JSON.parse(raw), now))
  } catch (err) {
    console.error('[pet-yard] 存档读取失败，使用初始档：', err)
    if (raw !== null) {
      try {
        localStorage.setItem(`${STORAGE_KEY}.broken`, raw)
      } catch { /* 备份失败忽略 */ }
    }
    return fromDoc(migrate(null, now))
  }
}

export function saveYard(yard: Yard): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toDoc(yard)))
  } catch (err) {
    console.error('[pet-yard] 存档写入失败：', err)
  }
}
```

**`tests/doc.spec.ts`**（**整文件覆写**，替换 P0 版本）

```ts
import { describe, expect, it } from 'vitest'
import { SPAWN_INTERVAL_DEFAULT_MIN } from '../src/config.ts'
import {
  DOC_SCHEMA_VERSION, createInitialDoc, fromDoc, migrate, toDoc,
} from '../src/core/doc.ts'
import { initialStats } from '../src/core/stats.ts'

const NOW = 1_700_000_000_000

describe('createInitialDoc', () => {
  it('首档字段完整', () => {
    const doc = createInitialDoc(NOW)
    expect(doc.schemaVersion).toBe(2)
    expect(doc.idCounter).toBe(1)
    expect(doc.cycle).toBe(1)
    expect(doc.pets).toEqual([])
    expect(doc.archive).toEqual([])
    expect(doc.usedCombos).toEqual([])
    expect(doc.settings.spawnIntervalMin).toBe(SPAWN_INTERVAL_DEFAULT_MIN)
    expect(doc.lastSpawnAt).toBe(NOW)
  })
})

describe('migrate（§L1）', () => {
  it('v1 冒烟档 → v2：保留 createdAt，其余初始化', () => {
    const doc = migrate({ schemaVersion: 1, smokeCounter: 3, createdAt: 123 }, NOW)
    expect(doc.schemaVersion).toBe(DOC_SCHEMA_VERSION)
    expect(doc.createdAt).toBe(123)
    expect(doc.pets).toEqual([])
    expect(doc.stats).toEqual(initialStats())
  })

  it('空输入 → 初始档', () => {
    expect(migrate(null, NOW)).toEqual(createInitialDoc(NOW))
  })

  it('未知版本 → 初始档', () => {
    const doc = migrate({ schemaVersion: 99 }, NOW)
    expect(doc.schemaVersion).toBe(DOC_SCHEMA_VERSION)
    expect(doc.createdAt).toBe(NOW)
  })

  it('v2 损坏字段回退：pets 非数组→[]，usedCombos 去重并过滤非字符串', () => {
    const doc = migrate({
      schemaVersion: 2,
      idCounter: 5,
      cycle: 1,
      pets: 'oops',
      archive: [],
      usedCombos: ['a', 'a', 42, 'b'],
      stats: { visitCount: 'x', openCount: 2 },
      settings: { spawnIntervalMin: 30 },
      lastSpawnAt: NOW,
      createdAt: 1,
    }, NOW)
    expect(doc.pets).toEqual([])
    expect(doc.usedCombos).toEqual(['a', 'b'])
    expect(doc.stats.visitCount).toBe(0)
    expect(doc.stats.openCount).toBe(2)
  })

  it('v2 非法宠物条目被过滤（traits 不合法）', () => {
    const badPet = {
      id: 'p_000001', name: 'x', traits: { species: 'cat', body: '?', ears: 'erect', fur: 'white', pattern: 'solid', tail: 'long', eyes: 'amber', accessory: 'none' },
      passion: 50, arrivedAt: 1, locked: false, cycle: 1,
    }
    const doc = migrate({ schemaVersion: 2, idCounter: 2, cycle: 1, pets: [badPet], archive: [], usedCombos: [], stats: {}, settings: {}, lastSpawnAt: 1, createdAt: 1 }, NOW)
    expect(doc.pets).toEqual([])
  })
})

describe('Yard ↔ SaveDoc 往返（§L1）', () => {
  it('fromDoc/toDoc 往返保持全部字段（usedCombos Set↔数组）', () => {
    const doc = createInitialDoc(NOW)
    const round = toDoc(fromDoc(doc))
    expect(round).toEqual(doc)
    expect(fromDoc(doc).usedCombos instanceof Set).toBe(true)
  })
})
```

**验证**：`npm run typecheck && npm run test`——此时 doc/spawn/stats/traits/namer/rng 全部测试应全绿（PetYardView 仍引用旧的 loadDoc/saveDoc/smokeCounter，typecheck 会报错——**先完成 CP7 再跑**；或临时跳过 typecheck 只跑 vitest）。

---

## 8. CP7 — 内核冒烟面板

**`src/client/PetYardView.tsx`**（**整文件覆写**，替换 P0 占位面板；同时修复 P0 遗留 #2——按钮显式 `color`）

```tsx
import { useEffect, useState } from 'react'
import { loadYard, saveYard } from './persist.ts'
import { downloadSvgAsPng } from './pngExport.ts'
import { personalityOf } from '../core/traits.ts'
import { setLocked, spawnPet } from '../core/spawn.ts'
import { recordOpen } from '../core/stats.ts'
import { MAX_PETS } from '../config.ts'
import type { Personality, Pet, Species, Yard } from '../core/types.ts'

const TEST_CARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="720" viewBox="0 0 540 720">
  <rect width="540" height="720" rx="24" fill="#fdf6ec"/>
  <circle cx="270" cy="330" r="120" fill="#f5b896"/>
  <circle cx="228" cy="300" r="14" fill="#3a2e28"/>
  <circle cx="312" cy="300" r="14" fill="#3a2e28"/>
  <path d="M252 352 q18 18 36 0" stroke="#3a2e28" stroke-width="6" fill="none" stroke-linecap="round"/>
  <text x="270" y="80" font-family="sans-serif" font-size="34" fill="#6b5b4d" text-anchor="middle">毛茸茸小院</text>
  <text x="270" y="560" font-family="sans-serif" font-size="26" fill="#6b5b4d" text-anchor="middle">P1 内核冒烟面板</text>
  <text x="270" y="620" font-family="sans-serif" font-size="20" fill="#a89880" text-anchor="middle">dsh-plugin-pet</text>
</svg>`

const SPECIES_ZH: Record<Species, string> = { cat: '猫', dog: '狗' }
const PERSONALITY_ZH: Record<Personality, string> = { eager: '热情', calm: '淡定', aloof: '高冷' }

const panelStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 280,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  padding: 20,
  background: '#faf6f0',
  fontFamily: 'system-ui, sans-serif',
  color: '#4a3f35',
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 10,
  border: '1px solid #c9b8a5',
  background: '#fff',
  color: '#4a3f35',
  cursor: 'pointer',
  fontSize: 14,
}

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  fontSize: 13,
  background: '#fff',
  borderRadius: 10,
}

const cellStyle: React.CSSProperties = {
  border: '1px solid #e5d9c9',
  padding: '5px 10px',
  textAlign: 'left',
  color: '#4a3f35',
}

/**
 * P1 内核冒烟面板：用真实 core 函数手动驱动到访/锁定/淘汰，
 * 在 P2 场景引擎就位前作为领域规则的活体验证台。
 */
export function PetYardView(_props: unknown): React.ReactElement {
  const [yard, setYard] = useState<Yard | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const now = Date.now()
    const loaded = loadYard(now)
    const opened: Yard = { ...loaded, stats: recordOpen(loaded.stats, now) }
    setYard(opened)
    saveYard(opened)
  }, [])

  if (yard === null) {
    return <div style={panelStyle}>载入中…</div>
  }

  const visit = (): void => {
    const result = spawnPet(yard, Date.now())
    setYard(result.yard)
    saveYard(result.yard)
    if (result.paused) {
      setMessage('小院已满，住满都是你锁定的宝贝（到访暂停）')
      return
    }
    const parts = [`${result.pet?.name ?? '?'}（${result.pet?.id ?? '?'}）到访啦`]
    if (result.left !== null) parts.push(`${result.left.name} 收拾行李告别`)
    setMessage(parts.join('；'))
  }

  const toggleLock = (pet: Pet): void => {
    const next = setLocked(yard, pet.id, !pet.locked)
    setYard(next)
    saveYard(next)
    setMessage(pet.locked ? `${pet.name} 已解锁` : `${pet.name} 已锁定（不再参与淘汰）`)
  }

  const exportPng = (): void => {
    downloadSvgAsPng(TEST_CARD_SVG, 'dsh-plugin-pet-p1.png')
      .then(() => setMessage('PNG 已开始下载'))
      .catch(err => setMessage(`导出失败：${String(err)}`))
  }

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: 0, fontSize: 20 }}>宠物小院（P1 内核冒烟）</h2>
      <p style={{ margin: 0, fontSize: 13 }}>
        在场 {yard.pets.length}/{MAX_PETS} · 已相遇 {yard.stats.metTotal} · 组合 {yard.usedCombos.size}
        · 轮回 第{yard.cycle}代 · 探望 {yard.stats.visitCount} 次 · 连续 {yard.stats.streak} 天
        · 最长 {yard.stats.longestStreak} 天 · 打开 {yard.stats.openCount} 次
      </p>
      {yard.pets.length > 0 && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>名字</th>
              <th style={cellStyle}>编号</th>
              <th style={cellStyle}>物种</th>
              <th style={cellStyle}>性格</th>
              <th style={cellStyle}>热情度</th>
              <th style={cellStyle}>轮回</th>
              <th style={cellStyle}>到场</th>
              <th style={cellStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {yard.pets.map(pet => (
              <tr key={pet.id}>
                <td style={cellStyle}>{pet.locked ? `🔒 ${pet.name}` : pet.name}</td>
                <td style={cellStyle}>{pet.id}</td>
                <td style={cellStyle}>{SPECIES_ZH[pet.traits.species]}</td>
                <td style={cellStyle}>{PERSONALITY_ZH[personalityOf(pet.passion)]}</td>
                <td style={cellStyle}>{pet.passion}</td>
                <td style={cellStyle}>{pet.cycle === 1 ? '—' : `第${pet.cycle}代`}</td>
                <td style={cellStyle}>{new Date(pet.arrivedAt).toLocaleTimeString()}</td>
                <td style={cellStyle}>
                  <button type="button" style={buttonStyle} onClick={() => toggleLock(pet)}>
                    {pet.locked ? '解锁' : '锁定'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" style={buttonStyle} onClick={visit}>模拟到访</button>
        <button type="button" style={buttonStyle} onClick={exportPng}>导出测试 PNG</button>
      </div>
      {message !== '' && <p style={{ margin: 0, fontSize: 13, color: '#8a7a66' }}>{message}</p>}
    </div>
  )
}
```

**验证（构建）**：

```bash
npm run typecheck && npm run bundle
```

**浏览器冒烟**（dsh 若未在跑：后台启动 `dsh --profile pets`，等终端打印 URL；P0 报告遗留 #3 提到它可能仍在 3080 端口运行——先探测再决定是否重启。构建产物变化后 client-hmr 会在数秒内自动热替换）：

1. 打开面板：统计行显示（此时已相遇 0 等字段来自旧 v1 存档迁移——**旧的 smokeCounter=3 应消失，存档建立时间保留**）。
2. 点「模拟到访」6 次：前 5 次每次多一行宠物；第 6 次出现"…到访啦；…收拾行李告别"，行数保持 5。
3. 锁定某一行 → 再「模拟到访」→ 被淘汰的是另一只（最早的未锁定者）；把 5 只全部锁定 → 再点 → 提示"小院已满…"。
4. 解锁一只 → 「模拟到访」恢复，被淘汰者 = 最早的未锁定者（含刚解锁的）。
5. 刷新页面（F5）→ 表格与统计保留（localStorage 持久化）；同日再开，"探望 N 次"不变、"打开 N 次"+1。
6. 深色主题下检查按钮文字可见（P0 遗留 #2 修复确认）。
7. DevTools Console 无红色报错。

---

## 9. CP8 — 压力模拟与全量回归

**`tests/pressure.spec.ts`**（新建，**完整照抄**——P1 验收门）

```ts
import { describe, expect, it } from 'vitest'
import { createInitialDoc, fromDoc } from '../src/core/doc.ts'
import { rngFrom } from '../src/core/rng.ts'
import { dueSpawnCount, setLocked, spawnPet } from '../src/core/spawn.ts'
import { personalityOf, type TraitPools } from '../src/core/traits.ts'
import { MAX_PETS } from '../src/config.ts'
import type { Pet, Yard } from '../src/core/types.ts'

const MIN = 60_000

describe('压力模拟：1000 次到访（默认池，含随机锁定/解锁）', () => {
  it('全程不变量成立', () => {
    let yard: Yard = fromDoc(createInitialDoc(1_000_000_000_000))
    const testRng = rngFrom('pressure-seed')   // 锁定/解锁动作可复现
    let now = 1_000_000_000_000
    let spawnCount = 0
    const speciesCount = { cat: 0, dog: 0 }
    const personalityCount = { eager: 0, calm: 0, aloof: 0 }

    for (let i = 0; i < 1000; i++) {
      now += 31 * MIN   // 间隔 30 分钟，每步推进 31 分钟 → 必到期

      // 随机锁定/解锁（约 1/6 概率动一只）。刻意避免制造"满员全锁定"态——
      // 暂停路径已由 spawn.spec 覆盖，这里要保证 1000 次到访全部发生。
      if (yard.pets.length > 0 && testRng.chance(1 / 6)) {
        const target = testRng.pick(yard.pets)
        const lockedCount = yard.pets.filter(p => p.locked).length
        const wouldAllLock = !target.locked
          && yard.pets.length === MAX_PETS
          && lockedCount === MAX_PETS - 1
        if (!wouldAllLock) {
          yard = setLocked(yard, target.id, !target.locked)
        }
      }

      expect(dueSpawnCount(yard, now)).toBe(1)
      const r = spawnPet(yard, now)
      expect(r.paused).toBe(false)
      expect(r.pet).not.toBeNull()

      // 不变量：淘汰者永不是当前锁定者（对照到访前的锁定集合）
      if (r.left !== null) {
        const lockedBefore = new Set(yard.pets.filter(p => p.locked).map(p => p.id))
        expect(lockedBefore.has(r.left.id)).toBe(false)
      }

      yard = r.yard
      spawnCount++

      // 不变量：数量上限
      expect(yard.pets.length).toBeLessThanOrEqual(MAX_PETS)
      // 不变量：相遇总数 = 在场 + 图鉴 = 已生成数
      expect(yard.pets.length + yard.archive.length).toBe(spawnCount)
      expect(yard.stats.metTotal).toBe(spawnCount)
      expect(yard.idCounter).toBe(spawnCount + 1)
      // 不变量：组合在当前轮回内唯一
      expect(yard.usedCombos.size).toBe(spawnCount)

      speciesCount[r.pet!.traits.species]++
      personalityCount[personalityOf(r.pet!.passion)]++
    }

    // 终态：默认池 76,800 组合，1000 次不触发轮回
    expect(yard.cycle).toBe(1)
    expect(spawnCount).toBe(1000)
    // 分布 sanity（宽区间，防实现性偏差）
    expect(speciesCount.cat).toBeGreaterThan(400)
    expect(speciesCount.cat).toBeLessThan(600)
    for (const [k, v] of Object.entries(personalityCount)) {
      if (k === 'aloof') { expect(v).toBeGreaterThan(150); expect(v).toBeLessThan(250) }
      else { expect(v).toBeGreaterThan(350); expect(v).toBeLessThan(450) }
    }
  })
})

describe('轮回压力：小池强制多代', () => {
  const TINY: TraitPools = {
    species: ['cat', 'dog'],
    body: ['small'],
    ears: ['erect'],
    fur: ['white'],
    pattern: ['solid'],
    tail: ['long'],
    eyes: ['amber'],
    accessory: [],
  }

  /** 与 core 的 comboKeyOf 相同的拼接规则（测试侧独立重算，避免同源假通过）。 */
  function combosKeyOfPet(pet: Pet): string {
    const t = pet.traits
    return `${t.species}|${t.body}|${t.ears}|${t.fur}|${t.pattern}|${t.tail}|${t.eyes}|${t.accessory}`
  }

  it('每代组合内部唯一，代数随生成数上升', () => {
    let yard: Yard = fromDoc(createInitialDoc(1_000_000_000_000))
    let now = 1_000_000_000_000
    const combosByCycle = new Map<number, Set<string>>()
    for (let i = 0; i < 50; i++) {
      now += 31 * MIN
      const r = spawnPet(yard, now, TINY)
      expect(r.paused).toBe(false)
      yard = r.yard
      const pet = r.pet!
      const key = combosKeyOfPet(pet)
      let set = combosByCycle.get(pet.cycle)
      if (set === undefined) {
        set = new Set<string>()
        combosByCycle.set(pet.cycle, set)
      }
      expect(set.has(key)).toBe(false)
      set.add(key)
    }
    // 2 组合/代 → 50 只至少 25 代
    expect(yard.cycle).toBeGreaterThanOrEqual(25)
    expect(yard.stats.metTotal).toBe(50)
  })
})
```

**全量回归**：

```bash
npm run typecheck
npm run test          # 全部 spec 全绿
npm run bundle        # 产物重建，head/tail 验证工厂包裹仍在（同 P0 CP1）
```

---

## 10. 决策树（失败时的唯一分支来源）

**D1 · typecheck 报错**
→ 依次检查：`verbatimModuleSyntax` 开启时类型导入是否都用了 `import type`；`as const` 数组赋给 `readonly T[]` 字段是否直接可用（应当可用）；`Record<Species, string>` 等映射是否覆盖全部字面量成员。模板即规范，不要用 `any` 绕过类型错误（`_props: unknown` 是唯一预置的宽松点）。

**D2 · 测试失败**
→ 处置规程（顺序执行）：
1. 先怀疑测试实现笔误（对照 §1 决策表与模板代码逐条核对）；
2. 若确认是**模板代码之间**互相矛盾（例如 spawn.ts 与 traits.ts 语义冲突），停在这一步，把矛盾点原文记入报告——**禁止单方面修改任何一侧的语义**；
3. 若确认是模板代码与本手册 §1 决策表矛盾，同样记录报告，可按决策表修正模板（这属于有据修改，需在报告中写明）。
**绝不允许**：删除断言、放宽数字区间、跳过用例。

**D3 · 分布类断言偶发失败**
→ vitest 重跑一次（随机性容差边缘）。仍失败 → 区间放宽 1 个百分点并记录；再失败 → 按 D2-2 处理。

**D4 · 浏览器冒烟异常（面板空白/报错/热替换不生效）**
→ Console 报错原文记入报告；确认 `npm run bundle` 已成功且 `lib/client.js` 头部仍是 `window.__ModuleLoader__.load` 包裹；`dsh --profile pets` 终端无 fiber 报错。仍异常 → F5 强刷重试一次；再异常 → 记录并请用户确认（可能需要重启 dsh 进程：`netstat -ano | grep 3080` 找 PID 后 `taskkill //F //PID <pid>`，再后台启动）。

**D5 · 旧存档迁移异常**
→ DevTools 执行 `localStorage.getItem('dsh-plugin-pet/state')`，把原文记入报告；执行 `localStorage.removeItem('dsh-plugin-pet/state')` 后重载（开发期可接受），再走一遍冒烟。迁移逻辑本身的修复按 D2 处置。

---

## 11. 报告模板（`docs/p1-report.md` 原样填空）

```markdown
# P1 执行报告

- 日期：
- 执行环境：node / vitest 版本：

## 检查点结果

| 检查点 | 结果 | 备注 |
|---|---|---|
| CP1 类型与常量 | | |
| CP2 RNG | | 用例数 |
| CP3 特征/起名 | | 用例数 + 分布实测值（猫狗比、三性格比、配饰率） |
| CP4 到访/淘汰 | | 用例数 |
| CP5 统计 | | 用例数 |
| CP6 存档 v2 | | 用例数 + v1 迁移结果 |
| CP7 冒烟面板 | | 浏览器验证各项（含深色主题按钮文字） |
| CP8 压力模拟 | | 1000 次模拟耗时 + 轮回模拟结果 |

## 测试统计

（`npm run test` 输出摘要：文件数 / 用例数 / 时长）

## 偏差与决策树使用记录

（每处偏离模板的地方：原因 + 决策树编号 + 结果）

## 遇到的报错与处置

（报错原文 + 处置 + 是否解决）

## 遗留问题 / 待用户决策
```

---

## 12. 禁止事项

1. 不修改 §0.3-2 列出的 P0 已验证文件（构建/装载/槽位结构）。
2. 不实现 P2+ 的内容：SVG 立绘、场景引擎、动画、美术素材、设置 UI——本阶段面板只是 core 的冒烟台。
3. 不为让测试通过而弱化断言（见 D2）。
4. 不引入新依赖；不改动 `package.json`。
5. 音节池、维度取值池、生成顺序**冻结**——它们是可复现推导的一部分（§L3）。
6. 遇到需要产品判断的情况（规则语义两难、模板矛盾）→ 记录并报告，不擅自定夺。
