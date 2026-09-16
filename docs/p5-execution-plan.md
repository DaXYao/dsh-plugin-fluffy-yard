# P5 执行方案：M3 里程碑——心情·明信片·成就·昼夜（执行手册）

> 版本：v1.0 · 对应 `docs/implementation-plan.md` v1.5 的 P5 阶段（前置：P4 已验收 M2，见 `docs/p4-report.md`；P4 的三处有据修正——excursion 持有者校验、durationOf 判空、ArchiveEntry→petView——**均已在本手册模板中固化**）
> **执行者须知**：线性执行手册。「精确编辑」按锚点落地；「整文件覆写」以模板为准。锚点编辑遇到 `@autodoc` 注释时保留注释、只改代码。

---

## 0. 任务说明

### 0.1 目标（= 需求 M3 里程碑 + P4 遗留修复）

1. **心情系统**（需求 §4.2-1）：每只宠物心情 0–100（瞌睡/平静/开心）；探望 +12、合影 +15、离线每小时 −2（上限 60）；心情影响卖萌频率；夜晚更容易打盹；**全院平均 ≥80 时淡定者偶尔加入争宠（临时加演）**。
2. **明信片**（§4.2-2）：离开满 3 天的宠物按 id 确定性"寄回"一张明信片（模板池文案），图鉴 📮 归档 + 弹窗查看，新到 toast。
3. **成就系统**（§4.2-4）：14 项成就、纯评估器、目睹旗标、🏆 面板（已解锁/未解锁灰显）。
4. **昼夜/天气**（§4.2-5）：本地时间三段（白天/黄昏/夜晚）场景配色；激活时 10% 概率雨天覆盖层（纯视觉）。
5. **P4 遗留**：`PHOTO_TIMEOUT_MS` 3000→5000；缩放反应的 tilt/twitch 后延迟 600ms 再重排（可见性）。

### 0.2 检查点

| CP | 内容 |
|---|---|
| CP1 | core：types/stats/doc 锚点编辑 + `mood.ts` + mood.spec |
| CP2 | core：`postcard.ts` + postcard.spec；doc 的 postcardSeen |
| CP3 | core：`achievements.ts` + achievements.spec |
| CP4 | client：`dayNight.ts` + dayNight.spec；actions pickAction 重写；actor 锚点编辑 |
| CP5 | engine 整文件覆写（昼夜/雨/见证钩子/反应延迟/心情加演）+ spotlight 锚点编辑 + spotlight3.spec |
| CP6 | ui：panels 整文件覆写（🏆/📮/明信片弹窗）；controller 整文件覆写 |
| CP7 | 构建 + 全量回归 |
| CP8 | M3 验收清单 |

### 0.3 执行规则

1. 工作目录 `E:/dsh-plugin-pet`。**不修改**：`docs/` 既有文档（报告写 `docs/p5-report.md`）、`package.json`（零新依赖）、`tsdown.config.ts`、`cordis.patch.yml`、`src/index.ts`、`src/client/index.ts`、`locales.ts`、`pngExport.ts`、`persist.ts`、`PetYardView.tsx`、`debug.ts`、`render/`（palette/parts/petSprite/styles/labels/cardRender/photoExport）、`stage/`（svgDom/tiers/lineup/interactMenu 同名文件）、`ui/toast.ts`、`ui/avatarBar.ts`、`src/core/` 其余（rng/namer/spawn/traits）、`tests/` 全部既有测试。
2. **允许修改**：`src/config.ts`（CP5 一处值修改）；`src/core/types.ts`、`stats.ts`、`doc.ts`（锚点编辑）；`src/client/stage/actions.ts`（pickAction 块替换 + CSS 追加）、`actor.ts`（锚点编辑）、`spotlight.ts`（锚点编辑）、`engine.ts`/`ui/panels.ts`/`yardController.ts`（整文件覆写）。
3. 模板原样落地；偏离走 §12 决策树并记录。测试即验收（禁删断言）。每 CP 后 `npm run typecheck`。中文注释保留。

---

## 1. 设计决策速查（P5 法典）

| # | 决策 |
|---|---|
| H1 | **心情**：`Pet.mood?`（0–100 可选加性字段，缺省 60）。三档：<40 瞌睡 / 40–79 平静 / ≥80 开心。锁定/热情度不受心情影响。 |
| H2 | **心情事件**：自然日首次探望全院 +12；合影导出成功全院 +15；均钳制 0–100。**衰减**：激活时按 `now - lastActiveAt` 每小时 −2、上限 60、不足 1 点不扣；`lastActiveAt` 每次激活刷新并随存档持久化（SaveDoc/Yard 均为可选字段）。 |
| H3 | **心情×动作权重**（`pickAction(personality, mood, night)`）：开心 → 卖萌类（jump/roll/spin/tail/stretch/lick/tilt）×1.6、sleep ×0.5；瞌睡 → sleep ×2、卖萌类 ×0.6；平静不变。night → sleep ×1.5（H4）。 |
| H4 | **昼夜**：`phaseOf(hour)`——6–16 白天 / 16–19 黄昏 / 其余夜晚；经 `ActorContext.dayPhase` 传入 actor。三套 sky/grass 配色以 **inline style** 覆盖 CSS 类（序列化克隆保留 inline style，合影自动带昼夜色）。 |
| H5 | **加演**：`averageMood(pets) ≥ 80` 时引擎给 `spotlight.tick` 传 `calmChallenge: true`——挑战者池扩至淡定者（≥20）；**高冷（<20）永不参与**。加演不改变性格档案与 G6 让位规则。 |
| H6 | **天气**：每次激活（start/visibility→visible）10% 概率雨天（`.py-rain` 覆盖层，CSS 斜线动画）；纯视觉，不影响任何规则。 |
| H7 | **明信片**：资格 = `now - leftAt ≥ 3 天`（确定性）；文案 = `rngFrom(id + ':postcard')` 从 8 条模板池选 1（含 {name} 占位）；图鉴行资格成立显示 📮，点击开明信片弹窗（迷你立绘 + 文案）；`SaveDoc.postcardSeen?` 记录已通知 id，激活时新资格 toast「收到 X 寄来的明信片」。 |
| H8 | **成就**：`stats.achievements?`（已解锁 id）+ `stats.flags?`（sawChallenge/sawCold/summonedAloof/photoSpotlight/lockedOnce/lockedFull 六布尔）；`evaluateAchievements(yard)` 纯函数返回新解锁；controller 在每次状态变更后评估，解锁即 toast「🏆 解锁成就：X」并持久化。 |
| H9 | **成就清单**（14 项，id 冻结）：first-visit/streak-7/streak-30/first-meet/meet-50/dex-all/first-photo/photo-20/first-lock/lock-5/huddle-photo/witness-bump/witness-cold/summon-aloof（中文名见模板）。连续类用 `longestStreak`（历史达成即解锁）。 |
| H10 | **万物图鉴**（dex-all）：在场 + 图鉴的全部 traits 中，`EARS_POOL` 与 `FUR_POOL` 的每个值各出现过一次。 |
| H11 | **目睹旗标来源**：sawChallenge = 聚光灯 challenge/summon 顶替事件（含点名）；sawCold = 冷场 vacant 事件；summonedAloof = 点名高冷者上台；photoSpotlight = 聚光灯档完成合影（拍照时档位判定）；lockedOnce/lockedFull = controller 锁定路径。 |
| H12 | **P4 遗留**：`PHOTO_TIMEOUT_MS = 5000`；`tierReaction` 后 `setTimeout(600ms)` 再 `assignSlots()`（tilt/twitch 可见；600ms 内再次跨档则清旧定时器）。 |
| H13 | **UI**：工具条 📊 📖 📷 🏆 ⚙️ 五键；成就面板两段（已解锁/未解锁灰显含达成条件）；HUD 追加「心情 均值+档位」；头像 title 带心情档。所有新字段加性可选、normalize 兜底、**不升 schemaVersion**；既有 doc/spawn/spotlight/spotlight2 测试必须零回归。 |
| H14 | 允许微调（记录）：三套配色、雨动画参数、心情增减数值、加演均值门槛（≥80）。H1–H12 语义不可改。 |

---

## 2. CP1 — 心情（core）

**`src/core/types.ts` 锚点编辑三处**：

① `Pet` 接口中 `readonly locked: boolean` 行后追加：

```ts
  /** 心情 0–100（P5 加性；缺省按 60 解释，见 mood.ts）。 */
  readonly mood?: number
```

② `Stats` 接口的 `readonly photosTaken: number` 行后追加：

```ts
  /** 已解锁成就 id（P5 加性）。 */
  readonly achievements?: readonly string[]
  /** 目睹类成就旗标（P5 加性）。 */
  readonly flags?: AchievementFlags
```

③ `Stats` 接口定义之前插入：

```ts
/** 目睹类成就旗标（H8/H11）。 */
export interface AchievementFlags {
  readonly sawChallenge: boolean
  readonly sawCold: boolean
  readonly summonedAloof: boolean
  readonly photoSpotlight: boolean
  readonly lockedOnce: boolean
  readonly lockedFull: boolean
}
```

④ `Yard` 接口的 `readonly createdAt: number` 行后追加：

```ts
  /** 最近活跃时刻（心情衰减基准，P5 加性）。 */
  readonly lastActiveAt?: number
  /** 已通知过明信片的宠物 id（P5 加性）。 */
  readonly postcardSeen?: readonly string[]
```

**`src/core/mood.ts`**（新建，整文件）：

```ts
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

/** 离线衰减：每小时 −2，上限 60，不足 1 点不扣（H2）。 */
export function decayMood(pets: readonly Pet[], elapsedMs: number): readonly Pet[] {
  const hours = Math.max(0, elapsedMs) / 3_600_000
  const drop = Math.min(60, hours * 2)
  if (drop < 1) return pets
  return pets.map(p => ({ ...p, mood: clampMood(petMood(p) - drop) }))
}

export function averageMood(pets: readonly Pet[]): number {
  if (pets.length === 0) return 0
  return pets.reduce((sum, p) => sum + petMood(p), 0) / pets.length
}
```

**`src/core/stats.ts` 锚点编辑**：文件顶部 import 区追加 `import { initialFlags } from './achievements.ts'`；`initialStats()` 返回对象的 `photosTaken: 0,` 行后追加：

```ts
    achievements: [],
    flags: initialFlags(),
```

**`src/core/doc.ts` 锚点编辑四处**（遇 `@autodoc` 注释保留）：

① `SaveDoc` 接口的 `readonly createdAt: number` 行后追加：

```ts
  /** 最近活跃时刻（心情衰减基准，P5 加性，缺省建档时刻）。 */
  readonly lastActiveAt?: number
  /** 已通知过明信片的宠物 id（P5 加性）。 */
  readonly postcardSeen?: readonly string[]
```

② `createInitialDoc` 的 `createdAt: now,` 行后追加 `lastActiveAt: now,` 与 `postcardSeen: [],` 两行。

③ `statsOr` 函数的 `photosTaken: numOr(s.photosTaken, base.photosTaken),` 行后追加：

```ts
    achievements: Array.isArray(s.achievements)
      ? s.achievements.filter((x): x is string => typeof x === 'string')
      : [...base.achievements!],
    flags: { ...initialFlags(), ...(typeof s.flags === 'object' && s.flags !== null ? s.flags : {}) },
```

并在 doc.ts 顶部 import 区追加 `import { initialFlags } from './achievements.ts'`。

④ `normalizeV2` 的 `createdAt: numOr(doc.createdAt, fallback.createdAt),` 行后追加：

```ts
    lastActiveAt: numOr(doc.lastActiveAt, fallback.lastActiveAt!),
    postcardSeen: strArrayOr(doc.postcardSeen),
```

**`tests/mood.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import {
  MOOD_DEFAULT, averageMood, clampMood, decayMood, moodBandOf, petMood, withMoodDelta,
} from '../src/core/mood.ts'
import type { Pet } from '../src/core/types.ts'

const PET: Pet = {
  id: 'p_000001', name: 'x',
  traits: { species: 'cat', body: 'small', ears: 'erect', fur: 'white', pattern: 'solid', tail: 'long', eyes: 'amber', accessory: 'none' },
  passion: 50, arrivedAt: 0, locked: false, cycle: 1,
}

describe('心情（H1/H2）', () => {
  it('三档边界', () => {
    expect(moodBandOf(39)).toBe('drowsy')
    expect(moodBandOf(40)).toBe('calm')
    expect(moodBandOf(79)).toBe('calm')
    expect(moodBandOf(80)).toBe('happy')
  })
  it('缺省 60；clamp 0–100', () => {
    expect(petMood(PET)).toBe(MOOD_DEFAULT)
    expect(petMood({ ...PET, mood: 90 })).toBe(90)
    expect(clampMood(120)).toBe(100)
    expect(clampMood(-5)).toBe(0)
  })
  it('增减钳制', () => {
    expect(withMoodDelta([{ ...PET, mood: 95 }], 12)[0]!.mood).toBe(100)
    expect(withMoodDelta([{ ...PET, mood: 5 }], -12)[0]!.mood).toBe(0)
  })
  it('离线衰减：每小时 -2、上限 60、不足 1 点不扣', () => {
    expect(decayMood([{ ...PET, mood: 80 }], 1_800_000)).toEqual([{ ...PET, mood: 80 }])
    expect(decayMood([{ ...PET, mood: 80 }], 3_600_000)[0]!.mood).toBe(78)
    expect(decayMood([{ ...PET, mood: 80 }], 100 * 3_600_000)[0]!.mood).toBe(20)
  })
  it('均值（缺省按 60）', () => {
    expect(averageMood([PET, { ...PET, mood: 80 }])).toBe(70)
    expect(averageMood([])).toBe(0)
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/mood.spec.ts tests/doc.spec.ts tests/spawn.spec.ts`（CP1 只落 mood/stats/types 部分；achievements.ts 尚未建——若 typecheck 报 `./achievements.ts` 不存在，**先创建 CP3 的 achievements.ts 空实现再回来**，或直接按 CP1→CP3 顺序连续落地后统一验证。推荐：CP1 与 CP3 的 core 文件全部落地后统一跑测试）。

---

## 3. CP2 — 明信片（core）

**`src/core/postcard.ts`**（新建，整文件；**模板池冻结**——确定性推导的一部分）：

```ts
import { rngFrom } from './rng.ts'

/** 离开满 N 天可获得明信片（H7）。 */
export const POSTCARD_AFTER_DAYS = 3

const MS_PER_DAY = 86_400_000

const TEMPLATES = [
  '在新家的院子里晒太阳，很想念你 ——{name}',
  '这边的小鱼干也不错，但还是想你 ——{name}',
  '交了新朋友！它有点像你 ——{name}',
  '今天追了一整天蝴蝶，睡得很好 ——{name}',
  '偶尔还会路过那扇窗户 ——{name}',
  '新院子有个小坡，我承包了 ——{name}',
  '听见雨声就会想起你 ——{name}',
  '长胖了一点点，别担心 ——{name}',
] as const

/** 由宠物 id 确定性推导的明信片文案（H7）。 */
export function postcardTextFor(id: string, name: string): string {
  return rngFrom(`${id}:postcard`).pick([...TEMPLATES]).replaceAll('{name}', name)
}

/** 资格：离开满 POSTCARD_AFTER_DAYS 天。 */
export function postcardEligible(leftAt: number, now: number): boolean {
  return now - leftAt >= POSTCARD_AFTER_DAYS * MS_PER_DAY
}
```

**`tests/postcard.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { POSTCARD_AFTER_DAYS, postcardEligible, postcardTextFor } from '../src/core/postcard.ts'

const DAY = 86_400_000

describe('明信片（H7）', () => {
  it('确定性：同 id 同文案，名字被代入', () => {
    const a = postcardTextFor('p_000001', '汤圆')
    expect(postcardTextFor('p_000001', '汤圆')).toBe(a)
    expect(a).toContain('汤圆')
    const b = postcardTextFor('p_000001', '年糕')
    expect(b).toContain('年糕')
    expect(b).not.toBe(a)
  })
  it('不同 id 产出不同模板（20 个 id 至少 2 种）', () => {
    const set = new Set(Array.from({ length: 20 }, (_, i) => postcardTextFor(`p_${String(i + 1).padStart(6, '0')}`, 'x')))
    expect(set.size).toBeGreaterThanOrEqual(2)
  })
  it('资格边界：满 3 天整为真，差 1ms 为假', () => {
    const left = 1_000_000_000
    expect(postcardEligible(left, left + POSTCARD_AFTER_DAYS * DAY)).toBe(true)
    expect(postcardEligible(left, left + POSTCARD_AFTER_DAYS * DAY - 1)).toBe(false)
  })
})
```

**验证**：`npx vitest run tests/postcard.spec.ts` 全绿。

---

## 4. CP3 — 成就（core）

**`src/core/achievements.ts`**（新建，整文件）：

```ts
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
```

**`tests/achievements.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { createInitialDoc, fromDoc } from '../src/core/doc.ts'
import { ACHIEVEMENTS, evaluateAchievements } from '../src/core/achievements.ts'
import { EARS_POOL, FUR_POOL } from '../src/core/traits.ts'
import { spawnPet } from '../src/core/spawn.ts'
import type { Pet, Yard } from '../src/core/types.ts'

const NOW = 1_700_000_000_000

function yard0(): Yard {
  return fromDoc(createInitialDoc(NOW))
}

function withPets(yard: Yard, pets: Pet[]): Yard {
  return { ...yard, pets }
}

function petOf(id: string, ears: string, fur: string): Pet {
  return {
    id, name: id,
    traits: { species: 'cat', body: 'small', ears: ears as Pet['traits']['ears'], fur: fur as Pet['traits']['fur'], pattern: 'solid', tail: 'long', eyes: 'amber', accessory: 'none' },
    passion: 50, arrivedAt: 0, locked: false, cycle: 1,
  }
}

const byId = (yard: Yard, ids: string[]): string[] =>
  evaluateAchievements(yard).filter(d => ids.includes(d.id)).map(d => d.id)

describe('成就（H8–H11）', () => {
  it('空院子不解锁任何成就', () => {
    expect(evaluateAchievements(yard0())).toEqual([])
  })
  it('探望/相遇/合影类按数值触发', () => {
    let y = yard0()
    y = { ...y, stats: { ...y.stats, visitCount: 1, metTotal: 1, photosTaken: 1 } }
    expect(byId(y, ['first-visit', 'first-meet', 'first-photo'])).toEqual(['first-visit', 'first-meet', 'first-photo'])
    y = { ...y, stats: { ...y.stats, longestStreak: 7 } }
    expect(byId(y, ['streak-7', 'streak-30'])).toEqual(['streak-7'])
  })
  it('目睹旗标类触发', () => {
    let y = yard0()
    y = { ...y, stats: { ...y.stats, flags: { sawChallenge: true, sawCold: true, summonedAloof: true, photoSpotlight: true, lockedOnce: true, lockedFull: true } } }
    const ids = evaluateAchievements(y).map(d => d.id)
    for (const id of ['huddle-photo', 'witness-bump', 'witness-cold', 'summon-aloof', 'first-lock', 'lock-5']) {
      expect(ids).toContain(id)
    }
  })
  it('万物图鉴：耳型+毛色全值各一次', () => {
    const pets: Pet[] = []
    let i = 1
    for (const ears of EARS_POOL) for (const fur of FUR_POOL) {
      pets.push(petOf(`p_${String(i++).padStart(6, '0')}`, ears, fur))
    }
    expect(byId(withPets(yard0(), pets), ['dex-all'])).toEqual(['dex-all'])
    expect(byId(withPets(yard0(), pets.slice(0, pets.length - 1)), ['dex-all'])).toEqual([])
  })
  it('已解锁不再重复', () => {
    let y = yard0()
    y = { ...y, stats: { ...y.stats, visitCount: 1 } }
    y = { ...y, stats: { ...y.stats, achievements: ['first-visit'] } }
    expect(byId(y, ['first-visit'])).toEqual([])
  })
  it('清单 id 唯一且共 14 项', () => {
    expect(ACHIEVEMENTS.length).toBe(14)
    expect(new Set(ACHIEVEMENTS.map(d => d.id)).size).toBe(14)
  })
  it('与 spawn 集成：一次到访解锁 first-meet', () => {
    const y = spawnPet(yard0(), NOW).yard
    expect(byId(y, ['first-meet'])).toEqual(['first-meet'])
  })
})
```

**验证**：`npm run typecheck && npx vitest run`（此刻全部既有 + mood/postcard/achievements 应全绿）。

---

## 5. CP4 — 昼夜与动作权重（client）

**`src/client/dayNight.ts`**（新建，整文件）：

```ts
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
```

**`tests/dayNight.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { PHASE_COLORS, phaseOfHour } from '../src/client/dayNight.ts'

describe('昼夜（H4）', () => {
  it('三段边界', () => {
    expect(phaseOfHour(5)).toBe('night')
    expect(phaseOfHour(6)).toBe('day')
    expect(phaseOfHour(15)).toBe('day')
    expect(phaseOfHour(16)).toBe('dusk')
    expect(phaseOfHour(18)).toBe('dusk')
    expect(phaseOfHour(19)).toBe('night')
    expect(phaseOfHour(23)).toBe('night')
  })
  it('三套配色齐全', () => {
    for (const c of Object.values(PHASE_COLORS)) {
      expect(c.sky.length).toBeGreaterThan(0)
      expect(c.grass.length).toBeGreaterThan(0)
    }
  })
})
```

**`src/client/stage/actions.ts` 锚点编辑两处**：

① 整个 `pickAction` 函数替换为（H3）：

```ts
/** 卖萌类动作（心情加权的对象，H3）。 */
const CUTE_ACTIONS = new Set<ScheduledAction>(['jump', 'roll', 'spin', 'tail', 'stretch', 'lick', 'tilt'])

/** 按性格 × 心情 × 昼夜加权随机挑日常动作（视觉随机，Math.random，非领域推导）。 */
export function pickAction(personality: Personality, mood = 60, night = false): ScheduledAction {
  const entries = Object.keys(ACTION_WEIGHTS) as ScheduledAction[]
  const weights = entries.map(key => {
    let weight = ACTION_WEIGHTS[key][personality]
    if (mood >= 80) weight *= key === 'sleep' ? 0.5 : CUTE_ACTIONS.has(key) ? 1.6 : 1
    else if (mood < 40) weight *= key === 'sleep' ? 2 : CUTE_ACTIONS.has(key) ? 0.6 : 1
    if (night && key === 'sleep') weight *= 1.5
    return weight
  })
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = Math.random() * total
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return entries[i]!
  }
  return 'idle'
}
```

② `STAGE_CSS` 末尾（`.py-debug input[type='number'] { width: 52px; }` 行后、闭合反引号前）追加：

```css
.py-rain { position: absolute; inset: 0; z-index: 4; pointer-events: none; background: repeating-linear-gradient(75deg, transparent 0 14px, rgba(160,190,220,0.35) 14px 15px, transparent 15px 26px); animation: py-rain 0.5s linear infinite; }
@keyframes py-rain { from { background-position: 0 0; } to { background-position: -60px 120px; } }
.py-postcard { position: absolute; inset: 0; z-index: 45; background: rgba(58,46,38,0.35); display: flex; align-items: center; justify-content: center; }
.py-postcard .inner { background: #fffdf8; border-radius: 14px; padding: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.25); text-align: center; max-width: 320px; }
.py-postcard svg { width: 120px; height: 132px; display: block; margin: 0 auto; }
.py-postcard .text { font-size: 14px; color: #4a3f35; margin: 10px 0; line-height: 1.6; }
.py-postcard button { font-size: 13px; padding: 5px 14px; border-radius: 8px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-achv-done { color: #4a3f35; }
.py-achv-todo { color: #b8a894; }
.py-panel .achv-row { display: flex; justify-content: space-between; padding: 3px 0; }
```

**`src/client/stage/actor.ts` 锚点编辑四处**：

① import 区 `import { ACTION_DURATION, pickAction, type ActionName } from './actions.ts'` 行后追加 `import type { DayPhase } from '../dayNight.ts'`。

② `ActorContext` 接口的 `readonly flatten: boolean` 行后追加：

```ts
  readonly dayPhase: DayPhase
```

③ 字段 `private lastWidth = 0` 行后追加 `private lastDayPhase: DayPhase = 'day'`。

④ `update()` 首行 `this.lastWidth = ctx.width` 后追加 `this.lastDayPhase = ctx.dayPhase`；`scheduleNext()` 中 `const next = pickAction(personalityOf(this.pet.passion))` 替换为：

```ts
    const next = pickAction(
      personalityOf(this.pet.passion),
      this.pet.mood ?? 60,
      this.lastDayPhase === 'night',
    )
```

**验证**：`npm run typecheck`（actor 的 ctx 新字段会在 CP5 engine 覆写后闭环）。

---

## 6. CP5 — 引擎与聚光灯扩展

**`src/config.ts` 精确编辑**：`export const PHOTO_TIMEOUT_MS = 3000` 改为 `export const PHOTO_TIMEOUT_MS = 5000`，注释改为 `/** 合影：召回移动的超时上限（ms；宽舞台最远槽位约 3.1s，P4 遗留 #1 调大）。 */`。

**`src/client/stage/spotlight.ts` 锚点编辑两处**（保留 P4 的 durationOf 判空修正）：

① `tick` 签名 `tick(pets: readonly SpotlightPet[], tier: Tier, now: number): readonly SpotlightEvent[] {` 替换为：

```ts
  tick(
    pets: readonly SpotlightPet[],
    tier: Tier,
    now: number,
    options: { readonly calmChallenge?: boolean } = {},
  ): readonly SpotlightEvent[] {
```

② 挑战者行 `const challengers = pets.filter(p => p.passion >= EAGER_PASSION && p.id !== this.holderId)` 替换为：

```ts
    // 加演（H5）：全院高心情时挑战者池扩至淡定者；高冷永不参与
    const minPassion = options.calmChallenge === true ? CALM_MIN : EAGER_PASSION
    const challengers = pets.filter(p => p.passion >= minPassion && p.id !== this.holderId)
```

**`tests/spotlight3.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { SpotlightMachine, type SpotlightPet } from '../src/client/stage/spotlight.ts'

const OPTS = { rotateMs: 15_000, rotateLockedMs: 30_000 }
const T0 = 1_000_000

function petOf(id: string, passion: number, arrivedAt = 0): SpotlightPet {
  return { id, passion, locked: false, arrivedAt }
}

describe('心情加演（H5）', () => {
  it('calmChallenge 开：淡定者可顶替热情现任', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, 10), petOf('b', 40, 20)]
    m.tick(pets, 'spotlight', T0)
    const ev = m.tick(pets, 'spotlight', T0 + 15_000, { calmChallenge: true })
    expect(ev[0]).toEqual({ type: 'challenge', challengerId: 'b', previousHolderId: 'a' })
  })
  it('calmChallenge 关（默认）：淡定者在场不构成挑战（延续 P4 语义）', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, 10), petOf('b', 40, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000)).toEqual([])
  })
  it('高冷（<20）即使 calmChallenge 也不参与', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, 10), petOf('c', 10, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000, { calmChallenge: true })).toEqual([])
  })
})
```

**`src/client/stage/engine.ts`**（**整文件覆写**；P4 版 + P5 六处扩展。为控制篇幅，**未变化的私有方法体（slotX/edgeTargets/updateStrut/updateDash/refreshBadges/updateExcursion 等）与 P4 落地版逐字相同**——落地时以当前仓库 engine.ts 为基底，按下述「编辑指令」精确修改，**不整文件替换**）：

编辑指令（共 8 处，锚点均为代码行）：

1. import 区追加两行：

```ts
import { PHASE_COLORS, phaseOf, type DayPhase } from '../dayNight.ts'
import { averageMood } from '../../core/mood.ts'
```

2. `EngineOptions` 的 `onColdStart?: () => void` 行后追加：

```ts
  /** 目睹类事件（成就旗标来源，H11）。 */
  readonly onWitness?: (kind: 'challenge' | 'cold' | 'summon-aloof' | 'photo-spotlight') => void
```

3. 字段区 `private photoActive = false` 后追加：

```ts
  private dayPhase: DayPhase = 'day'
  private phaseCheckAt = 0
  private reactionTimer: ReturnType<typeof setTimeout> | null = null
  private rainEl: HTMLDivElement | null = null
```

4. 构造器 `this.stageDiv.append(this.svg, this.hud)` 后追加：

```ts
    this.applyPhase(phaseOf(Date.now()))
```

并在 `getStageEl` 方法后新增两个方法：

```ts
  /** 昼夜配色（inline style 覆盖 CSS 类；H4）。 */
  private applyPhase(phase: DayPhase): void {
    this.dayPhase = phase
    const colors = PHASE_COLORS[phase]
    this.svg.querySelectorAll<SVGRectElement>('.py-sky').forEach(el => { el.style.fill = colors.sky })
    this.svg.querySelectorAll<SVGRectElement>('.py-grass').forEach(el => { el.style.fill = colors.grass })
  }

  /** 雨天覆盖层（H6；纯视觉）。 */
  setRain(on: boolean): void {
    if (on && this.rainEl === null) {
      this.rainEl = document.createElement('div')
      this.rainEl.className = 'py-rain'
      this.stageDiv.appendChild(this.rainEl)
    } else if (!on && this.rainEl !== null) {
      this.rainEl.remove()
      this.rainEl = null
    }
  }
```

5. `loop` 内 `const ctx: ActorContext = { width: this.w, groundY: this.groundY, flatten: this.flatten }` 替换为：

```ts
      this.phaseCheckAt += dt
      if (this.phaseCheckAt >= 30_000) {
        this.phaseCheckAt = 0
        const phase = phaseOf(Date.now())
        if (phase !== this.dayPhase) this.applyPhase(phase)
      }
      const ctx: ActorContext = { width: this.w, groundY: this.groundY, flatten: this.flatten, dayPhase: this.dayPhase }
```

6. `evalTier` 的 `this.tierReaction(next, prev)` 行后、`this.assignSlots()` 行替换为延迟版（H12）：

```ts
      this.tierReaction(next, prev)
      // H12：延迟重排让 tilt/twitch 可见；新跨档清旧定时器
      if (this.reactionTimer !== null) clearTimeout(this.reactionTimer)
      this.reactionTimer = setTimeout(() => {
        this.reactionTimer = null
        this.assignSlots()
      }, 600)
```

7. `runSpotlight` 的 spotlight.tick 调用行替换为（H5）：

```ts
    const calmChallenge = averageMood(pets) >= 80
    for (const ev of this.spotlight.tick(pets, this.tier, Date.now(), { calmChallenge })) {
      this.applySpotlightEvent(ev)
    }
```

8. 见证钩子三处（H11）：`applySpotlightEvent` 的 `else`（challenge）分支 `console.info(...)` 行前追加 `this.opts.onWitness?.('challenge')`；`vacant` 分支 `this.opts.onColdStart?.()` 行后追加 `this.opts.onWitness?.('cold')`；`summon` 方法内 `if (events.length === 0) return false` 行后追加：

```ts
    const summoned = pets.find(p => p.id === petId)
    if (summoned !== undefined && personalityOf(summoned.passion) === 'aloof') {
      this.opts.onWitness?.('summon-aloof')
    }
```

`photoSession` 内 `const svg = serializeStageSvg(this.svg)` 行前追加：

```ts
    if (this.tier === 'spotlight') this.opts.onWitness?.('photo-spotlight')
```

`dispose` 内 `cancelAnimationFrame(this.raf)` 行后追加 `if (this.reactionTimer !== null) clearTimeout(this.reactionTimer)`。

**验证**：`npm run typecheck && npx vitest run tests/spotlight3.spec.ts tests/spotlight.spec.ts tests/spotlight2.spec.ts`。

---

## 7. CP6 — 面板与控制器

**`src/client/ui/panels.ts`**：以当前版本为基底做四处编辑（不整文件替换）：

1. import 区追加 `import { ACHIEVEMENTS } from '../../core/achievements.ts'`。
2. `PanelsOptions` 的 `onArchiveCard` 行后追加：

```ts
  /** 查看明信片（📮）。 */
  readonly onPostcard: (petId: string) => void
```

3. 工具条 innerHTML：`'<button type="button" data-panel="archive" title="图鉴">📖</button>'` 行后追加 `'<button type="button" data-panel="achv" title="成就">🏆</button>'`；`let opened` 的联合类型改为 `'stats' | 'settings' | 'archive' | 'achv' | null`；toolbar click 的 `const which = button.dataset.panel as ...` 同步扩联合，并在 render 分支链追加 `else if (which === 'achv') renderAchv()`；`refresh` 追加 achv 分支。新增：

```ts
  const renderAchv = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const unlocked = new Set(yard.stats.achievements ?? [])
    const rows = ACHIEVEMENTS.map(def => unlocked.has(def.id)
      ? `<div class="achv-row py-achv-done"><span>🏆 ${def.titleZh}</span><span class="log">${def.descZh}</span></div>`
      : `<div class="achv-row py-achv-todo"><span>◻ ${def.titleZh}</span><span class="log">${def.descZh}</span></div>`).join('')
    panel.innerHTML = '<h3>成就</h3>'
      + '<button type="button" class="py-close" data-close>×</button>'
      + rows
  }
```

4. 图鉴行模板中 `<span class="log">№${e.id.slice(2)} · ${met} → ${left}</span>` 前追加明信片标记（需 `import { postcardEligible } from '../../core/postcard.ts'` 与 now 参数——renderArchive 内取 `const now = Date.now()`）：`${postcardEligible(e.leftAt, now) ? '<span title="有明信片">📮</span>' : ''}`；并在 panel click 委托的 `data-arch` 处理改为：点击行内 📮（`button.dataset.pc === '1'`，行模板 button 上加 `data-pc="${postcardEligible(e.leftAt, now) ? '1' : '0'}"`）→ `opts.onPostcard(arch)`，否则 `opts.onArchiveCard(arch)`——即 button click 处理中：

```ts
    const arch = button.dataset.arch
    if (arch !== undefined) {
      if (button.dataset.pc === '1') opts.onPostcard(arch)
      else opts.onArchiveCard(arch)
    }
```

文件末尾追加明信片弹窗（与 openCardModal 并列）：

```ts
/** 明信片弹窗（H7）。 */
export function openPostcardModal(
  stage: HTMLElement,
  svg: string,
  text: string,
): void {
  stage.querySelector('.py-postcard')?.remove()
  const modal = document.createElement('div')
  modal.className = 'py-postcard'
  modal.innerHTML = `<div class="inner">${svg}<div class="text">${text}</div>`
    + '<button type="button">收下了</button></div>'
  modal.addEventListener('click', event => {
    if (event.target === modal || (event.target as HTMLElement).closest('button') !== null) {
      modal.remove()
    }
  })
  stage.appendChild(modal)
}
```

**`src/client/yardController.ts`**（**整文件覆写**；P4 版 + P5 全部接线）：

```ts
import { MAX_PETS, SAVE_DEBOUNCE_MS } from '../config.ts'
import { createInitialDoc, fromDoc, toDoc } from '../core/doc.ts'
import {
  dueSpawnCount, formatPetId, isSpawnPaused, renamePet, setLocked,
  spawnIntervalMs, spawnPet, type SpawnResult,
} from '../core/spawn.ts'
import { recordOpen } from '../core/stats.ts'
import { derivePet, personalityOf } from '../core/traits.ts'
import { ACHIEVEMENTS, evaluateAchievements } from '../core/achievements.ts'
import { MOOD_ZH, averageMood, decayMood, moodBandOf, withMoodDelta } from '../core/mood.ts'
import { postcardEligible, postcardTextFor } from '../core/postcard.ts'
import type { ArtStyleId, Pet, Yard } from '../core/types.ts'
import { mountDebugPanel } from './debug.ts'
import { loadYard, saveYard } from './persist.ts'
import { downloadSvgAsPng, triggerDownload } from './pngExport.ts'
import { cardFileName, cardSvg } from './render/cardRender.ts'
import { decoratePhotoSvg } from './render/photoExport.ts'
import { styleOf } from './render/styles.ts'
import { StageEngine } from './stage/engine.ts'
import { TIER_LABEL_ZH } from './stage/tiers.ts'
import { mountAvatarBar, type AvatarBarHandle } from './ui/avatarBar.ts'
import { closeInteractMenu, openInteractMenu } from './ui/interactMenu.ts'
import {
  closeCardModal, mountPanels, openCardModal, openPostcardModal, type PanelsHandle,
} from './ui/panels.ts'
import { showToast } from './ui/toast.ts'

const STORAGE_KEY = 'dsh-plugin-pet/state'
const MOOD_VISIT_GAIN = 12
const MOOD_PHOTO_GAIN = 15

export class YardController {
  private yard: Yard | null = null
  private readonly engine: StageEngine
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private hudTimer: ReturnType<typeof setInterval> | null = null
  private disposeDebug: (() => void) | null = null
  private readonly pendingGreet = new Map<string, string>()
  private disposed = false
  private panels: PanelsHandle | null = null
  private avatarBar: AvatarBarHandle | null = null
  private pauseToasted = false
  private coldToasted = false
  private photoBusy = false

  constructor(private readonly container: HTMLElement) {
    this.engine = new StageEngine(container, {
      onPetClick: petId => this.handlePetClick(petId),
      onPetEntered: petId => this.handlePetEntered(petId),
      onSpawnCheck: now => this.handleSpawnCheck(now),
      onTierChanged: () => this.refreshHud(),
      onHolderChanged: () => this.refreshUi(),
      onColdStart: () => {
        this.coldToastOnce()
        this.setFlag('sawCold', true)
      },
      onWitness: kind => this.setFlag(
        kind === 'challenge' ? 'sawChallenge' : kind === 'summon-aloof' ? 'summonedAloof' : 'photoSpotlight',
        true,
      ),
    })
  }

  start(): void {
    const now = Date.now()
    let yard = loadYard(now)
    yard = { ...yard, stats: recordOpen(yard.stats, now) }
    // 心情：离线衰减 + 自然日首次探望全院 +12（H2）
    yard = { ...yard, pets: decayMood(yard.pets, now - (yard.lastActiveAt ?? yard.createdAt)) }
    yard = { ...yard, pets: withMoodDelta(yard.pets, MOOD_VISIT_GAIN) }
    yard = { ...yard, lastActiveAt: now }
    let offlinePetId: string | null = null
    if (dueSpawnCount(yard, now) > 0) {
      const result = spawnPet(yard, now)
      yard = result.yard
      if (result.pet !== null) offlinePetId = result.pet.id
    }
    this.yard = yard
    this.engine.start()
    this.engine.restyle(yard.settings.artStyle ?? 'geo')
    this.engine.setRain(Math.random() < 0.1)   // H6：10% 雨

    const stage = this.engine.getStageEl()
    this.panels = mountPanels(stage, {
      getYard: () => this.yard,
      onIntervalChange: min => this.applyInterval(min),
      onStyleChange: id => this.applyStyle(id),
      onPhoto: () => void this.takePhoto(),
      getStyle: () => styleOf(this.yard?.settings.artStyle ?? 'geo'),
      onArchiveCard: petId => this.openArchiveCard(petId),
      onPostcard: petId => this.openPostcard(petId),
    })
    this.avatarBar = mountAvatarBar(
      stage,
      () => styleOf(this.yard?.settings.artStyle ?? 'geo'),
      petId => this.summonPet(petId),
      petId => this.openMenuForPet(petId),
    )

    const initialPets = offlinePetId === null
      ? yard.pets
      : yard.pets.filter(p => p.id !== offlinePetId)
    this.engine.syncPets(initialPets, { initial: true })
    if (offlinePetId !== null) {
      this.pendingGreet.set(offlinePetId, '它在门口等你很久啦！')
      this.engine.syncPets(yard.pets)
    }
    this.disposeDebug = mountDebugPanel(this.container, this, this.engine)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.hudTimer = setInterval(() => this.refreshHud(), 1000)
    this.refreshUi()
    this.checkNewPostcards()
    this.evaluate()
    this.scheduleSave()
  }

  dispose(): void {
    this.disposed = true
    this.flushSave()
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.hudTimer !== null) clearInterval(this.hudTimer)
    this.disposeDebug?.()
    const stage = this.engine.getStageEl()
    closeInteractMenu(stage)
    closeCardModal(stage)
    this.avatarBar?.dispose()
    this.panels?.dispose()
    this.engine.dispose()
  }

  private onVisibility = (): void => {
    if (this.disposed || this.yard === null) return
    if (document.visibilityState === 'visible') {
      const now = Date.now()
      let yard = { ...this.yard, stats: recordOpen(this.yard.stats, now) }
      yard = { ...yard, pets: decayMood(yard.pets, now - (yard.lastActiveAt ?? yard.createdAt)) }
      yard = { ...yard, pets: withMoodDelta(yard.pets, MOOD_VISIT_GAIN), lastActiveAt: now }
      if (dueSpawnCount(yard, now) > 0) {
        const result = spawnPet(yard, now)
        yard = result.yard
        if (result.pet !== null) this.pendingGreet.set(result.pet.id, '它在门口等你很久啦！')
      }
      this.yard = yard
      this.engine.syncPets(yard.pets)
      this.scheduleSave()
      this.refreshUi()
      this.checkNewPostcards()
      this.evaluate()
    } else {
      this.yard = this.yard === null ? null : { ...this.yard, lastActiveAt: Date.now() }
      this.flushSave()
    }
  }

  // ---- 成就（H8/H11） ----

  /** 置目睹旗标并即时评估。 */
  private setFlag(key: 'sawChallenge' | 'sawCold' | 'summonedAloof' | 'photoSpotlight' | 'lockedOnce' | 'lockedFull', value: boolean): void {
    if (this.yard === null) return
    const flags = { ...this.yard.stats.flags, [key]: value }
    this.yard = { ...this.yard, stats: { ...this.yard.stats, flags } }
    this.evaluate()
  }

  private evaluate(): void {
    if (this.yard === null) return
    const newly = evaluateAchievements(this.yard)
    if (newly.length === 0) return
    this.yard = {
      ...this.yard,
      stats: {
        ...this.yard.stats,
        achievements: [...(this.yard.stats.achievements ?? []), ...newly.map(d => d.id)],
      },
    }
    for (const def of newly) showToast(this.engine.getStageEl(), `🏆 解锁成就：${def.titleZh}`)
    this.scheduleSave()
    this.refreshUi()
  }

  // ---- 明信片（H7） ----

  private checkNewPostcards(): void {
    if (this.yard === null) return
    const seen = new Set(this.yard.postcardSeen ?? [])
    const fresh = this.yard.archive.filter(e => postcardEligible(e.leftAt, Date.now()) && !seen.has(e.id))
    if (fresh.length === 0) return
    for (const e of fresh) seen.add(e.id)
    this.yard = { ...this.yard, postcardSeen: [...seen] }
    showToast(this.engine.getStageEl(), `收到 ${fresh[fresh.length - 1]!.name} 寄来的明信片 📮`)
    this.scheduleSave()
  }

  private openPostcard(petId: string): void {
    if (this.yard === null) return
    const entry = this.yard.archive.find(e => e.id === petId)
    if (entry === undefined || !postcardEligible(entry.leftAt, Date.now())) return
    const style = styleOf(this.yard.settings.artStyle ?? 'geo')
    const box = style.portraitBox
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${style.render(entry.traits, `pc-${entry.id}`)}</svg>`
    openPostcardModal(this.engine.getStageEl(), svg, postcardTextFor(entry.id, entry.name))
  }

  private handleSpawnCheck(now: number): void {
    if (this.yard === null || dueSpawnCount(this.yard, now) === 0) return
    const result = spawnPet(this.yard, now)
    if (result.pet !== null) this.pendingGreet.set(result.pet.id, `你好呀，我是${result.pet.name}！`)
    this.applyResult(result)
  }

  private applyResult(result: SpawnResult): void {
    this.yard = result.yard
    this.engine.syncPets(result.yard.pets)
    if (result.left !== null) this.engine.showBubble(result.left.id, `${result.left.name} 再见啦…`, 2600)
    this.scheduleSave()
    this.refreshUi()
    this.evaluate()
  }

  private handlePetEntered(petId: string): void {
    const greet = this.pendingGreet.get(petId)
    this.pendingGreet.delete(petId)
    this.engine.showBubble(petId, greet ?? '你好呀！')
  }

  private handlePetClick(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    this.engine.poke(petId)
    this.engine.showBubble(petId, pet.traits.species === 'cat' ? '喵～' : '汪！', 1500)
    const pos = this.engine.getPetPos(petId)
    if (pos !== null) this.openMenu(pet, pos)
  }

  private openMenuForPet(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    const pos = this.engine.getPetPos(petId)
    const size = this.engine.getStageSize()
    this.openMenu(pet, pos ?? { x: size.w / 2, y: size.h - 90 })
  }

  private openMenu(pet: Pet, anchor: { readonly x: number; readonly y: number }): void {
    const stage = this.engine.getStageEl()
    openInteractMenu(stage, { id: pet.id, name: pet.name, locked: pet.locked }, anchor, {
      onPet: id => {
        this.engine.performAction(id, 'stretch')
        this.engine.showBubble(id, '好舒服～', 1600)
      },
      onCard: id => this.openCard(id),
      onToggleLock: id => this.toggleLock(id),
      onRename: (id, name) => this.rename(id, name),
      onExport: id => this.exportCard(id),
    })
  }

  private summonPet(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    if (this.engine.summon(petId)) {
      showToast(this.engine.getStageEl(), `点名 ${pet.name} 上台！`)
    } else {
      this.openMenuForPet(petId)
    }
  }

  private toggleLock(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    this.yard = setLocked(this.yard, petId, !pet.locked)
    const pets = this.yard.pets
    if (pets.some(p => p.locked)) this.setFlag('lockedOnce', true)
    if (pets.length >= MAX_PETS && pets.every(p => p.locked)) this.setFlag('lockedFull', true)
    this.engine.syncPets(pets)
    this.scheduleSave()
    showToast(this.engine.getStageEl(), pet.locked ? `${pet.name} 已解锁` : `${pet.name} 已锁定`)
    this.refreshUi()
  }

  private rename(petId: string, name: string): void {
    if (this.yard === null) return
    const next = renamePet(this.yard, petId, name)
    if (next === this.yard) return
    this.yard = next
    this.engine.syncPets(this.yard.pets)
    this.scheduleSave()
    this.refreshUi()
    showToast(this.engine.getStageEl(), `已改名为 ${name}`)
  }

  private openCard(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    openCardModal(this.engine.getStageEl(), cardSvg(pet, this.yard.settings.artStyle), () => this.exportCard(petId))
  }

  private exportCard(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    const stage = this.engine.getStageEl()
    if (pet === undefined) return
    downloadSvgAsPng(cardSvg(pet, this.yard.settings.artStyle), cardFileName(pet))
      .then(() => showToast(stage, '档案卡已导出'))
      .catch(err => showToast(stage, `导出失败：${String(err)}`))
  }

  private openArchiveCard(petId: string): void {
    if (this.yard === null) return
    const entry = this.yard.archive.find(e => e.id === petId)
    if (entry === undefined) return
    const petView: Pet = { ...entry, locked: false }
    const stage = this.engine.getStageEl()
    openCardModal(stage, cardSvg(petView, this.yard.settings.artStyle, { leftAt: entry.leftAt }), () => {
      downloadSvgAsPng(cardSvg(petView, this.yard?.settings.artStyle, { leftAt: entry.leftAt }), cardFileName(petView))
        .then(() => showToast(stage, '档案卡已导出'))
        .catch(err => showToast(stage, `导出失败：${String(err)}`))
    })
  }

  private async takePhoto(): Promise<void> {
    if (this.yard === null || this.photoBusy) return
    if (this.yard.pets.length === 0) {
      showToast(this.engine.getStageEl(), '还没有宝贝可以合影')
      return
    }
    this.photoBusy = true
    const stage = this.engine.getStageEl()
    try {
      const shot = await this.engine.photoSession()
      if (shot === null) return
      const dateText = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')
      const visitText = `第 ${this.yard.stats.visitCount} 次探望`
      const svg = decoratePhotoSvg(shot.svg, shot.w, shot.h, { dateText, visitText })
      await downloadSvgAsPng(svg, `合影_${dateText}_第${this.yard.stats.visitCount}次探望.png`, shot.w, shot.h)
      this.yard = {
        ...this.yard,
        pets: withMoodDelta(this.yard.pets, MOOD_PHOTO_GAIN),
        stats: { ...this.yard.stats, photosTaken: this.yard.stats.photosTaken + 1 },
      }
      this.engine.syncPets(this.yard.pets)
      this.scheduleSave()
      this.refreshUi()
      showToast(stage, '合影已导出')
      this.evaluate()
    } catch (err) {
      showToast(stage, `合影失败：${String(err)}`)
    } finally {
      this.photoBusy = false
    }
  }

  private coldToastOnce(): void {
    if (this.coldToasted) return
    this.coldToasted = true
    showToast(this.engine.getStageEl(), '今天大家都有点懒得营业……')
  }

  private applyInterval(min: number): void {
    if (this.yard === null) return
    this.yard = { ...this.yard, settings: { ...this.yard.settings, spawnIntervalMin: min } }
    this.scheduleSave()
    this.refreshUi()
    showToast(this.engine.getStageEl(), `到访间隔已设为 ${min} 分钟`)
  }

  private applyStyle(id: ArtStyleId): void {
    if (this.yard === null) return
    this.yard = { ...this.yard, settings: { ...this.yard.settings, artStyle: id } }
    this.engine.restyle(id)
    this.scheduleSave()
    this.refreshUi()
    showToast(this.engine.getStageEl(), `已切换为「${styleOf(id).labelZh}」`)
  }

  // ---- debug 调参台 API（与 P4 版相同，略） ----

  forceSpawn(): void {
    if (this.yard === null) return
    const result = spawnPet(this.yard, Date.now())
    if (result.pet !== null) this.pendingGreet.set(result.pet.id, `你好呀，我是${result.pet.name}！`)
    this.applyResult(result)
  }

  timeTravel(): void {
    if (this.yard === null) return
    this.yard = { ...this.yard, lastSpawnAt: this.yard.lastSpawnAt - spawnIntervalMs(this.yard) }
    this.handleSpawnCheck(Date.now())
    this.scheduleSave()
    this.refreshHud()
  }

  loadDemoArchive(): void {
    const now = Date.now()
    let yard = fromDoc(createInitialDoc(now))
    for (let i = 0; i < MAX_PETS; i++) yard = spawnPet(yard, now - (MAX_PETS - i) * 60_000).yard
    this.yard = yard
    this.engine.syncPets(yard.pets)
    this.scheduleSave()
    this.refreshUi()
    this.evaluate()
  }

  loadColdArchive(): void {
    const now = Date.now()
    const yard = fromDoc(createInitialDoc(now))
    const used = new Set<string>()
    const pets: Pet[] = []
    let counter = 1
    while (pets.length < MAX_PETS && counter < 500) {
      const id = formatPetId(counter)
      const derived = derivePet(id, used, 1)
      if (derived.personality === 'aloof' && !used.has(derived.comboKey)) {
        used.add(derived.comboKey)
        pets.push({
          id, name: derived.defaultName, traits: derived.traits, passion: derived.passion,
          arrivedAt: now - (MAX_PETS - pets.length) * 60_000, locked: false, cycle: 1,
        })
      }
      counter++
    }
    this.yard = { ...yard, pets, idCounter: counter, usedCombos: used, stats: { ...yard.stats, metTotal: pets.length } }
    this.engine.syncPets(pets)
    this.scheduleSave()
    this.refreshUi()
    this.evaluate()
  }

  resetArchive(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    localStorage.removeItem(STORAGE_KEY)
    location.reload()
  }

  snapshotState(): void {
    if (this.yard === null) return
    const json = JSON.stringify(toDoc(this.yard), null, 2)
    triggerDownload(new Blob([json], { type: 'application/json' }), `pet-yard-state-${Date.now()}.json`)
  }

  getYard(): Yard | null {
    return this.yard
  }

  private refreshUi(): void {
    if (this.yard === null) return
    this.avatarBar?.refresh(this.yard.pets, this.engine.getHolderId())
    this.panels?.refresh()
    this.refreshHud()
    this.checkPauseToast()
  }

  private checkPauseToast(): void {
    if (this.yard === null) return
    if (isSpawnPaused(this.yard)) {
      if (!this.pauseToasted) {
        this.pauseToasted = true
        showToast(this.engine.getStageEl(), '小院已满，住满都是你锁定的宝贝')
      }
    } else {
      this.pauseToasted = false
    }
  }

  private refreshHud(): void {
    if (this.yard === null) return
    const remaining = Math.max(0, this.yard.lastSpawnAt + spawnIntervalMs(this.yard) - Date.now())
    const mm = Math.floor(remaining / 60_000)
    const ss = Math.floor((remaining % 60_000) / 1000)
    const paused = isSpawnPaused(this.yard) ? ' · 全锁定暂停中' : ''
    const avg = averageMood(this.yard.pets)
    this.engine.setHudText(
      `${TIER_LABEL_ZH[this.engine.getTier()]} · 在场 ${this.yard.pets.length}/${MAX_PETS} · 已相遇 ${this.yard.stats.metTotal}`
      + ` · 心情 ${Math.round(avg)}${MOOD_ZH[moodBandOf(avg)]} · 下次到访 ${mm}:${String(ss).padStart(2, '0')}${paused}`,
    )
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      if (this.yard !== null) saveYard(this.yard)
    }, SAVE_DEBOUNCE_MS)
  }

  private flushSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (this.yard !== null) saveYard(this.yard)
  }
}
```

> 落地注：模板中「debug 调参台 API（与 P4 版相同，略）」段已在上文完整给出（forceSpawn→snapshotState），按上文抄写即可；`personalityOf` 导入若无使用处可删。

**验证**：`npm run typecheck && npm run test && npm run bundle`（109 既有 + mood 5 + postcard 3 + achievements 7 + dayNight 2 + spotlight3 3 = 132）。

---

## 8. CP8 — M3 验收清单

浏览器逐项（`dsh --profile pets --port 3081`；无法自动化项请用户确认）：

1. **心情基础**：HUD 出现「心情 均值+档位」；演示存档 → 合影 → 均值 +15（HUD 即时变化）。
2. **心情动作**：全院心情 ≥80（多次合影叠加）后观察 1 分钟——卖萌动作明显变频繁；夜间时段 sleep 占比上升（可临时把系统时间或用观察记录佐证；逻辑由 pickAction 保证）。
3. **离线衰减**：状态快照改 `lastActiveAt` 为 24 小时前写回 → 刷新 → 均值 −48（钳制下限 0）。
4. **淡定加演**：心情均值 ≥80 + 聚光灯档 → 淡定者也会成为挑战者（console `spotlight:` 日志出现淡定 id；高冷绝不出现）。
5. **昼夜**：根据当前本地时段，场景配色为三段之一（可用状态快照不可行——时段由真实时钟决定；白天/黄昏/夜晚三色由 dayNight.spec 覆盖 + 肉眼确认当前段）。合影导出的 PNG 带当前时段配色。
6. **雨天**：多次刷新面板，约 1/10 次出现斜线雨幕覆盖层（不影响交互）。
7. **明信片**：状态快照把某 archive 条目 `leftAt` 改为 4 天前写回 → 刷新 → toast「收到 X 寄来的明信片」；图鉴该行出现 📮；点行 → 明信片弹窗（迷你立绘 + 确定性文案，「收下了」关闭）；同条目再次刷新不再 toast。
8. **成就-数值类**：重置存档 → 首次打开解锁「初来乍到」；首次到访解锁「初次相遇」；首次合影解锁「全家福」；首次锁定解锁「此心安处」——各一条 🏆 toast。
9. **成就-目睹类**：聚光灯顶替一次 → 「让让我嘛」；冷场一次 → 「今日冷淡」；点名高冷 → 「勉强营业」；聚光灯档合影 → 「挤挤更亲密」；全 5 锁定 → 「五口之家」。
10. **成就面板**：🏆 → 14 项全列（已解锁高亮、未解锁灰显含条件文案）。
11. **P4 遗留**：宽舞台（~1000px）下最远宠物合影不再拍到半路（超时 5s）；缩放跨档时淡定/高冷的 tilt/twitch 肉眼可见（重排延迟 600ms）。
12. **回归**：typecheck + 132/132 全绿；F5 后心情/成就/明信片已看状态保留；console 无红色报错；P4 的 13 项抽查（点名/冷场哈欠/合影/图鉴/暂停优先级）不回归。

---

## 9. 报告模板（`docs/p5-report.md`）

同 P4 格式：检查点结果表（CP1–CP8）／测试统计／M3 验收记录（12 项）／视觉微调记录（H14）／偏差与决策树／报错与处置／遗留问题。

## 10. 决策树

**D1 测试失败 / D2 typecheck**：同 P4 规程（先查笔误；模板矛盾停下记录；禁删断言；不用 `any`）。
**D3 心情不变化**：检查 HUD 均值来源 `averageMood`（缺省 60）；快照中 pets 是否带 mood（旧档无 → 全按 60）；合影增益在导出成功分支。
**D4 昼夜不生效**：inline style 是否写到 sky/grass（CSS 类 fill 被覆盖）；`applyPhase` 只在构造与每 30s 检查时调用——跨时段需等检查周期。
**D5 明信片 📮 不出现**：资格按 `leftAt`（P1 存档迁移的旧条目若无合法 leftAt 被 normalize 过滤）；`data-pc` 在行 button 上。
**D6 成就不解锁**：旗标走 `setFlag`（引擎 onWitness → controller）；数值类直接查 stats；`evaluate` 后必须把 achievements 写回 yard 并保存。
**D7 加演不出现**：均值门槛 ≥80（HUD 显示）；仅聚光灯档；`CALM_MIN=20`（高冷排除）。
**D8 anchor 编辑失配**：`@autodoc` 注释或 P4 执行微调导致锚点漂移 → 以描述的函数/语义定位，代码内容照抄模板；仍无法定位 → 记录并报告。

## 11. 禁止事项

1. 不修改 §0.3-1 列出文件；锚点编辑仅限列出的文件与位置。
2. 不做 P6 选题：宠物间互动、礼物收藏架、点击粒子、音效、宿主侧 domain 存储迁移。
3. 模板池（明信片 8 条）、成就 id/条件、心情常量语义冻结；数值微调仅限 H14 且记录。
4. 不引入新依赖；不注册 `real` 风格。
5. 产品语义两难 → 记录并报告。
