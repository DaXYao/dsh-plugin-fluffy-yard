# P4 执行方案：争宠全量 + 合影 + 图鉴（执行手册）

> 版本：v1.0 · 对应 `docs/implementation-plan.md` 的 P4 阶段（前置：P3 已验收 M1，见 `docs/p3-report.md`；`Settings.artStyle` 为可选字段的 P3 修正以代码为准）
> **执行者须知**：线性执行手册。模板基于当前仓库实际代码；小改动用「精确编辑」，大改动整文件覆写。

---

## 0. 任务说明

### 0.1 目标（= implementation-plan P4 验收门 = 需求 M2）

1. **三档性格档内差异**：拥挤档不热情者边缘安静趴着；狭小档卡位热情者优先死守、不热情者两侧观望徘徊；极小档一只 Q 弹压扁居中 + 其余贴边窥视。
2. **聚光灯全量**：非热情现任被挑战时耸肩平静让位；点名（头像点击上台，高冷慢挪 + "……"）；单热情者周期性下台溜达再杀回马枪；冷场全量（淡定者占台打盹 / 全员边缘趴、哈欠传染、首次轻提示、热情者到场即恢复）。
3. **实时缩放反应全量**：缩小跨越 = 热情惊跳"！" / 淡定抬头 / 高冷抖耳；放大跨越 = 热情转圈欢呼回场、不热情慢回。
4. **合影**：全员召回挤成一团 → 舞台 SVG 快照 + 水印（日期 + 第 N 次探望）→ PNG 导出 → `photosTaken++` → 各回各位。
5. **图鉴**：已离开宠物一览（迷你立绘/名字/№/相遇告别日期/二世标记），点击回看完整档案卡（含告别日期）。
6. **头像条语义变更**（需求 §3.7）：点头像 = 点名上台；点头像上的 ⋯ = 打开互动菜单（非聚光灯档时点头像仍开菜单）。
7. P3 遗留 #2：暂停 toast 优先级（第 5 次锁定时暂停提示可见）。

### 0.2 检查点

| CP | 内容 |
|---|---|
| CP1 | config 追加 + actions/actor 精确编辑（squish/yawn/twitch + pinned） |
| CP2 | spotlight.ts 全量重写（summon/excursion/nap）+ spotlight2.spec |
| CP3 | lineup.ts 纯函数（档位站位策略）+ lineup.spec |
| CP4 | engine.ts 全量重写（档内差异/极小档/点名/溜达/哈欠/冷场占台/缩放反应/合影编排） |
| CP5 | render/photoExport.ts + photoExport.spec；cardRender 扩展（告别日期）+ cardRender2.spec |
| CP6 | ui/avatarBar.ts、ui/panels.ts 重写（点名/⋯/📷/📖） |
| CP7 | yardController.ts 最终重写 + 构建 |
| CP8 | M2 验收 + 全量回归 |

### 0.3 执行规则

1. 工作目录 `E:/dsh-plugin-pet`。**不修改**：`docs/` 既有文档（报告写 `docs/p4-report.md`）、`package.json`、`tsdown.config.ts`、`cordis.patch.yml`、`src/index.ts`、`src/client/index.ts`、`locales.ts`、`pngExport.ts`、`persist.ts`、`PetYardView.tsx`、`render/palette.ts`、`parts.ts`、`petSprite.ts`、`styles.ts`、`labels.ts`、`stage/svgDom.ts`、`stage/tiers.ts`、`ui/interactMenu.ts`、`ui/toast.ts`、`src/core/` 全部、`tests/` 全部既有测试。
2. **允许修改**：`src/config.ts`（只追加 CP1 常量）；`stage/actions.ts`、`stage/actor.ts`（CP1 精确编辑）；`stage/spotlight.ts`、`stage/engine.ts`、`render/cardRender.ts`、`ui/avatarBar.ts`、`ui/panels.ts`、`yardController.ts`（整文件覆写）；新建 `stage/lineup.ts`、`render/photoExport.ts` 与新测试。
3. 模板原样落地；偏离走 §12 决策树并记录。测试即验收。每 CP 后 `npm run typecheck`。中文注释保留。

---

## 1. 设计决策速查（P4 法典）

| # | 决策 |
|---|---|
| G1 | **档位序**（缩放方向判定）：`tiny(0) < spotlight(1) < narrow(2) < crowded(3) < roomy(4)`；跨越时 `rank` 降 = 缩小反应，升 = 放大反应。 |
| G2 | **拥挤档**：格位按到场时间分配（P3 不变）；溢出的热情者自由 + 周期冲挤（P3 dash 保留）；溢出的**不热情者 pinned 为 `sit`**（安静趴着看风景）。 |
| G3 | **狭小档**：卡位按「热情优先（passion≥60 先），再按到场时间」分配（死守 = 占位即保持）；溢出热情者冲挤抢位；溢出不热情者**不 pin**（两侧观望徘徊 = 自由游走）。 |
| G4 | **极小档**：到场最早的一只居中 **pinned `squish`**（Q 弹压扁）；其余左右交替贴边（x=16 起）**pinned `sit`**（只露半张脸/眼睛窥视）。 |
| G5 | **pinned 机制**：`actor.setPinned(action|null)`——pinned 时 `scheduleNext` 恒重播该动作（不游走）；引擎在 `assignSlots` 里统一设置/清除；移动指令不受影响。 |
| G6 | **非热情现任让位**：挑战/点名顶替时，现任为热情 → roll +「哇！」；为淡定/高冷 → `tilt`（耸肩）+ 无气泡，平静走向边缘。 |
| G7 | **点名**：`engine.summon(petId)` 仅聚光灯档生效；无视性格上台顶替现任；高冷者头顶「……」；上台后仅热情者臭美（jump「看我！」），淡定/高冷安静站定。非聚光灯档点头像 → 回退打开互动菜单。 |
| G8 | **单热情者溜达**：无其他热情者时到期**每第 2 次**触发一次 `excursion`（确定性，可测）——现任走向台侧游荡点，约 2.6s 后返回中央并臭美（回马枪）。 |
| G9 | **冷场全量**：无热情者时若有淡定者（20–59）→ 到场最早的淡定者**占台打盹**（pinned `sleep`，`nap` 事件每次换 occupant 发一次）；其余全员贴边 pinned `sit`；每 8–14s 一轮**哈欠传染**（按到场顺序逐只 `yawn`，间隔 0.9s）；进入冷场发一次 `vacant` 事件 → controller toast「今天大家都有点懒得营业……」（每会话一次）；热情者到场 → 正常任命立即恢复。 |
| G10 | **缩放反应**：缩小跨越 → 热情 `poke` + 气泡「！」(1.2s) / 淡定 `tilt` / 高冷 `twitch`；放大跨越 → 热情 `spin`（欢呼）随即走位回场，其余自然走回。 |
| G11 | **合影**：`engine.photoSession()`（async）——全员（含贴边者）directed 召回中央**挤成一团**（相邻间距 34px，小于身宽 → 重叠）；全部到位或 3s 超时后再稳定 0.8s；快照 = 舞台 SVG 克隆（去气泡/ZZZ + 内嵌必需 CSS + 水印角标：日期 + 第 N 次探望，右下角）；随后 `assignSlots()` 各回各位。`photosTaken++` 只在导出成功后。 |
| G12 | **图鉴**：倒序（最近离开在前）；行 = 迷你立绘 + 名字 + № + 相遇/告别日期 + 二世⭐；点击 → 档案卡弹窗（含「告别于」）；空态文案「还没有告别的宝贝」。 |
| G13 | **暂停 toast 优先**：动作 toast 先弹、`refreshUi()`（内含暂停检查）后行——第 5 次锁定时暂停提示覆盖锁定提示（后显示者胜）。 |
| G14 | 合影文件名中的日期 `/` 替换为 `-`（Windows 文件名合法）。允许微调（记录）：squish/yawn/twitch keyframes、挤团间距、水印样式、哈欠节奏。不可改：G1–G13 规则、档位/轮换常量语义。 |

---

## 2. CP1 — 常量、动作与 pinned

**`src/config.ts` 追加**：

```ts
/** 合影：全部到位后的稳定等待（ms，implementation-plan §6）。 */
export const PHOTO_SETTLE_MS = 800

/** 合影：召回移动的超时上限（ms）。 */
export const PHOTO_TIMEOUT_MS = 3000
```

**`src/client/stage/actions.ts` 精确编辑三处**：

① `ActionName` 联合末尾 `| 'tilt'` 后追加 ` | 'squish' | 'yawn' | 'twitch'`（`ScheduledAction` 不动——三者均为引擎指令）。

② `ACTION_DURATION` 对象末尾（`tilt` 行后）追加：

```ts
  squish: [2200, 2200],
  yawn: [1200, 1200],
  twitch: [500, 500],
```

③ `STAGE_CSS` 中 `.py-tilt { ... }` 行后追加三行 class，`@keyframes py-tilt { ... }` 行后追加三段 keyframes，`.py-avatar .mark { ... }` 行后追加 `.py-avatar-more`：

```css
.py-squish { animation: py-squish 1.1s ease-in-out infinite; }
.py-yawn { animation: py-yawn 1.2s ease-in-out; }
.py-twitch { animation: py-twitch 0.5s ease-in-out; }
@keyframes py-squish { 0%, 100% { transform: scale(1.35, 0.55); } 50% { transform: scale(1.22, 0.63); } }
@keyframes py-yawn { 0%, 100% { transform: scale(1); } 45% { transform: scale(1.06, 0.9) translateY(2px); } }
@keyframes py-twitch { 0%, 100% { transform: rotate(0deg); } 30% { transform: rotate(3deg); } 60% { transform: rotate(-3deg); } }
.py-avatar-more { position: absolute; right: -2px; bottom: -2px; width: 17px; height: 17px; border-radius: 50%; border: 1px solid #c9b8a5; background: #fffdf8; font-size: 10px; line-height: 1; cursor: pointer; padding: 0; color: #6b5b4d; }
```

**`src/client/stage/actor.ts` 精确编辑两处**：

① 字段 `private directed = false` 后追加一行：

```ts
  private pinnedAction: ActionName | null = null
```

② 方法 `isDone()` 前插入：

```ts
  /** 引擎指令：固定形态（sit/squish/sleep 等，G5）；null 恢复自由调度。 */
  setPinned(action: ActionName | null): void {
    this.pinnedAction = action
  }

```

③ `scheduleNext()` 首行（`const next = pickAction(...)` 之前）插入：

```ts
    if (this.pinnedAction !== null) {
      this.playAction(this.pinnedAction)
      return
    }
```

**验证**：`npm run typecheck`（新动作为联合超集，兼容）。

---

## 3. CP2 — 聚光灯状态机全量

**`src/client/stage/spotlight.ts`**（**整文件覆写**）：

```ts
import type { Tier } from './tiers.ts'

/** 聚光灯决策所需的最小宠物切片（M8/G6–G9）。 */
export interface SpotlightPet {
  readonly id: string
  readonly passion: number
  readonly locked: boolean
  readonly arrivedAt: number
}

export type SpotlightEvent =
  | { readonly type: 'appoint'; readonly petId: string }
  | { readonly type: 'vacant' }
  | { readonly type: 'nap'; readonly petId: string }
  | { readonly type: 'challenge'; readonly challengerId: string; readonly previousHolderId: string }
  | { readonly type: 'excursion'; readonly petId: string }

export interface SpotlightOptions {
  readonly rotateMs: number
  readonly rotateLockedMs: number
}

const EAGER_PASSION = 60
const CALM_MIN = 20

/**
 * 聚光灯轮换状态机（纯逻辑）：只在 spotlight 档活动。
 * 持有者必须热情（点名除外——summon 可任命任意宠物，G7）；
 * 无热情者 → 冷场：淡定者占台打盹（nap）或舞台空置（vacant，各发一次）；
 * 无其他热情者时到期每第 2 次 → excursion（G8）。
 */
export class SpotlightMachine {
  private holderId: string | null = null
  private endsAt = 0
  private coldAnnounced = false
  private napperId: string | null = null
  private noChallengerExpiries = 0

  constructor(private readonly opts: SpotlightOptions) {}

  getHolder(): string | null {
    return this.holderId
  }

  getNapper(): string | null {
    return this.napperId
  }

  /** 引擎每帧调用；事件由引擎编排动画。 */
  tick(pets: readonly SpotlightPet[], tier: Tier, now: number): readonly SpotlightEvent[] {
    if (tier !== 'spotlight') {
      this.holderId = null
      this.napperId = null
      this.coldAnnounced = false
      this.noChallengerExpiries = 0
      return []
    }
    if (this.holderId !== null && !pets.some(p => p.id === this.holderId)) this.holderId = null
    if (this.napperId !== null && !pets.some(p => p.id === this.napperId)) this.napperId = null

    if (this.holderId === null) {
      const events: SpotlightEvent[] = []
      const eager = pets.filter(p => p.passion >= EAGER_PASSION)
      if (eager.length > 0) {
        // 好戏恢复（G9）：热情者到场即上台
        const candidate = eager.slice().sort((a, b) => a.arrivedAt - b.arrivedAt)[0]!
        this.holderId = candidate.id
        this.endsAt = now + this.durationOf(candidate)
        this.napperId = null
        this.coldAnnounced = false
        this.noChallengerExpiries = 0
        return [{ type: 'appoint', petId: candidate.id }]
      }
      // 冷场：淡定者占台打盹（G9）
      const calm = pets.filter(p => p.passion >= CALM_MIN && p.passion < EAGER_PASSION)
      const napper = calm.slice().sort((a, b) => a.arrivedAt - b.arrivedAt)[0]
      if (!this.coldAnnounced) {
        this.coldAnnounced = true
        events.push({ type: 'vacant' })
      }
      if (napper !== undefined && this.napperId !== napper.id) {
        this.napperId = napper.id
        events.push({ type: 'nap', petId: napper.id })
      }
      return events
    }

    if (now < this.endsAt) return []
    const holder = pets.find(p => p.id === this.holderId) ?? null
    const challengers = pets.filter(p => p.passion >= EAGER_PASSION && p.id !== this.holderId)
    if (challengers.length === 0) {
      this.noChallengerExpiries++
      this.endsAt = now + this.durationOf(holder)
      if (this.noChallengerExpiries % 2 === 0) {
        return [{ type: 'excursion', petId: this.holderId }]
      }
      return []
    }
    const challenger = challengers[Math.floor(Math.random() * challengers.length)]!
    return [this.replaceHolder(challenger, now)]
  }

  /** 点名（G7）：任意宠物立即上台顶替现任；非聚光灯档返回空。 */
  summon(petId: string, pets: readonly SpotlightPet[], tier: Tier, now: number): readonly SpotlightEvent[] {
    if (tier !== 'spotlight') return []
    const pet = pets.find(p => p.id === petId)
    if (pet === undefined) return []
    if (petId === this.holderId) return []
    this.napperId = null
    this.coldAnnounced = false
    return [this.replaceHolder(pet, now)]
  }

  private replaceHolder(next: SpotlightPet, now: number): SpotlightEvent {
    const previousHolderId = this.holderId
    this.holderId = next.id
    this.endsAt = now + this.durationOf(next)
    this.noChallengerExpiries = 0
    return { type: 'challenge', challengerId: next.id, previousHolderId: previousHolderId ?? next.id }
  }

  private durationOf(pet: SpotlightPet): number {
    return pet.locked ? this.opts.rotateLockedMs : this.opts.rotateMs
  }
}
```

**`tests/spotlight2.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { SpotlightMachine, type SpotlightPet } from '../src/client/stage/spotlight.ts'

const OPTS = { rotateMs: 15_000, rotateLockedMs: 30_000 }
const T0 = 1_000_000

function petOf(id: string, passion: number, locked = false, arrivedAt = 0): SpotlightPet {
  return { id, passion, locked, arrivedAt }
}

describe('聚光灯全量（G6–G9）', () => {
  it('summon：任意性格可上台顶替，时长按锁定', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 30, false, 20)]
    m.tick(pets, 'spotlight', T0)
    const ev = m.summon('b', pets, 'spotlight', T0 + 100)
    expect(ev).toEqual([{ type: 'challenge', challengerId: 'b', previousHolderId: 'a' }])
    expect(m.getHolder()).toBe('b')
    expect(m.tick(pets, 'spotlight', T0 + 100 + 14_999)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 100 + 15_000).length).toBeGreaterThan(0)
  })

  it('summon：点名现任自己/非聚光灯档 → 无事件', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90)]
    m.tick(pets, 'spotlight', T0)
    expect(m.summon('a', pets, 'spotlight', T0 + 1)).toEqual([])
    expect(m.summon('a', pets, 'roomy', T0 + 1)).toEqual([])
  })

  it('单热情者：到期第 2 次触发 excursion', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 30)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 30_000)).toEqual([{ type: 'excursion', petId: 'a' }])
    expect(m.getHolder()).toBe('a')
  })

  it('冷场：vacant 与 nap 各发一次，occupant 稳定', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 10, false, 30), petOf('b', 40, false, 10), petOf('c', 50, false, 20)]
    const first = m.tick(pets, 'spotlight', T0)
    expect(first).toEqual([{ type: 'vacant' }, { type: 'nap', petId: 'b' }])
    expect(m.getNapper()).toBe('b')
    expect(m.tick(pets, 'spotlight', T0 + 9999)).toEqual([])
  })

  it('冷场：全高冷（无淡定者）只发 vacant', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 10), petOf('b', 5)]
    expect(m.tick(pets, 'spotlight', T0)).toEqual([{ type: 'vacant' }])
    expect(m.getNapper()).toBeNull()
  })

  it('热情者到场，好戏立即恢复并清冷场', () => {
    const m = new SpotlightMachine(OPTS)
    const cold = [petOf('a', 40)]
    m.tick(cold, 'spotlight', T0)
    const pets = [petOf('a', 40, false, 10), petOf('e', 70, false, 20)]
    expect(m.tick(pets, 'spotlight', T0 + 100)).toEqual([{ type: 'appoint', petId: 'e' }])
    expect(m.getNapper()).toBeNull()
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/spotlight.spec.ts tests/spotlight2.spec.ts`（既有 8 用例 + 新 6 用例全绿）。

---

## 4. CP3 — 站位策略纯函数

**`src/client/stage/lineup.ts`**（新建，整文件）：

```ts
import type { Tier } from './tiers.ts'

export interface LineupPet {
  readonly id: string
  readonly passion: number
  readonly arrivedAt: number
}

export interface Lineup {
  /** 占格位者的 id（按站位顺序）。 */
  readonly slotIds: readonly string[]
  /** 溢出贴边者的 id。 */
  readonly overflowIds: readonly string[]
}

/**
 * 拥挤/狭小档的格位分配（G2/G3）：
 * 拥挤 = 按到场时间；狭小 = 热情优先再按到场时间（卡位死守）。
 * slots ≥ 数量或 0 → 全员占位（宽裕/极小的站位由引擎另行处理）。
 */
export function lineupFor(tier: Tier, pets: readonly LineupPet[], slots: number): Lineup {
  const byArrival = pets.slice().sort((a, b) => a.arrivedAt - b.arrivedAt)
  if (slots <= 0 || slots >= pets.length) {
    return { slotIds: byArrival.map(p => p.id), overflowIds: [] }
  }
  const ordered = tier === 'narrow'
    ? pets.slice().sort((a, b) => {
        const eagerDiff = (Number(b.passion >= 60) - Number(a.passion >= 60))
        return eagerDiff !== 0 ? eagerDiff : a.arrivedAt - b.arrivedAt
      })
    : byArrival
  return {
    slotIds: ordered.slice(0, slots).map(p => p.id),
    overflowIds: ordered.slice(slots).map(p => p.id),
  }
}
```

**`tests/lineup.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { lineupFor, type LineupPet } from '../src/client/stage/lineup.ts'

const PETS: LineupPet[] = [
  { id: 'a', passion: 30, arrivedAt: 10 },
  { id: 'b', passion: 90, arrivedAt: 20 },
  { id: 'c', passion: 10, arrivedAt: 30 },
  { id: 'e', passion: 70, arrivedAt: 40 },
]

describe('格位分配（G2/G3）', () => {
  it('拥挤：纯到场时间', () => {
    const r = lineupFor('crowded', PETS, 2)
    expect(r.slotIds).toEqual(['a', 'b'])
    expect(r.overflowIds).toEqual(['c', 'e'])
  })
  it('狭小：热情优先，再到场时间', () => {
    const r = lineupFor('narrow', PETS, 2)
    expect(r.slotIds).toEqual(['b', 'e'])
    expect(r.overflowIds).toEqual(['a', 'c'])
  })
  it('slots ≥ 数量 → 全员占位', () => {
    const r = lineupFor('narrow', PETS, 4)
    expect(r.slotIds).toEqual(['a', 'b', 'c', 'e'])
    expect(r.overflowIds).toEqual([])
  })
  it('空场安全', () => {
    expect(lineupFor('crowded', [], 3)).toEqual({ slotIds: [], overflowIds: [] })
  })
})
```

**验证**：`npx vitest run tests/lineup.spec.ts` 全绿。

---

## 5. CP5 — 合影快照与档案卡告别日期

**`src/client/render/photoExport.ts`**（新建，整文件）：

```ts
/** 快照内嵌 CSS：独立 SVG 失去页面样式，必需类内嵌（G11）。 */
const PHOTO_CSS = `
.py-sky { fill: #dcecf5; } .py-grass { fill: #c4e0b8; }
.py-name { font-size: 11px; fill: #5a4f44; text-anchor: middle; paint-order: stroke; stroke: rgba(255,255,255,0.8); stroke-width: 3px; }
.py-badge { font-size: 13px; text-anchor: middle; }
`

export interface PhotoWatermark {
  readonly dateText: string
  readonly visitText: string
}

/** 序列化舞台 SVG（裸快照，无任何装饰；装饰由 controller 一次性完成，G11）。 */
export function serializeStageSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  return new XMLSerializer().serializeToString(clone)
}

/**
 * 装饰合影快照（纯字符串操作，可单测）：去除气泡/ZZZ、注入必需 CSS、
 * 设定画布尺寸、追加右下角水印（G11/G14）。
 */
export function decoratePhotoSvg(
  svgText: string,
  w: number,
  h: number,
  mark: PhotoWatermark,
): string {
  let text = svgText
  text = text.replace(/<g class="py-bubble-anchor"[\s\S]*?<\/g><\/g>/g, '')
  text = text.replace(/<text class="py-zzz"[\s\S]*?<\/text>/g, '')
  const style = `<style>${PHOTO_CSS}</style>`
  const mw = 26 + Math.max(mark.dateText.length, mark.visitText.length) * 8.5
  const watermark = `<g>`
    + `<rect x="${Math.round(w - mw - 14)}" y="${h - 52}" width="${Math.round(mw)}" height="40" rx="10" fill="rgba(74,63,53,0.82)"/>`
    + `<text x="${Math.round(w - mw / 2 - 14)}" y="${h - 34}" font-family="sans-serif" font-size="13" fill="#fff" text-anchor="middle">${mark.visitText}</text>`
    + `<text x="${Math.round(w - mw / 2 - 14)}" y="${h - 19}" font-family="sans-serif" font-size="11" fill="rgba(255,255,255,0.85)" text-anchor="middle">${mark.dateText}</text>`
    + `</g>`
  return text
    .replace(/<svg([^>]*?)>/, (_m, attrs: string) =>
      `<svg${attrs} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${style}`)
    .replace(/<\/svg>\s*$/, `${watermark}</svg>`)
}
```

> 本文件零 import（`SVGSVGElement` 用全局 DOM 类型）。

**`tests/photoExport.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { decoratePhotoSvg } from '../src/client/render/photoExport.ts'

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg"><rect class="py-sky"/><g class="py-pet"><g class="py-facing"><g class="py-action py-idle"><g class="py-sprite"></g></g></g><text class="py-name">汤圆</text><g class="py-bubble-anchor"><g class="py-bubble"><rect class="py-bubble-bg"/><text class="py-bubble-text">喵</text></g></g><text class="py-zzz">Z z z</text></g></svg>`

describe('合影快照装饰（G11）', () => {
  it('去除气泡与 ZZZ、注入样式与尺寸', () => {
    const out = decoratePhotoSvg(SAMPLE, 800, 400, { dateText: '2026-8-30', visitText: '第 37 次探望' })
    expect(out).not.toContain('py-bubble')
    expect(out).not.toContain('py-zzz')
    expect(out).toContain('<style>')
    expect(out).toContain('width="800"')
    expect(out).toContain('viewBox="0 0 800 400"')
    expect(out).toContain('py-sprite')
    expect(out).toContain('汤圆')
  })
  it('水印含日期与第 N 次探望', () => {
    const out = decoratePhotoSvg(SAMPLE, 800, 400, { dateText: '2026-8-30', visitText: '第 37 次探望' })
    expect(out).toContain('第 37 次探望')
    expect(out).toContain('2026-8-30')
  })
})
```

**`src/client/render/cardRender.ts`**（**整文件覆写**；唯一变化 = 第三参 `opts?: { leftAt?: number }`，有告别时间时页脚合并显示，G12）：

```ts
import type { ArtStyleId, Pet } from '../../core/types.ts'
import { personalityOf } from '../../core/traits.ts'
import { BODY_ZH, EYES_ZH, PATTERN_ZH, PERSONALITY_ZH, SPECIES_ZH, traitTags } from './labels.ts'
import { styleOf } from './styles.ts'

export const CARD_W = 540
export const CARD_H = 720
const PORTRAIT_SCALE = 2.4
const PORTRAIT_FOOT_Y = 520

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 宠物档案卡 SVG（M7/G12）；opts.leftAt 存在时（图鉴回看）页脚附告别日期。 */
export function cardSvg(pet: Pet, artStyle: ArtStyleId | undefined, opts: { readonly leftAt?: number } = {}): string {
  const style = styleOf(artStyle ?? 'geo')
  const no = pet.id.slice(2)
  const tags = traitTags(pet.traits).join(' · ')
  const detail = [
    SPECIES_ZH[pet.traits.species], BODY_ZH[pet.traits.body],
    PATTERN_ZH[pet.traits.pattern], EYES_ZH[pet.traits.eyes],
  ].join(' · ')
  const date = new Date(pet.arrivedAt).toLocaleDateString('zh-CN')
  const personality = PERSONALITY_ZH[personalityOf(pet.passion)]
  const cycleMark = pet.cycle >= 2 ? ' ⭐二世' : ''
  const farewell = opts.leftAt === undefined ? '' : ` · 告别于 ${new Date(opts.leftAt).toLocaleDateString('zh-CN')}`
  const cx = CARD_W / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">`
    + `<rect width="${CARD_W}" height="${CARD_H}" rx="24" fill="#fdf6ec"/>`
    + `<rect x="18" y="18" width="${CARD_W - 36}" height="${CARD_H - 36}" rx="16" fill="#fffdf8" stroke="#e5d9c9" stroke-width="2"/>`
    + `<text x="${cx}" y="110" font-family="sans-serif" font-size="44" fill="#4a3f35" text-anchor="middle">${esc(pet.name)}</text>`
    + `<text x="${cx}" y="152" font-family="sans-serif" font-size="20" fill="#a89880" text-anchor="middle">№${no}${cycleMark}</text>`
    + `<g transform="translate(${cx}, ${PORTRAIT_FOOT_Y}) scale(${PORTRAIT_SCALE})">${style.render(pet.traits, `card-${pet.id}`)}</g>`
    + `<text x="${cx}" y="575" font-family="sans-serif" font-size="24" fill="#6b5b4d" text-anchor="middle">${esc(tags)}</text>`
    + `<text x="${cx}" y="610" font-family="sans-serif" font-size="16" fill="#a89880" text-anchor="middle">${esc(detail)}</text>`
    + `<text x="${cx}" y="650" font-family="sans-serif" font-size="20" fill="#4a3f35" text-anchor="middle">性格 · ${personality}</text>`
    + `<text x="${cx}" y="682" font-family="sans-serif" font-size="15" fill="#a89880" text-anchor="middle">相遇于 ${date}${farewell} · ${style.labelZh} · 毛茸茸小院</text>`
    + `</svg>`
}

export function cardFileName(pet: Pet): string {
  return `档案卡_№${pet.id.slice(2)}_${pet.name}.png`
}
```

**`tests/cardRender2.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { cardSvg } from '../src/client/render/cardRender.ts'
import type { Pet } from '../src/core/types.ts'

const ARRIVED = new Date(2026, 7, 15, 10).getTime()
const LEFT = new Date(2026, 7, 28, 9).getTime()
const PET: Pet = {
  id: 'p_000009', name: '煤球',
  traits: { species: 'dog', body: 'large', ears: 'droop', fur: 'black', pattern: 'solid', tail: 'curl', eyes: 'amber', accessory: 'none' },
  passion: 10, arrivedAt: ARRIVED, locked: false, cycle: 2,
}

describe('档案卡告别日期（G12）', () => {
  it('无 leftAt：不含告别于（二世标记仍生效）', () => {
    const svg = cardSvg(PET, 'geo')
    expect(svg).not.toContain('告别于')
    expect(svg).toContain('二世')
  })
  it('有 leftAt：页脚含相遇与告别日期', () => {
    const svg = cardSvg(PET, 'geo', { leftAt: LEFT })
    expect(svg).toContain('告别于')
    expect(svg).toContain(new Date(ARRIVED).toLocaleDateString('zh-CN'))
    expect(svg).toContain(new Date(LEFT).toLocaleDateString('zh-CN'))
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/photoExport.spec.ts tests/cardRender2.spec.ts tests/cardRender.spec.ts`（既有 cardRender 4 用例不回归）。

---

## 6. CP4 — 引擎全量重写

**`src/client/stage/engine.ts`**（**整文件覆写**；在 P3 版之上新增 G1–G11 全部编排——变更清单见文件尾注释）：

```ts
import { FLATTEN_H, PHOTO_SETTLE_MS, PHOTO_TIMEOUT_MS, ROTATE_LOCKED_MS, ROTATE_MS, SPAWN_CHECK_MS } from '../../config.ts'
import { personalityOf } from '../../core/traits.ts'
import type { ArtStyleId, Pet } from '../../core/types.ts'
import { serializeStageSvg } from '../render/photoExport.ts'
import { styleOf } from '../render/styles.ts'
import { ensureStageStyles, type ActionName } from './actions.ts'
import { PetActor, type ActorContext } from './actor.ts'
import { lineupFor } from './lineup.ts'
import { SpotlightMachine, type SpotlightEvent } from './spotlight.ts'
import { svgEl } from './svgDom.ts'
import { computeTier, slotsFor, type Tier } from './tiers.ts'

export interface EngineOptions {
  readonly onPetClick?: (petId: string) => void
  readonly onPetEntered?: (petId: string) => void
  readonly onSpawnCheck?: (now: number) => void
  readonly onTierChanged?: (tier: Tier, prev: Tier) => void
  readonly onHolderChanged?: (petId: string | null) => void
  /** 进入冷场（每会话可能多次，由 controller 决定提示频次，G9）。 */
  readonly onColdStart?: () => void
}

const MARGIN = 70
const EDGE_X = 22
const EDGE_GAP = 30
/** 极小档贴边（露出双眼，G4）。 */
const TINY_EDGE_X = 16
/** 合影挤团间距（小于身宽 → 重叠，G11）。 */
const HUDDLE_GAP = 34
/** 档位序（G1）。 */
const TIER_RANK: Record<Tier, number> = { tiny: 0, spotlight: 1, narrow: 2, crowded: 3, roomy: 4 }

export class StageEngine {
  private readonly stageDiv: HTMLDivElement
  private readonly svg: SVGSVGElement
  private readonly grass: SVGRectElement
  private readonly hud: HTMLDivElement
  private actors: PetActor[] = []
  private raf = 0
  private lastT = 0
  private w = 0
  private h = 0
  private groundY = 0
  private tier: Tier = 'roomy'
  private flatten = false
  private sizeDirty = true
  private checkAcc = 0
  private ro: ResizeObserver | null = null
  private readonly spotlight = new SpotlightMachine({ rotateMs: ROTATE_MS, rotateLockedMs: ROTATE_LOCKED_MS })
  private styleId: ArtStyleId = 'geo'
  private readonly overflowIds = new Set<string>()
  private readonly dashNext = new Map<string, number>()
  private readonly dashing = new Set<string>()
  private readonly strutPending = new Set<string>()
  /** 单热情者溜达的回场时刻（G8）。 */
  private excursionReturnAt = 0
  private excursionActorId: string | null = null
  /** 冷场哈欠波（G9）。 */
  private yawnNextAt = 0
  /** 合影进行中（G11）。 */
  private photoActive = false

  constructor(container: HTMLElement, private readonly opts: EngineOptions = {}) {
    ensureStageStyles()
    this.stageDiv = document.createElement('div')
    this.stageDiv.className = 'py-stage'
    this.svg = svgEl('svg')
    const sky = svgEl('rect', { class: 'py-sky', x: 0, y: 0, width: '100%', height: '100%' })
    this.grass = svgEl('rect', { class: 'py-grass', x: 0, width: '100%' })
    this.svg.append(sky, this.grass)
    this.hud = document.createElement('div')
    this.hud.className = 'py-hud'
    this.stageDiv.append(this.svg, this.hud)
    container.appendChild(this.stageDiv)
  }

  start(): void {
    this.ro = new ResizeObserver(() => { this.sizeDirty = true })
    this.ro.observe(this.stageDiv)
    this.relayout()
    this.lastT = performance.now()
    const loop = (t: number): void => {
      const dt = Math.min(100, Math.max(0, t - this.lastT))
      this.lastT = t
      if (this.sizeDirty) {
        this.sizeDirty = false
        this.relayout()
      }
      const ctx: ActorContext = { width: this.w, groundY: this.groundY, flatten: this.flatten }
      if (!this.photoActive) {
        for (const actor of this.actors) actor.update(dt, ctx)
      }
      this.actors = this.actors.filter(actor => {
        if (!actor.isDone()) return true
        actor.root.remove()
        return false
      })
      if (!this.photoActive) {
        this.runSpotlight()
        this.updateStrut()
        this.updateDash()
        this.updateExcursion()
        this.updateYawnWave()
      }
      this.checkAcc += dt
      if (this.checkAcc >= SPAWN_CHECK_MS) {
        this.checkAcc = 0
        this.opts.onSpawnCheck?.(Date.now())
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    this.stageDiv.remove()
    this.actors = []
  }

  getTier(): Tier {
    return this.tier
  }

  getStageEl(): HTMLElement {
    return this.stageDiv
  }

  getStageSize(): { readonly w: number; readonly h: number } {
    return { w: this.w, h: this.h }
  }

  getHolderId(): string | null {
    return this.spotlight.getHolder()
  }

  getPetPos(petId: string): { readonly x: number; readonly y: number } | null {
    const actor = this.actors.find(a => a.pet.id === petId)
    if (actor === undefined || actor.isExiting()) return null
    return { x: actor.getX(), y: this.groundY - 105 }
  }

  setHudText(text: string): void {
    this.hud.textContent = text
  }

  showBubble(petId: string, text: string, ms?: number): void {
    this.actors.find(actor => actor.pet.id === petId)?.showBubble(text, ms)
  }

  poke(petId: string): void {
    this.actors.find(actor => actor.pet.id === petId)?.poke()
  }

  performAction(petId: string, name: ActionName): void {
    this.actors.find(actor => actor.pet.id === petId)?.performAction(name)
  }

  restyle(styleId: ArtStyleId): void {
    this.styleId = styleId
    const style = styleOf(styleId)
    for (const actor of this.actors) actor.setSpriteMarkup(style.render(actor.pet.traits, actor.pet.id))
  }

  setDebugSize(w: number | null, h: number | null): void {
    this.stageDiv.style.width = w === null ? '100%' : `${w}px`
    this.stageDiv.style.height = h === null ? '100%' : `${h}px`
  }

  /** 点名（G7）：仅聚光灯档；返回是否生效。 */
  summon(petId: string): boolean {
    if (this.tier !== 'spotlight') return false
    const pets = this.actors.filter(a => !a.isExiting()).map(a => a.pet)
    const events = this.spotlight.summon(petId, pets, this.tier, Date.now())
    if (events.length === 0) return false
    const before = this.spotlight.getHolder()
    for (const ev of events) this.applySpotlightEvent(ev)
    if (this.spotlight.getHolder() !== before) {
      this.refreshBadges()
      this.opts.onHolderChanged?.(this.spotlight.getHolder())
    }
    return true
  }

  /**
   * 合影（G11）：召回挤团 → 稳定 → 快照 SVG → 各回各位。
   * 返回 null = 进行中或场上无宠物。
   */
  async photoSession(): Promise<{ readonly svg: string; readonly w: number; readonly h: number } | null> {
    const active = this.actors.filter(a => !a.isExiting())
    if (this.photoActive || active.length === 0) return null
    this.photoActive = true
    const sorted = active.slice().sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    const cx = this.w / 2
    sorted.forEach((actor, index) => {
      actor.setPinned(null)
      actor.setTarget(cx + (index - (sorted.length - 1) / 2) * HUDDLE_GAP, true)
    })
    const deadline = Date.now() + PHOTO_TIMEOUT_MS
    await new Promise<void>(resolve => {
      const poll = window.setInterval(() => {
        const allArrived = this.actors
          .filter(a => !a.isExiting())
          .every(a => a.atTarget())
        if (allArrived || Date.now() >= deadline) {
          window.clearInterval(poll)
          window.setTimeout(resolve, PHOTO_SETTLE_MS)
        }
      }, 100)
    })
    const svg = serializeStageSvg(this.svg)
    this.photoActive = false
    this.assignSlots()
    return { svg, w: Math.round(this.w), h: Math.round(this.h) }
  }

  syncPets(pets: readonly Pet[], options: { initial?: boolean } = {}): void {
    const ids = new Set(pets.map(p => p.id))
    for (const actor of this.actors) {
      if (!ids.has(actor.pet.id)) actor.beginExit()
    }
    pets.forEach((pet, index) => {
      const existing = this.actors.find(actor => actor.pet.id === pet.id)
      if (existing !== undefined) {
        existing.updatePet(pet)
        return
      }
      const slot = this.slotX(index, pets.length)
      const startX = options.initial === true
        ? slot
        : (Math.random() < 0.5 ? -MARGIN : this.w + MARGIN)
      const actor = new PetActor(pet, startX, options.initial === true)
      actor.setSpriteMarkup(styleOf(this.styleId).render(pet.traits, pet.id))
      actor.root.addEventListener('click', () => this.opts.onPetClick?.(pet.id))
      actor.setTarget(slot, true)
      this.actors.push(actor)
      this.svg.appendChild(actor.root)
      if (options.initial !== true) this.opts.onPetEntered?.(pet.id)
    })
    this.assignSlots()
    this.evalTier()
    this.refreshBadges()
  }

  private slotX(index: number, count: number): number {
    const usable = Math.max(0, this.w - 2 * MARGIN)
    return MARGIN + (index + 0.5) * usable / Math.max(1, count)
  }

  private edgeTargets(count: number, edgeX: number): number[] {
    const pos: number[] = []
    let li = 0
    let ri = 0
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) pos.push(edgeX + (li++) * EDGE_GAP)
      else pos.push(this.w - edgeX - (ri++) * EDGE_GAP)
    }
    return pos
  }

  /** 档位感知站位（G2–G4/G9）：离场中 actor 不占槽。 */
  private assignSlots(): void {
    const active = this.actors.filter(actor => !actor.isExiting())
    const sorted = [...active].sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    const slots = slotsFor(this.w)
    this.overflowIds.clear()

    // 极小档：最早一只居中压扁，其余贴边窥视（G4）
    if (this.tier === 'tiny') {
      const edges = this.edgeTargets(Math.max(0, sorted.length - 1), TINY_EDGE_X)
      sorted.forEach((actor, index) => {
        if (index === 0) {
          actor.setTarget(this.w / 2, true)
          actor.setPinned('squish')
        } else {
          actor.setTarget(edges[index - 1] ?? TINY_EDGE_X, true)
          actor.setPinned('sit')
        }
      })
      return
    }

    if (this.tier === 'spotlight') {
      const holderId = this.spotlight.getHolder()
      const napperId = this.spotlight.getNapper()
      const onStage = holderId ?? napperId
      const edges = this.edgeTargets(Math.max(0, sorted.length - (onStage === null ? 0 : 1)), EDGE_X)
      let edgeIndex = 0
      for (const actor of sorted) {
        if (actor.pet.id === holderId) {
          actor.setTarget(this.w / 2, true)
          actor.setPinned(null)
        } else if (holderId === null && actor.pet.id === napperId) {
          actor.setTarget(this.w / 2, true)
          actor.setPinned('sleep')
        } else {
          actor.setTarget(edges[edgeIndex++] ?? EDGE_X, true)
          actor.setPinned('sit')
          this.overflowIds.add(actor.pet.id)
        }
      }
      return
    }

    if (slots === 0 || slots >= sorted.length) {
      sorted.forEach((actor, index) => {
        actor.setTarget(this.slotX(index, sorted.length), true)
        actor.setPinned(null)
      })
      return
    }

    // 拥挤/狭小：lineup 决定格位归属（G2/G3）
    const lineup = lineupFor(this.tier, sorted.map(a => a.pet), slots)
    const idSet = new Set(lineup.slotIds)
    const edges = this.edgeTargets(lineup.overflowIds.length, EDGE_X)
    const overflowIndex = new Map(lineup.overflowIds.map((id, i) => [id, i] as const))
    sorted.forEach((actor, index) => {
      const id = actor.pet.id
      if (idSet.has(id)) {
        const slotIndex = lineup.slotIds.indexOf(id)
        actor.setTarget(this.slotX(slotIndex >= 0 ? slotIndex : index, slots), true)
        actor.setPinned(null)
        return
      }
      this.overflowIds.add(id)
      actor.setTarget(edges[overflowIndex.get(id) ?? 0] ?? EDGE_X, true)
      const nonEager = personalityOf(actor.pet.passion) !== 'eager'
      // 拥挤：不热情者安静趴着；狭小：观望徘徊（G2/G3）
      actor.setPinned(this.tier === 'crowded' && nonEager ? 'sit' : null)
    })
  }

  private relayout(): void {
    const rect = this.stageDiv.getBoundingClientRect()
    this.w = Math.max(0, rect.width)
    this.h = Math.max(0, rect.height)
    this.groundY = Math.round(this.h - Math.max(26, this.h * 0.12))
    this.grass.setAttribute('y', String(this.groundY - 8))
    this.grass.setAttribute('height', String(Math.max(0, this.h - this.groundY + 8)))
    this.assignSlots()
    this.evalTier()
  }

  private evalTier(): void {
    const activeCount = this.actors.filter(actor => !actor.isExiting()).length
    const next = computeTier(this.w, activeCount)
    if (next !== this.tier) {
      const prev = this.tier
      this.tier = next
      console.info(`[pet-yard] tier: ${prev} → ${next}`)
      this.opts.onTierChanged?.(next, prev)
      this.tierReaction(next, prev)
      this.assignSlots()
    }
    const flatten = this.h > 0 && this.h < FLATTEN_H
    if (flatten !== this.flatten) {
      this.flatten = flatten
      console.info(`[pet-yard] flatten: ${flatten ? 'on' : 'off'}`)
    }
  }

  /** 实时缩放反应（G10）。 */
  private tierReaction(next: Tier, prev: Tier): void {
    const shrinking = TIER_RANK[next] < TIER_RANK[prev]
    for (const actor of this.actors) {
      if (actor.isExiting()) continue
      const p = personalityOf(actor.pet.passion)
      if (shrinking) {
        if (p === 'eager') {
          actor.poke()
          actor.showBubble('！', 1200)
        } else if (p === 'calm') {
          actor.performAction('tilt')
        } else {
          actor.performAction('twitch')
        }
      } else if (p === 'eager') {
        actor.performAction('spin')
      }
    }
  }

  // ---- 聚光灯编排（G6–G9） ----

  private runSpotlight(): void {
    const pets = this.actors.filter(a => !a.isExiting()).map(a => a.pet)
    const before = this.spotlight.getHolder()
    for (const ev of this.spotlight.tick(pets, this.tier, Date.now())) {
      this.applySpotlightEvent(ev)
    }
    const after = this.spotlight.getHolder()
    if (before !== after) {
      this.refreshBadges()
      this.opts.onHolderChanged?.(after)
    }
  }

  private applySpotlightEvent(ev: SpotlightEvent): void {
    if (ev.type === 'appoint') {
      console.info(`[pet-yard] spotlight: ${ev.petId} 上台`)
      this.assignSlots()
    } else if (ev.type === 'vacant') {
      console.info('[pet-yard] spotlight: 冷场——今天大家都有点懒得营业……')
      this.opts.onColdStart?.()
      this.assignSlots()
    } else if (ev.type === 'nap') {
      console.info(`[pet-yard] spotlight: ${ev.petId} 占着舞台打盹`)
      this.assignSlots()
    } else if (ev.type === 'excursion') {
      const actor = this.actors.find(a => a.pet.id === ev.petId)
      if (actor !== undefined && !actor.isExiting()) {
        console.info(`[pet-yard] spotlight: ${ev.petId} 下台溜达一圈`)
        actor.setPinned(null)
        actor.setTarget(Math.max(MARGIN, Math.min(this.w - MARGIN, this.w / 4 + Math.random() * this.w / 2)), true)
        this.excursionActorId = ev.petId
        this.excursionReturnAt = Date.now() + 2600
      }
    } else {
      const prev = this.actors.find(a => a.pet.id === ev.previousHolderId)
      const next = this.actors.find(a => a.pet.id === ev.challengerId)
      if (prev !== undefined && !prev.isExiting()) {
        if (personalityOf(prev.pet.passion) === 'eager') {
          prev.performAction('roll')
          prev.showBubble('哇！', 1600)
        } else {
          // 非热情现任：不还手，耸肩平静让位（G6）
          prev.performAction('tilt')
        }
      }
      if (next !== undefined && !next.isExiting()) {
        next.setTarget(this.w / 2, true)
        if (personalityOf(next.pet.passion) === 'aloof') next.showBubble('……', 2200)
        if (personalityOf(next.pet.passion) === 'eager') this.strutPending.add(ev.challengerId)
      }
      console.info(`[pet-yard] spotlight: ${ev.challengerId} 上台（顶替 ${ev.previousHolderId}）`)
      this.assignSlots()
    }
  }

  private updateStrut(): void {
    if (this.strutPending.size === 0) return
    if (this.tier !== 'spotlight') {
      this.strutPending.clear()
      return
    }
    for (const id of [...this.strutPending]) {
      const actor = this.actors.find(a => a.pet.id === id)
      if (actor === undefined || actor.isExiting()) {
        this.strutPending.delete(id)
        continue
      }
      if (actor.atTarget()) {
        this.strutPending.delete(id)
        actor.performAction('jump')
        actor.showBubble('看我！', 1800)
      }
    }
  }

  /** 溜达回马枪（G8）。 */
  private updateExcursion(): void {
    if (this.excursionActorId === null || this.excursionReturnAt === 0) return
    if (Date.now() < this.excursionReturnAt) return
    const actor = this.actors.find(a => a.pet.id === this.excursionActorId)
    const id = this.excursionActorId
    this.excursionActorId = null
    this.excursionReturnAt = 0
    if (actor === undefined || actor.isExiting()) return
    actor.setTarget(this.w / 2, true)
    this.strutPending.add(id)
  }

  /** 冷场哈欠传染（G9）：冷场期间每 8–14s 一轮，按到场顺序逐只 yawn。 */
  private updateYawnWave(): void {
    const cold = this.tier === 'spotlight' && this.spotlight.getHolder() === null
    const now = Date.now()
    if (!cold) {
      this.yawnNextAt = now + 4000
      return
    }
    if (now < this.yawnNextAt) return
    this.yawnNextAt = now + 8000 + Math.random() * 6000
    const sorted = this.actors
      .filter(a => !a.isExiting())
      .sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    sorted.forEach((actor, index) => {
      window.setTimeout(() => {
        if (!actor.isExiting() && !actor.isDone()) actor.performAction('yawn')
      }, index * 900)
    })
  }

  /** 拥挤/狭小档的热情溢出者冲挤（G2/G3）。 */
  private updateDash(): void {
    if (this.tier !== 'crowded' && this.tier !== 'narrow') {
      this.dashing.clear()
      return
    }
    const now = Date.now()
    for (const actor of this.actors) {
      if (actor.isExiting()) continue
      const id = actor.pet.id
      if (!this.overflowIds.has(id)) continue
      if (personalityOf(actor.pet.passion) !== 'eager') continue
      if (this.dashing.has(id)) {
        if (actor.atTarget()) {
          this.dashing.delete(id)
          this.dashNext.set(id, now + 4000 + Math.random() * 5000)
          this.assignSlots()
        }
        continue
      }
      let next = this.dashNext.get(id)
      if (next === undefined) {
        next = now + 2000 + Math.random() * 3000
        this.dashNext.set(id, next)
      }
      if (now >= next) {
        this.dashing.add(id)
        actor.setPinned(null)
        actor.setTarget(60 + Math.random() * Math.max(60, this.w - 120), true)
        actor.showBubble('让我进去！', 1500)
      }
    }
  }

  private refreshBadges(): void {
    const holderId = this.spotlight.getHolder()
    for (const actor of this.actors) {
      if (actor.isExiting()) {
        actor.setBadge('')
        continue
      }
      const isHolder = actor.pet.id === holderId
      actor.setBadge(actor.pet.locked ? (isHolder ? '👑' : '🔒') : '')
    }
  }
}
```

> 变更清单（对照 P3 版）：新增 `onColdStart` 选项、`TIER_RANK`/`TINY_EDGE_X`/`HUDDLE_GAP`/excursion/yawn/photo 字段；`assignSlots` 全档位重写（tiny/squish、nap 占台、pinned 策略、lineup 接入）；`tierReaction`（G10，取代 P3 的 poke-only 反应）；`summon/photoSession` 公共方法（快照为**裸序列化**，水印装饰由 controller 一次完成）；`applySpotlightEvent` 扩全量事件；`updateExcursion/updateYawnWave` 新增；`loop` 加 `photoActive` 门（合影期间冻结日常调度）。

**验证**：`npm run typecheck`。

---

## 7. CP6 — 头像条与面板重写

**`src/client/ui/avatarBar.ts`**（**整文件覆写**；G7 语义：点头像 = 点名，⋯ = 菜单）：

```ts
import type { Pet } from '../../core/types.ts'
import type { ArtStyle } from '../render/styles.ts'

export interface AvatarBarHandle {
  readonly refresh: (pets: readonly Pet[], holderId: string | null) => void
  readonly dispose: () => void
}

/**
 * 底部头像条：点头像 = 点名上台（controller 决定非聚光灯档的回退），
 * 点 ⋯ = 打开该宠物互动菜单（需求 §3.7 交互保障）。
 */
export function mountAvatarBar(
  stage: HTMLElement,
  getStyle: () => ArtStyle,
  onSummon: (petId: string) => void,
  onMenu: (petId: string) => void,
): AvatarBarHandle {
  const bar = document.createElement('div')
  bar.className = 'py-avatarbar'
  stage.appendChild(bar)
  return {
    refresh(pets, holderId) {
      bar.innerHTML = ''
      for (const pet of pets) {
        const style = getStyle()
        const box = style.portraitBox
        const wrap = document.createElement('div')
        wrap.style.position = 'relative'
        const button = document.createElement('button')
        button.type = 'button'
        button.className = pet.id === holderId ? 'py-avatar holder-ring' : 'py-avatar'
        button.title = `${pet.name}（点头像上台）`
        const mark = pet.locked ? (pet.id === holderId ? '👑' : '🔒') : ''
        button.innerHTML = `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}">`
          + `${style.render(pet.traits, `av-${pet.id}`)}</svg>`
          + `<span class="mark">${mark}</span>`
        button.addEventListener('click', () => onSummon(pet.id))
        const more = document.createElement('button')
        more.type = 'button'
        more.className = 'py-avatar-more'
        more.textContent = '⋯'
        more.title = `${pet.name} 的互动菜单`
        more.addEventListener('click', event => {
          event.stopPropagation()
          onMenu(pet.id)
        })
        wrap.append(button, more)
        bar.appendChild(wrap)
      }
    },
    dispose() {
      bar.remove()
    },
  }
}
```

**`src/client/ui/panels.ts`**（**整文件覆写**；新增 📷 合影与 📖 图鉴）：

```ts
import type { ArtStyleId, ArchiveEntry, Yard } from '../../core/types.ts'
import { SPAWN_INTERVAL_MAX_MIN, SPAWN_INTERVAL_MIN_MIN } from '../../config.ts'
import { availableStyles, type ArtStyle } from '../render/styles.ts'

export interface PanelsOptions {
  readonly getYard: () => Yard | null
  readonly onIntervalChange: (min: number) => void
  readonly onStyleChange: (id: ArtStyleId) => void
  readonly onPhoto: () => void
  readonly getStyle: () => ArtStyle
  /** 图鉴条目回看档案卡。 */
  readonly onArchiveCard: (petId: string) => void
}

export interface PanelsHandle {
  readonly openStats: () => void
  readonly openSettings: () => void
  readonly refresh: () => void
  readonly dispose: () => void
}

/** 右上工具条（📊 📖 📷 ⚙️）+ 统计/图鉴/设置浮层。 */
export function mountPanels(stage: HTMLElement, opts: PanelsOptions): PanelsHandle {
  const toolbar = document.createElement('div')
  toolbar.className = 'py-toolbar'
  toolbar.innerHTML = '<button type="button" data-panel="stats" title="探望统计">📊</button>'
    + '<button type="button" data-panel="archive" title="图鉴">📖</button>'
    + '<button type="button" data-act="photo" title="合影">📷</button>'
    + '<button type="button" data-panel="settings" title="设置">⚙️</button>'
  stage.appendChild(toolbar)

  const panel = document.createElement('div')
  panel.className = 'py-panel'
  panel.style.display = 'none'
  stage.appendChild(panel)

  let opened: 'stats' | 'settings' | 'archive' | null = null
  const close = (): void => {
    opened = null
    panel.style.display = 'none'
  }
  const row = (label: string, value: string | number): string =>
    `<div class="row"><span>${label}</span><span>${value}</span></div>`

  const renderStats = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const log = yard.stats.visitLog.slice(-10).reverse()
      .map(ts => `<div class="log">${new Date(ts).toLocaleString()}</div>`).join('')
    panel.innerHTML = '<h3>探望记录</h3>'
      + '<button type="button" class="py-close" data-close>×</button>'
      + row('总探望次数', yard.stats.visitCount)
      + row('连续探望天数', yard.stats.streak)
      + row('历史最长纪录', yard.stats.longestStreak)
      + row('累计打开次数', yard.stats.openCount)
      + row('相遇总数', yard.stats.metTotal)
      + row('合影次数', yard.stats.photosTaken)
      + `<h3>最近探望</h3>${log === '' ? '<div class="log">还没有记录</div>' : log}`
  }

  const renderArchive = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const style = opts.getStyle()
    const box = style.portraitBox
    const rows = yard.archive.slice().reverse().map((e: ArchiveEntry) => {
      const met = new Date(e.arrivedAt).toLocaleDateString('zh-CN')
      const left = new Date(e.leftAt).toLocaleDateString('zh-CN')
      const cycle = e.cycle >= 2 ? ' ⭐' : ''
      return `<button type="button" class="row arch-row" data-arch="${e.id}" style="width:100%;text-align:left">`
        + `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="30" height="32">${style.render(e.traits, `ar-${e.id}`)}</svg>`
        + `<span>${e.name}${cycle}</span><span class="log">№${e.id.slice(2)} · ${met} → ${left}</span></button>`
    }).join('')
    panel.innerHTML = '<h3>图鉴</h3>'
      + '<button type="button" class="py-close" data-close>×</button>'
      + (rows === '' ? '<div class="log">还没有告别的宝贝</div>' : rows)
  }

  const renderSettings = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const radios = availableStyles().map(s =>
      `<label class="row"><input type="radio" name="py-style" value="${s.id}"`
      +`${s.id === yard.settings.artStyle ? ' checked' : ''}/> ${s.labelZh}</label>`).join('')
    panel.innerHTML = '<h3>设置</h3>'
      + '<button type="button" class="py-close" data-close>×</button>'
      + `<div class="row"><span>到访间隔（分钟）</span>`
      + `<input type="number" min="${SPAWN_INTERVAL_MIN_MIN}" max="${SPAWN_INTERVAL_MAX_MIN}" step="1"`
      + ` value="${yard.settings.spawnIntervalMin}" data-interval/></div>`
      + '<div class="row"><button type="button" data-apply-interval>应用间隔</button></div>'
      + `<h3>美术风格</h3>${radios}<div class="log">新风格随版本加入</div>`
  }

  toolbar.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    if (button.dataset.act === 'photo') {
      opts.onPhoto()
      return
    }
    const which = button.dataset.panel as 'stats' | 'settings' | 'archive'
    if (opened === which) {
      close()
      return
    }
    opened = which
    if (which === 'stats') renderStats()
    else if (which === 'archive') renderArchive()
    else renderSettings()
    panel.style.display = ''
  })

  panel.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    if (button.hasAttribute('data-close')) {
      close()
      return
    }
    if (button.hasAttribute('data-apply-interval')) {
      const input = panel.querySelector<HTMLInputElement>('[data-interval]')
      if (input === null) return
      const raw = Number(input.value)
      if (!Number.isFinite(raw)) return
      const clamped = Math.min(SPAWN_INTERVAL_MAX_MIN, Math.max(SPAWN_INTERVAL_MIN_MIN, Math.round(raw)))
      opts.onIntervalChange(clamped)
      renderSettings()
      return
    }
    const arch = button.dataset.arch
    if (arch !== undefined) opts.onArchiveCard(arch)
  })

  panel.addEventListener('change', event => {
    const input = event.target as HTMLInputElement
    if (input.type === 'radio' && input.name === 'py-style' && input.checked) {
      opts.onStyleChange(input.value as ArtStyleId)
    }
  })

  return {
    openStats: () => {
      opened = 'stats'
      renderStats()
      panel.style.display = ''
    },
    openSettings: () => {
      opened = 'settings'
      renderSettings()
      panel.style.display = ''
    },
    refresh: () => {
      if (opened === 'stats') renderStats()
      else if (opened === 'settings') renderSettings()
      else if (opened === 'archive') renderArchive()
    },
    dispose: () => {
      toolbar.remove()
      panel.remove()
    },
  }
}

export function openCardModal(stage: HTMLElement, svg: string, onExport: () => void): void {
  closeCardModal(stage)
  const modal = document.createElement('div')
  modal.className = 'py-card-modal'
  modal.innerHTML = `<div class="inner">${svg}`
    + '<div class="acts"><button type="button" data-act="export">导出 PNG</button>'
    + '<button type="button" data-act="close">关闭</button></div></div>'
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeCardModal(stage)
      return
    }
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    if (button.dataset.act === 'export') onExport()
    else closeCardModal(stage)
  })
  stage.appendChild(modal)
}

export function closeCardModal(stage: HTMLElement): void {
  stage.querySelector('.py-card-modal')?.remove()
}
```

> `panels.ts` 顶部需追加一行 CSS 到 actions.ts 的 STAGE_CSS（CP1 ③ 已含 `.py-avatar-more`；图鉴行还需一条）：**在 `.py-panel label.row` 行后追加** `.py-panel .arch-row { display: flex; align-items: center; gap: 8px; border: 1px solid #e5d9c9; border-radius: 8px; background: #fff; padding: 4px 6px; margin: 3px 0; cursor: pointer; }`——此编辑并入 CP1 ③ 一并落地（共 4 条 CSS）。

**验证**：`npm run typecheck`。

---

## 8. CP7 — 控制器最终重写

**`src/client/yardController.ts`**（**整文件覆写**；与 P3 版差异：合影管线、图鉴回看、点名接线、冷场提示、暂停 toast 优先级）：

```ts
import { MAX_PETS, SAVE_DEBOUNCE_MS } from '../config.ts'
import { createInitialDoc, fromDoc, toDoc } from '../core/doc.ts'
import {
  dueSpawnCount, formatPetId, isSpawnPaused, renamePet, setLocked,
  spawnIntervalMs, spawnPet, type SpawnResult,
} from '../core/spawn.ts'
import { recordOpen } from '../core/stats.ts'
import { derivePet } from '../core/traits.ts'
import type { ArtStyleId, ArchiveEntry, Pet, Yard } from '../core/types.ts'
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
import { closeCardModal, mountPanels, openCardModal, type PanelsHandle } from './ui/panels.ts'
import { showToast } from './ui/toast.ts'

const STORAGE_KEY = 'dsh-plugin-pet/state'

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
      onColdStart: () => this.coldToastOnce(),
    })
  }

  start(): void {
    const now = Date.now()
    let yard = loadYard(now)
    yard = { ...yard, stats: recordOpen(yard.stats, now) }
    let offlinePetId: string | null = null
    if (dueSpawnCount(yard, now) > 0) {
      const result = spawnPet(yard, now)
      yard = result.yard
      if (result.pet !== null) offlinePetId = result.pet.id
    }
    this.yard = yard
    this.engine.start()
    this.engine.restyle(yard.settings.artStyle ?? 'geo')

    const stage = this.engine.getStageEl()
    this.panels = mountPanels(stage, {
      getYard: () => this.yard,
      onIntervalChange: min => this.applyInterval(min),
      onStyleChange: id => this.applyStyle(id),
      onPhoto: () => void this.takePhoto(),
      getStyle: () => styleOf(this.yard?.settings.artStyle ?? 'geo'),
      onArchiveCard: petId => this.openArchiveCard(petId),
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
      if (dueSpawnCount(yard, now) > 0) {
        const result = spawnPet(yard, now)
        yard = result.yard
        if (result.pet !== null) this.pendingGreet.set(result.pet.id, '它在门口等你很久啦！')
      }
      this.yard = yard
      this.engine.syncPets(yard.pets)
      this.scheduleSave()
      this.refreshUi()
    } else {
      this.flushSave()
    }
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

  /** 点名（G7）：非聚光灯档回退为打开菜单。 */
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
    this.engine.syncPets(this.yard.pets)
    this.scheduleSave()
    // G13：动作 toast 先弹，refreshUi 的暂停检查在后（暂停提示覆盖锁定提示）
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

  /** 图鉴回看（G12）。 */
  private openArchiveCard(petId: string): void {
    if (this.yard === null) return
    const entry = this.yard.archive.find(e => e.id === petId)
    if (entry === undefined) return
    openCardModal(this.engine.getStageEl(), cardSvg(entry, this.yard.settings.artStyle, { leftAt: entry.leftAt }), () => {
      downloadSvgAsPng(cardSvg(entry, this.yard?.settings.artStyle, { leftAt: entry.leftAt }), cardFileName(entry))
        .then(() => showToast(this.engine.getStageEl(), '档案卡已导出'))
        .catch(err => showToast(this.engine.getStageEl(), `导出失败：${String(err)}`))
    })
  }

  /** 合影（G11/G14）。 */
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
      const fileName = `合影_${dateText}_第${this.yard.stats.visitCount}次探望.png`
      await downloadSvgAsPng(svg, fileName, shot.w, shot.h)
      this.yard = {
        ...this.yard,
        stats: { ...this.yard.stats, photosTaken: this.yard.stats.photosTaken + 1 },
      }
      this.scheduleSave()
      this.refreshUi()
      showToast(stage, '合影已导出')
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

  // ---- debug 调参台 API ----

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
    this.engine.setHudText(
      `${TIER_LABEL_ZH[this.engine.getTier()]} · 在场 ${this.yard.pets.length}/${MAX_PETS} · 已相遇 ${this.yard.stats.metTotal} · 下次到访 ${mm}:${String(ss).padStart(2, '0')}${paused}`,
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

> 注意：`ArchiveEntry` 结构上满足 `cardSvg(pet: Pet, ...)`（超集），直接传入即可；模板顶部 `import type { ..., ArchiveEntry, ... }` 若 typecheck 报未使用，删掉该名。

**构建**：`npm run typecheck && npm run test && npm run bundle`（95 既有 + spotlight2 6 + lineup 4 + photoExport 2 + cardRender2 2 = 109）。

---

## 9. CP8 — M2 验收清单

浏览器逐项（`dsh --profile pets --port 3081`；无法自动化项请用户确认）：

1. **拥挤档内差异**：5 只 + 宽 480（格位 3）→ 3 只占位；溢出的热情者周期冲挤；溢出的淡定/高冷贴边坐定不动（sit）。
2. **狭小卡位**：宽 300（格位 2）→ 两只**热情者**占卡位（无论到场先后）；不热情者在两侧徘徊不坐定。
3. **极小档**：宽 110 → 最早一只居中 Q 弹压扁（squish 循环）；其余贴边坐定窥视（半脸）。
4. **非热情现任让位**：冷场存档 → 聚光灯档有淡定者时先点名一只高冷上台（见 5），等轮换/点名挑战 → 现任 `tilt`（耸肩）平静走向边缘（不 roll 不「哇！」）。
5. **点名**：聚光灯档点头像 → 该宠物立即走向中央顶替现任；高冷者头顶「……」；toast「点名 X 上台！」；点名后仅热情者臭美 jump。非聚光灯档点头像 → 打开菜单（回退）。
6. **单热情者溜达**：构造仅 1 只热情（锁定其余/冷场存档+立即到访直到出现）→ 约每 2 个轮换周期（30s）一次下台溜达 2.6s 后回台臭美（console `下台溜达一圈`）。
7. **冷场全量**：冷场存档（全高冷）→ 聚光灯 → 全员贴边坐定；toast「今天大家都有点懒得营业……」每会话一次；观察 8–14s 一轮哈欠（逐只 yawn 波浪）。**含淡定者的冷场**（部分高冷部分淡定存档：可用锁定+快进组合，或验证 nap 路径）→ 最早淡定者居中打盹。载入演示存档后快进到出现热情者 → 好戏立即恢复。
8. **实时缩放反应**：宽 900→250 跨档 → 热情者跳 +「！」、淡定 tilt、高冷 twitch；250→900 → 热情者 spin 欢呼后走回，其余自然走回。
9. **合影**：宽调到拥挤档（含贴边者）→ 点 📷 → 全员跑向中央挤成一团（重叠）→ 稳定约 0.8s → 下载 `合影_日期_第N次探望.png`（水印右下角含日期与次数）→ 宠物各回各位；统计面板「合影次数」+1。
10. **图鉴**：先淘汰几只（立即到访×N）→ 📖 → 倒序列表（迷你立绘/名字/№/相遇→告别日期/二世⭐）；点条目 → 档案卡弹窗页脚含「告别于 …」；可导出。空图鉴显示「还没有告别的宝贝」。
11. **头像 ⋯**：点头像上的 ⋯ → 打开该宠物菜单（宠物不可见时亦可锁定/重命名/导出）。
12. **暂停提示优先级**：5 只全锁 → **锁定路径即可见**暂停 toast（G13）。
13. **回归**：typecheck + 109/109 全绿；F5 状态保留；console 无红色报错；P3 的 14 项抽查（菜单/锁定/重命名/档案卡/统计/设置/调参台数值输入）不回归。

---

## 10. 报告模板（`docs/p4-report.md`）

同 P3 格式：检查点结果表（CP1–CP8）／测试统计／M2 验收记录（13 项）／视觉微调记录（G14）／偏差与决策树／报错与处置／遗留问题。

## 11. 决策树

**D1 测试失败** / **D2 typecheck**：同 P3 规程（先查笔误；模板矛盾停下记录；禁删断言；不用 `any`）。
**D3 pinned 不生效**：确认 `scheduleNext` 首行 guard 存在；确认 `assignSlots` 每次都覆盖全部 actor 的 pinned（包括清 null）；dash 触发时先 `setPinned(null)`。
**D4 合影空白/宠物重叠错乱**：确认 `photoActive` 期间 loop 冻结日常调度；确认 `photoSession` 结束必走 `assignSlots()`（finally 语义）；快照无内容 → 检查 `decoratePhotoSvg` 的 svg 开标签正则是否匹配序列化输出（`<svg xmlns=...>`）。
**D5 点名无反应**：确认 `tier === 'spotlight'`；确认目标 petId 在场；`summon` 返回 false 走了菜单回退。
**D6 冷场不哈欠/不恢复**：哈欠需 `getHolder() === null` 且 spotlight 档；恢复需 pets 中出现 passion≥60（立即到访或演示存档验证）。
**D7 缩放反应未触发**：跨越档位才触发（同档内拖动不触发）；检查 `TIER_RANK` 方向与 `evalTier` 调用链。
**D8 图鉴行点击无效**：`data-arch` 在 button 上、事件委托在 panel 上；`closest('button')` 命中后再取 `dataset.arch`。

## 12. 禁止事项

1. 不修改 §0.3-1 列出文件；config 只追加；actions/actor 只做 CP1 精确编辑。
2. 不实现 P5 内容：心情、明信片、成就、昼夜/天气、宠物间互动、礼物架、音效。
3. 不注册 `real` 风格；标签/音节池/特征池冻结。
4. 不引入新依赖；视觉微调仅限 G14 且记录。
5. 产品语义两难 → 记录并报告。
