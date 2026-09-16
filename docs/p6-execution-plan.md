# P6 执行方案：家具场景 · 吃喝 · 宠物互动 · 粒子 · 昼夜按钮（执行手册）

> 版本：v1.0 · 对应 `docs/implementation-plan.md` v1.7 / 需求 v0.5（前置：P5 与美术已验收——144/144、`real` 风格与画廊就绪，见 `docs/p5-report.md` / `docs/art-report.md`）
> **执行者须知**：线性执行手册。engine 为**整文件覆写**（模板已包含 P4 全部 + P5 已验证的锚点改动 + P6 新增，以模板为准）；panels/controller 为锚点编辑（以当前仓库代码为基底）。

---

## 0. 任务说明

### 0.1 目标（用户决策，需求 v0.5）

1. **场景家具**：后墙 + 窗户、沙发、小桌；位置按舞台宽度比例布局；窄舞台自动降级（藏家具保食碗）；宠物可**换位置**去家具处（沙发坐、桌边待、随意溜达）。
2. **吃喝系统**：水碗（无限）+ 食盆（份数制）；宠物周期性走去吃喝（eat/drink 动作 + 粒子）；**点击食盆添食**。
3. **宠物互动**：两只空闲宠物周期性发起——贴贴 / 追逐 / 玩同一个球（需求 §4.3-1 全量）。
4. **粒子系统**：爱心（点击/摸摸）、碎屑（吃）、水滴（喝）、闪光（添食/合影），上浮渐隐自清理。
5. **昼夜切换按钮**：工具条按钮循环 自动→☀️白天→🌆黄昏→🌙夜晚→自动；手动覆盖本地时钟；偏好存 localStorage。

**验收门**：typecheck + 全部测试（144 既有 + 新增 ≥10）全绿；浏览器按 §8 清单 15 项逐项通过；geo/real 双风格、全部既有行为不回归。

### 0.2 检查点

| CP | 内容 |
|---|---|
| CP1 | config 追加 + actions 锚点编辑（eat/drink 动作 + 粒子/球 CSS）+ `stage/particles.ts` + 测试 |
| CP2 | `stage/props.ts`（布局纯函数 + 家具 markup）+ 测试 |
| CP3 | engine 整文件覆写（道具层/粒子层/吃喝/漫游/互动/昼夜覆盖/insertBefore 宠器次序） |
| CP4 | panels + controller 锚点编辑（昼夜按钮/道具点击/心情联动） |
| CP5 | 构建 + 浏览器验证（15 项）+ 报告 |

### 0.3 执行规则

1. 工作目录 `E:/dsh-plugin-pet`。**不修改**：`docs/` 既有文档（报告写 `docs/p6-report.md`）、`package.json`（零新依赖）、`tsdown.config.ts`、`cordis.patch.yml`、`src/index.ts`、`src/client/index.ts`、`locales.ts`、`pngExport.ts`、`persist.ts`、`PetYardView.tsx`、`debug.ts`、`dayNight.ts`、`render/` 全部、`stage/`（actions 锚点编辑除外：svgDom/tiers/lineup/spotlight/actor）、`ui/`（panels 锚点编辑除外：gallery/interactMenu/toast/avatarBar）、`src/core/` 全部、`tests/` 全部既有测试。
2. **允许修改**：`src/config.ts`（只追加）；`src/client/stage/actions.ts`（锚点编辑）；`src/client/stage/engine.ts`、`src/client/yardController.ts` 的既有结构按 CP3/CP4 指令（engine 整文件覆写、panels/controller 锚点编辑）。
3. **新建**：`src/client/stage/particles.ts`、`src/client/stage/props.ts`、`tests/particles.spec.ts`、`tests/props.spec.ts`。
4. 模板原样落地；偏离走 §9 决策树并记录。测试即验收（禁删断言）。每 CP 后 `npm run typecheck`。中文注释保留。

---

## 1. 设计决策速查（P6 法典 F1–F15）

| # | 决策 |
|---|---|
| F1 | **道具层**：svg 内顺序 = 天空 → 草地 → `g.py-props`（家具）→ 宠物 → `g.py-particles`（粒子/球，永居顶层——新建宠物 `insertBefore(actor.root, particlesLayer)`）。家具在宠物身后（宠物从前面经过）。 |
| F2 | **布局按比例**（`propLayout(width)` 纯函数）：窗 0.30w / 沙发 0.16w / 桌 0.84w / 食盆 0.60w / 水碗 0.68w；墙全宽。**降级**：w < 420 藏家具（墙/窗/沙发/桌）；w < 240 全藏（纯档位场景）。`relayout` 时重渲染道具。 |
| F3 | **道具配色走 CSS 变量**：`applyPhase` 在 stageDiv 上设 `--py-wall/--py-wall2/--py-prop/--py-prop2/--py-propline/--py-glass` 六变量（三段配色）；道具 fill 全用 `var()`——昼夜/手动切换自动生效，无需重渲染道具。 |
| F4 | **行程（trips）只发生在宽裕/拥挤档**，且只针对**非溢出**宠物（溢出者维持贴边/探头语义 G2–G4）；档位跌到狭小/聚光灯/极小或合影开始时，进行中的行程中止并 `assignSlots()` 归位。行程种类：meal（食盆）/drink（水碗）/sit（去沙发或桌边坐下 3–6s）/wander（随机点溜达）。 |
| F5 | **吃喝节奏**：每宠独立计时——餐 `nextMealAt`（40–90s 随机重排）、水 `nextDrinkAt`（50–110s）。到点且条件满足 → directed 走向盆 → 到达后 pinned `eat`（3.2s）/ `drink`（2.8s）+ 每 0.8s 一粒粒子；餐结束时 `foodServings--` 并重渲染食盆；食盆空则不发起餐行程（水不受限）。行程完成发 `onPetEvent('meal'|'drink')`。 |
| F6 | **食盆**：份数制（≤5，初始 3，点击 +3 钳制）；有食物才画食物点；**点击添食**（引擎 `refillFood()` + 闪光粒子），点击经 `onPropClick('food'|'water')` 通知 controller toast。份数为**会话态不持久化**（刷新回 3）。 |
| F7 | **互动三式**（`updateInteractions`，每 18–35s 一次，宽裕/拥挤档，2 只非溢出空闲宠物）：**贴贴** = A 走到 B 旁 → 双方 stretch + 中点 3 心粒子 +「贴贴～」；**追逐** = 4s 追逃（B 每 1.1s 换随机逃点，A 持续追 B.x，开场气泡「等等我！」「嘿嘿！」）→ 结束双 jump；**玩球** = 顶层生成球，双方轮流追球拍 3 拍（球 CSS transition 弹向新随机点）→ 球渐隐 + 双 jump「好玩！」。贴贴完成发 `onPetEvent('cuddle')`。 |
| F8 | **空闲判定** `isFreeActor`：非 exiting、非溢出、无行程、非互动参与者、非 dashing/strutPending。聚光灯持有者天然不冲突（行程与互动只跑在宽裕/拥挤档）。 |
| F9 | **粒子**：外层 g 属性 transform 定位 + 内层 `g.py-particle` CSS 动画（`--dx/--pd` 自定义属性控制横漂与时长，keyframes 用 `translate(var(--dx),-46px)`）；`animationend` 后移除 + 1.6s 兜底超时。四种 markup 冻结于 `particles.ts`。 |
| F10 | **昼夜按钮**：工具条 `🌓` 键循环 `auto→day→dusk→night→auto`；标签跟随（🌓/☀️/🌆/🌙，title 带全称）；engine `setPhaseOverride(phase|null)`——覆盖时停用时钟自动切换；`ctx.dayPhase` 与场景配色同源（夜晚打盹加成对手动夜晚同样生效）。偏好存 localStorage `dsh-plugin-pet/phase`（UI 偏好，不入存档）。 |
| F11 | **引擎零 domain 写入**（V7 延续）：吃喝/贴贴的心情提升经 `onPetEvent` 回调由 controller 执行（meal +3 / drink +2 / cuddle +2，`withMoodDelta` 单宠版本），防抖存档。 |
| F12 | **eat/drink 为引擎指令动作**（不进随机池）：eat = 低头 bob 1.6s 循环；drink = 小幅快速舔舐式 bob 0.7s 循环。 |
| F13 | 合影快照前清空粒子层（球与飞行粒子不入镜）；道具与家具**入镜**（院子全景本该有家具）。 |
| F14 | **允许微调（记录）**：家具路径坐标、配色变量值、粒子参数、行程/互动节奏、位置比例。**不可改**：F1–F13 语义、档位/争宠既有规则、`ArtStyle` 契约。 |
| F15 | 既有行为不回归是验收的一部分：贴边/探头/聚光灯/冷场/点名/合影/图鉴/成就/画廊全部照旧。 |

---

## 2. CP1 — 常量、动作与粒子

**`src/config.ts` 追加**（文件末尾）：

```ts
/** 家具（墙/窗/沙发/桌）显示的最小舞台宽度（P6 F2）。 */
export const FURNITURE_MIN_W = 420

/** 食碗/水碗显示的最小舞台宽度。 */
export const BOWLS_MIN_W = 240

/** 食盆份数上限与每次添食量（F6）。 */
export const FOOD_MAX_SERVINGS = 5
export const FOOD_REFILL_ADD = 3

/** 吃喝/溜达节奏（ms，[min, max] 随机；F4/F5）。 */
export const MEAL_GAP_MS: readonly [number, number] = [40_000, 90_000]
export const DRINK_GAP_MS: readonly [number, number] = [50_000, 110_000]
export const STROLL_GAP_MS: readonly [number, number] = [25_000, 60_000]

/** 互动节奏与时长（F7）。 */
export const IA_GAP_MS: readonly [number, number] = [18_000, 35_000]
export const CHASE_MS = 4_000
export const CUDDLE_MS = 1_600
export const BALL_BATS = 3
```

**`src/client/stage/actions.ts` 锚点编辑三处**：

① `ActionName` 联合 `| 'twitch'` 后追加 ` | 'eat' | 'drink'`（`ScheduledAction` 不动）。

② `ACTION_DURATION` 的 `twitch: [500, 500],` 行后追加：

```ts
  eat: [1600, 1600],
  drink: [700, 700],
```

③ STAGE_CSS 末尾（`.py-gallery-cell figcaption` 规则后、闭合反引号前）追加：

```css
.py-eat { animation: py-eat 1.6s ease-in-out infinite; }
.py-drink { animation: py-drink 0.7s ease-in-out infinite; }
@keyframes py-eat { 0%, 100% { transform: translateY(0) rotate(0deg); } 40%, 60% { transform: translateY(4px) rotate(10deg); } }
@keyframes py-drink { 0%, 100% { transform: translateY(0) rotate(0deg); } 45% { transform: translateY(3px) rotate(4deg); } }
.py-particle { pointer-events: none; animation: py-float var(--pd, 1100ms) ease-out forwards; }
@keyframes py-float { from { opacity: 1; transform: translate(0, 0) scale(1); } to { opacity: 0; transform: translate(var(--dx, 0px), -46px) scale(0.5); } }
.py-ball { transition: transform 0.55s ease; }
.py-ball-out { transition: opacity 0.6s ease; opacity: 0; }
.py-prop-bowl { cursor: pointer; }
```

**`src/client/stage/particles.ts`**（新建，整文件；**markup 冻结**）：

```ts
/** 粒子四式（F9）：爱心（点击/摸摸/贴贴）、碎屑（吃）、水滴（喝）、闪光（添食/合影）。 */
export type ParticleKind = 'heart' | 'crumb' | 'drop' | 'sparkle'

export const PARTICLE_MARKUP: Record<ParticleKind, string> = {
  heart: '<path d="M0,2.6 C-2.6,-1 -5,-0.2 -5,-2.4 C-5,-4.6 -2.6,-4.8 0,-2.2 C2.6,-4.8 5,-4.6 5,-2.4 C5,-0.2 2.6,-1 0,2.6 Z" fill="#ef7d9d"/>',
  crumb: '<circle r="2.2" fill="#b07a3f"/>',
  drop: '<path d="M0,-3.4 C2,0.4 2.6,1.6 0,3.4 C-2.6,1.6 -2,0.4 0,-3.4 Z" fill="#7fb7e0"/>',
  sparkle: '<path d="M0,-4 L1.1,-1.1 L4,0 L1.1,1.1 L0,4 L-1.1,1.1 L-4,0 L-1.1,-1.1 Z" fill="#f5d76e"/>',
}
```

**`tests/particles.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { PARTICLE_MARKUP } from '../src/client/stage/particles.ts'
import { ACTION_DURATION } from '../src/client/stage/actions.ts'

describe('粒子与吃喝动作（F9/F12）', () => {
  it('四式粒子 markup 非空且带填充色', () => {
    for (const [kind, markup] of Object.entries(PARTICLE_MARKUP)) {
      expect(markup.length, kind).toBeGreaterThan(20)
      expect(markup).toContain('fill=')
    }
    expect(PARTICLE_MARKUP.heart).toContain('#ef7d9d')
    expect(PARTICLE_MARKUP.crumb).toContain('#b07a3f')
    expect(PARTICLE_MARKUP.drop).toContain('#7fb7e0')
    expect(PARTICLE_MARKUP.sparkle).toContain('#f5d76e')
  })
  it('eat/drink 已注册时长（引擎指令动作）', () => {
    expect(ACTION_DURATION.eat).toEqual([1600, 1600])
    expect(ACTION_DURATION.drink).toEqual([700, 700])
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/particles.spec.ts`。

---

## 3. CP2 — 家具（纯函数 + markup）

**`src/client/stage/props.ts`**（新建，整文件）：

```ts
import { BOWLS_MIN_W, FURNITURE_MIN_W } from '../../config.ts'

/** 场景家具（F1–F3）：布局为纯函数（可测），markup 用阶段 CSS 变量（不依赖具体配色）。 */

export interface PropLayout {
  readonly showFurniture: boolean
  readonly showBowls: boolean
  readonly windowX: number
  readonly sofaX: number
  readonly tableX: number
  readonly foodX: number
  readonly waterX: number
}

/** 比例布局 + 窄舞台降级（F2，阈值在 config.ts）。 */
export function propLayout(width: number): PropLayout {
  return {
    showFurniture: width >= FURNITURE_MIN_W,
    showBowls: width >= BOWLS_MIN_W,
    windowX: Math.round(width * 0.3),
    sofaX: Math.round(width * 0.16),
    tableX: Math.round(width * 0.84),
    foodX: Math.round(width * 0.6),
    waterX: Math.round(width * 0.68),
  }
}

const L = 'var(--py-propline)'
const P = 'var(--py-prop)'
const P2 = 'var(--py-prop2)'

/** 后墙 + 窗户（全宽，底部对齐草地顶）。 */
export function wallMarkup(width: number, groundY: number, windowX: number): string {
  const top = groundY - 86
  return `<g class="py-prop">`
    + `<rect x="0" y="${top}" width="${width}" height="86" fill="var(--py-wall)"/>`
    + `<rect x="0" y="${top}" width="${width}" height="6" fill="var(--py-wall2)"/>`
    + `<g transform="translate(${windowX - 32}, ${top + 10})">`
    + `<rect x="0" y="0" width="64" height="50" rx="6" fill="${P}" stroke="${L}" stroke-width="2"/>`
    + `<rect x="6" y="6" width="52" height="38" rx="3" fill="var(--py-glass)"/>`
    + `<path d="M32,6 v38 M6,25 h52" stroke="${L}" stroke-width="2"/>`
    + `<rect x="-5" y="50" width="74" height="5" rx="2.5" fill="${P2}" stroke="${L}" stroke-width="1.4"/>`
    + `<circle cx="16" cy="-3" r="4" fill="#8fae7a"/><circle cx="22" cy="-5" r="3" fill="#a3c08c"/>`
    + `</g></g>`
}

/** 沙发（宠物 spot = sofaX）。 */
export function sofaMarkup(x: number, groundY: number): string {
  return `<g class="py-prop" transform="translate(${x}, ${groundY})">`
    + `<rect x="-55" y="-30" width="110" height="30" rx="9" fill="${P}" stroke="${L}" stroke-width="2.4"/>`
    + `<rect x="-55" y="-58" width="110" height="30" rx="11" fill="${P}" stroke="${L}" stroke-width="2.4"/>`
    + `<rect x="-58" y="-44" width="12" height="30" rx="6" fill="${P2}" stroke="${L}" stroke-width="2"/>`
    + `<rect x="46" y="-44" width="12" height="30" rx="6" fill="${P2}" stroke="${L}" stroke-width="2"/>`
    + `<path d="M-30,-30 v14 M0,-30 v14 M30,-30 v14" stroke="${P2}" stroke-width="3" stroke-linecap="round"/>`
    + `</g>`
}

/** 小圆桌（宠物 spot = tableX）。 */
export function tableMarkup(x: number, groundY: number): string {
  return `<g class="py-prop" transform="translate(${x}, ${groundY})">`
    + `<rect x="-3.5" y="-42" width="7" height="42" rx="3" fill="${P2}" stroke="${L}" stroke-width="1.8"/>`
    + `<ellipse cx="0" cy="-44" rx="34" ry="9" fill="${P}" stroke="${L}" stroke-width="2.4"/>`
    + `<ellipse cx="-12" cy="-49" rx="6" ry="3" fill="${P2}" stroke="${L}" stroke-width="1.4"/>`
    + `<path d="M-12,-52 q1,-6 5,-7" stroke="${L}" stroke-width="1.6" fill="none"/>`
    + `</g>`
}

/** 盆（food = 有食物才画食物点；water = 水面）。data-prop 供点击委托。 */
export function bowlMarkup(kind: 'food' | 'water', x: number, groundY: number, hasFood: boolean): string {
  const content = kind === 'water'
    ? `<ellipse cx="0" cy="-6" rx="10" ry="3.2" fill="#a8cfe8" opacity="0.92"/>`
    : hasFood
      ? `<circle cx="-4" cy="-6" r="2.4" fill="#b07a3f"/><circle cx="1" cy="-7" r="2.6" fill="#c98d4e"/><circle cx="5" cy="-5.5" r="2.2" fill="#a5713a"/>`
      : ''
  return `<g class="py-prop py-prop-bowl" data-prop="${kind}" transform="translate(${x}, ${groundY})">`
    + `<ellipse cx="0" cy="-4" rx="15" ry="6.5" fill="${P}" stroke="${L}" stroke-width="2.2"/>`
    + `<ellipse cx="0" cy="-6" rx="11.5" ry="4.2" fill="${P2}"/>`
    + content
    + `</g>`
}
```

**`tests/props.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { bowlMarkup, propLayout, sofaMarkup, tableMarkup, wallMarkup } from '../src/client/stage/props.ts'

describe('家具布局与 markup（F2/F3/F6）', () => {
  it('比例位置与降级阈值', () => {
    const wide = propLayout(800)
    expect(wide.showFurniture).toBe(true)
    expect(wide.showBowls).toBe(true)
    expect(wide.windowX).toBe(240)
    expect(wide.sofaX).toBe(128)
    expect(wide.tableX).toBe(672)
    expect(wide.foodX).toBe(480)
    expect(propLayout(419).showFurniture).toBe(false)
    expect(propLayout(419).showBowls).toBe(true)
    expect(propLayout(239).showBowls).toBe(false)
    expect(propLayout(239).showFurniture).toBe(false)
  })
  it('markup 用阶段 CSS 变量（不写死颜色）', () => {
    for (const m of [wallMarkup(800, 300, 240), sofaMarkup(128, 300), tableMarkup(672, 300)]) {
      expect(m).toContain('var(--py-prop')
    }
    expect(wallMarkup(800, 300, 240)).toContain('var(--py-glass)')
  })
  it('食盆食物点随份数切换；水碗恒有水面', () => {
    const full = bowlMarkup('food', 100, 300, true)
    const empty = bowlMarkup('food', 100, 300, false)
    expect(full).toContain('#b07a3f')
    expect(empty).not.toContain('#b07a3f')
    expect(bowlMarkup('water', 100, 300, false)).toContain('#a8cfe8')
  })
  it('盆带 data-prop 点击标记', () => {
    expect(bowlMarkup('food', 0, 0, true)).toContain('data-prop="food"')
    expect(bowlMarkup('water', 0, 0, true)).toContain('data-prop="water"')
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/props.spec.ts`。

---

## 4. CP3 — 引擎整文件覆写

**`src/client/stage/engine.ts`**（**整文件覆写**；= P4 全量 + P5 已验证改动 + P6 全部新增）：

```ts
import {
  BALL_BATS, CHASE_MS, CUDDLE_MS, DRINK_GAP_MS, FLATTEN_H, FOOD_MAX_SERVINGS, FOOD_REFILL_ADD,
  IA_GAP_MS, MEAL_GAP_MS, PHOTO_SETTLE_MS, PHOTO_TIMEOUT_MS,
  ROTATE_LOCKED_MS, ROTATE_MS, SPAWN_CHECK_MS, STROLL_GAP_MS,
} from '../../config.ts'
import { personalityOf } from '../../core/traits.ts'
import type { ArtStyleId, Pet } from '../../core/types.ts'
import { PHASE_COLORS, phaseOf, type DayPhase } from '../dayNight.ts'
import { averageMood } from '../../core/mood.ts'
import { serializeStageSvg } from '../render/photoExport.ts'
import { styleOf } from '../render/styles.ts'
import { ensureStageStyles, type ActionName } from './actions.ts'
import { PetActor, type ActorContext } from './actor.ts'
import { lineupFor } from './lineup.ts'
import { PARTICLE_MARKUP, type ParticleKind } from './particles.ts'
import { bowlMarkup, propLayout, sofaMarkup, tableMarkup, wallMarkup, type PropLayout } from './props.ts'
import { SpotlightMachine, type SpotlightEvent } from './spotlight.ts'
import { svgEl } from './svgDom.ts'
import { computeTier, slotsFor, type Tier } from './tiers.ts'

export interface EngineOptions {
  readonly onPetClick?: (petId: string) => void
  readonly onPetEntered?: (petId: string) => void
  readonly onSpawnCheck?: (now: number) => void
  readonly onTierChanged?: (tier: Tier, prev: Tier) => void
  readonly onHolderChanged?: (petId: string | null) => void
  readonly onColdStart?: () => void
  readonly onWitness?: (kind: 'challenge' | 'cold' | 'summon-aloof' | 'photo-spotlight') => void
  /** 家具点击（F6：食盆添食 / 水碗提示）。 */
  readonly onPropClick?: (kind: 'food' | 'water') => void
  /** 宠物生活事件（F11：controller 做心情提升）。 */
  readonly onPetEvent?: (kind: 'meal' | 'drink' | 'cuddle', petId: string) => void
}

const MARGIN = 70
const EDGE_X = 22
const EDGE_GAP = 30
const TINY_EDGE_X = 16
const HUDDLE_GAP = 34
const TIER_RANK: Record<Tier, number> = { tiny: 0, spotlight: 1, narrow: 2, crowded: 3, roomy: 4 }

/** 行程时长与粒子（F4/F5）。 */
type TripKind = 'meal' | 'drink' | 'sit' | 'wander'
interface Trip { kind: TripKind; startedAt: number; arrived: boolean; until: number; lastParticle: number }

interface Interaction {
  readonly type: 'cuddle' | 'chase' | 'ball'
  readonly aId: string
  readonly bId: string
  phase: 'approach' | 'run' | 'bat' | 'end'
  until: number
  stepAcc: number
  bats: number
  ballX: number
  chaserIsA: boolean
}

const TRIP_MS: Record<TripKind, number> = { meal: 3200, drink: 2800, sit: 4000, wander: 0 }
const rand = (range: readonly [number, number]): number => range[0] + Math.random() * (range[1] - range[0])

/** 三段家具配色（F3/F14）。 */
const PROP_COLORS: Record<DayPhase, Record<string, string>> = {
  day: { '--py-wall': '#e8dcc8', '--py-wall2': '#d9c9ae', '--py-prop': '#e8b98a', '--py-prop2': '#d9a877', '--py-propline': '#8a6f4d', '--py-glass': '#cfe8f5' },
  dusk: { '--py-wall': '#ecd9c0', '--py-wall2': '#dcbfa0', '--py-prop': '#e0a878', '--py-prop2': '#cf9666', '--py-propline': '#7c5c38', '--py-glass': '#f5cfa8' },
  night: { '--py-wall': '#5d6478', '--py-wall2': '#4c5265', '--py-prop': '#8a7f8f', '--py-prop2': '#776c7d', '--py-propline': '#3a3f4e', '--py-glass': '#2e3a52' },
}

export class StageEngine {
  private readonly stageDiv: HTMLDivElement
  private readonly svg: SVGSVGElement
  private readonly grass: SVGRectElement
  private readonly hud: HTMLDivElement
  private readonly propsLayer: SVGGElement
  private readonly particlesLayer: SVGGElement
  private layout: PropLayout = propLayout(0)
  private foodServings = 3
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
  private excursionReturnAt = 0
  private excursionActorId: string | null = null
  private yawnNextAt = 0
  private photoActive = false
  private dayPhase: DayPhase = 'day'
  private phaseOverride: DayPhase | null = null
  private phaseCheckAt = 0
  private reactionTimer: ReturnType<typeof setTimeout> | null = null
  private rainEl: HTMLDivElement | null = null
  // P6：吃喝/溜达/互动（F4–F8）
  private readonly nextMealAt = new Map<string, number>()
  private readonly nextDrinkAt = new Map<string, number>()
  private readonly nextStrollAt = new Map<string, number>()
  private readonly trips = new Map<string, Trip>()
  private ia: Interaction | null = null
  private iaNextAt = 0
  private ballEl: SVGCircleElement | null = null

  constructor(container: HTMLElement, private readonly opts: EngineOptions = {}) {
    ensureStageStyles()
    this.stageDiv = document.createElement('div')
    this.stageDiv.className = 'py-stage'
    this.svg = svgEl('svg')
    const sky = svgEl('rect', { class: 'py-sky', x: 0, y: 0, width: '100%', height: '100%' })
    this.grass = svgEl('rect', { class: 'py-grass', x: 0, width: '100%' })
    this.propsLayer = svgEl('g', { class: 'py-props' })
    this.particlesLayer = svgEl('g', { class: 'py-particles' })
    this.svg.append(sky, this.grass, this.propsLayer, this.particlesLayer)
    this.hud = document.createElement('div')
    this.hud.className = 'py-hud'
    this.stageDiv.append(this.svg, this.hud)
    this.propsLayer.addEventListener('click', event => {
      const hit = (event.target as Element).closest('[data-prop]')
      if (hit !== null) this.opts.onPropClick?.(hit.getAttribute('data-prop') as 'food' | 'water')
    })
    this.applyPhase(phaseOf(Date.now()))
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
      this.phaseCheckAt += dt
      if (this.phaseCheckAt >= 30_000) {
        this.phaseCheckAt = 0
        if (this.phaseOverride === null) {
          const phase = phaseOf(Date.now())
          if (phase !== this.dayPhase) this.applyPhase(phase)
        }
      }
      const ctx: ActorContext = { width: this.w, groundY: this.groundY, flatten: this.flatten, dayPhase: this.dayPhase }
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
        const now = Date.now()
        this.updateTrips(now)
        this.updateInteractions(now, dt)
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
    if (this.reactionTimer !== null) clearTimeout(this.reactionTimer)
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

  /** 昼夜手动覆盖（F10）：null = 回到时钟自动。 */
  setPhaseOverride(phase: DayPhase | null): void {
    this.phaseOverride = phase
    this.applyPhase(phase ?? phaseOf(Date.now()))
  }

  /** 添食（F6）：份数钳制 + 闪光。 */
  refillFood(): void {
    this.foodServings = Math.min(FOOD_MAX_SERVINGS, this.foodServings + FOOD_REFILL_ADD)
    this.renderProps()
    this.spawnParticles(this.layout.foodX, this.groundY - 20, 'sparkle', 6)
  }

  /** 粒子（F9）：外层属性定位，内层 CSS 动画。 */
  spawnParticles(x: number, y: number, kind: ParticleKind, count: number): void {
    for (let i = 0; i < count; i++) {
      const dx = Math.round(Math.random() * 36 - 18)
      const pd = Math.round(900 + Math.random() * 500)
      const jitter = Math.round(Math.random() * 14 - 7)
      const wrap = svgEl('g', { transform: `translate(${x + jitter},${y})` })
      wrap.innerHTML = `<g class="py-particle" style="--dx:${dx}px;--pd:${pd}ms">${PARTICLE_MARKUP[kind]}</g>`
      this.particlesLayer.appendChild(wrap)
      const inner = wrap.firstElementChild as SVGElement
      inner.addEventListener('animationend', () => wrap.remove())
      window.setTimeout(() => wrap.remove(), pd + 700)
    }
  }

  summon(petId: string): boolean {
    if (this.tier !== 'spotlight') return false
    const pets = this.actors.filter(a => !a.isExiting()).map(a => a.pet)
    const events = this.spotlight.summon(petId, pets, this.tier, Date.now())
    if (events.length === 0) return false
    const summoned = pets.find(p => p.id === petId)
    if (summoned !== undefined && personalityOf(summoned.passion) === 'aloof') {
      this.opts.onWitness?.('summon-aloof')
    }
    const before = this.spotlight.getHolder()
    for (const ev of events) this.applySpotlightEvent(ev)
    if (this.spotlight.getHolder() !== before) {
      this.refreshBadges()
      this.opts.onHolderChanged?.(this.spotlight.getHolder())
    }
    return true
  }

  async photoSession(): Promise<{ readonly svg: string; readonly w: number; readonly h: number } | null> {
    const active = this.actors.filter(a => !a.isExiting())
    if (this.photoActive || active.length === 0) return null
    this.photoActive = true
    this.abortTripsAndInteraction('photo')
    const sorted = active.slice().sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    const cx = this.w / 2
    sorted.forEach((actor, index) => {
      actor.setPinned(null)
      actor.setTarget(cx + (index - (sorted.length - 1) / 2) * HUDDLE_GAP, true)
    })
    const deadline = Date.now() + PHOTO_TIMEOUT_MS
    await new Promise<void>(resolve => {
      const poll = window.setInterval(() => {
        const allArrived = this.actors.filter(a => !a.isExiting()).every(a => a.atTarget())
        if (allArrived || Date.now() >= deadline) {
          window.clearInterval(poll)
          window.setTimeout(resolve, PHOTO_SETTLE_MS)
        }
      }, 100)
    })
    if (this.tier === 'spotlight') this.opts.onWitness?.('photo-spotlight')
    this.particlesLayer.innerHTML = ''   // F13：粒子与球不入镜
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
      // F1：粒子层永居顶层
      this.svg.insertBefore(actor.root, this.particlesLayer)
      // F5：为新宠物排生活计时
      const now = Date.now()
      this.nextMealAt.set(pet.id, now + rand(MEAL_GAP_MS))
      this.nextDrinkAt.set(pet.id, now + rand(DRINK_GAP_MS))
      this.nextStrollAt.set(pet.id, now + rand(STROLL_GAP_MS))
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

  private assignSlots(): void {
    const active = this.actors.filter(actor => !actor.isExiting())
    const sorted = [...active].sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    const slots = slotsFor(this.w)
    this.overflowIds.clear()

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
    this.renderProps()
    this.assignSlots()
    this.evalTier()
  }

  /** 家具渲染（F1–F3/F6）：布局随宽度，配色走 CSS 变量。 */
  private renderProps(): void {
    this.layout = propLayout(this.w)
    if (!this.layout.showBowls) {
      this.propsLayer.innerHTML = ''
      return
    }
    let markup = ''
    if (this.layout.showFurniture) {
      markup += wallMarkup(this.w, this.groundY, this.layout.windowX)
      markup += sofaMarkup(this.layout.sofaX, this.groundY)
      markup += tableMarkup(this.layout.tableX, this.groundY)
    }
    markup += bowlMarkup('food', this.layout.foodX, this.groundY, this.foodServings > 0)
    markup += bowlMarkup('water', this.layout.waterX, this.groundY, true)
    this.propsLayer.innerHTML = markup
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
      if (TIER_RANK[next] <= TIER_RANK.narrow) this.abortTripsAndInteraction('tier')
      if (this.reactionTimer !== null) clearTimeout(this.reactionTimer)
      this.reactionTimer = setTimeout(() => {
        this.reactionTimer = null
        this.assignSlots()
      }, 600)
    }
    const flatten = this.h > 0 && this.h < FLATTEN_H
    if (flatten !== this.flatten) {
      this.flatten = flatten
      console.info(`[pet-yard] flatten: ${flatten ? 'on' : 'off'}`)
    }
  }

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

  private applyPhase(phase: DayPhase): void {
    this.dayPhase = phase
    const colors = PHASE_COLORS[phase]
    this.svg.querySelectorAll<SVGRectElement>('.py-sky').forEach(el => { el.style.fill = colors.sky })
    this.svg.querySelectorAll<SVGRectElement>('.py-grass').forEach(el => { el.style.fill = colors.grass })
    for (const [key, value] of Object.entries(PROP_COLORS[phase])) {
      this.stageDiv.style.setProperty(key, value)
    }
  }

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

  // ---- 聚光灯（P4/P5 原样） ----

  private runSpotlight(): void {
    const pets = this.actors.filter(a => !a.isExiting()).map(a => a.pet)
    const calmChallenge = averageMood(pets) >= 80
    const before = this.spotlight.getHolder()
    for (const ev of this.spotlight.tick(pets, this.tier, Date.now(), { calmChallenge })) {
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
      this.opts.onWitness?.('cold')
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
          prev.performAction('tilt')
        }
      }
      if (next !== undefined && !next.isExiting()) {
        next.setTarget(this.w / 2, true)
        if (personalityOf(next.pet.passion) === 'aloof') next.showBubble('……', 2200)
        if (personalityOf(next.pet.passion) === 'eager') this.strutPending.add(ev.challengerId)
      }
      this.opts.onWitness?.('challenge')
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

  private updateExcursion(): void {
    if (this.excursionActorId === null || this.excursionReturnAt === 0) return
    if (Date.now() < this.excursionReturnAt) return
    const id = this.excursionActorId
    this.excursionActorId = null
    this.excursionReturnAt = 0
    if (this.spotlight.getHolder() !== id) return
    const actor = this.actors.find(a => a.pet.id === id)
    if (actor === undefined || actor.isExiting()) return
    actor.setTarget(this.w / 2, true)
    this.strutPending.add(id)
  }

  private updateYawnWave(): void {
    const cold = this.tier === 'spotlight' && this.spotlight.getHolder() === null
    const now = Date.now()
    if (!cold) {
      this.yawnNextAt = now + 4000
      return
    }
    if (now < this.yawnNextAt) return
    this.yawnNextAt = now + 8000 + Math.random() * 6000
    const sorted = this.actors.filter(a => !a.isExiting()).sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    sorted.forEach((actor, index) => {
      window.setTimeout(() => {
        if (!actor.isExiting() && !actor.isDone()) actor.performAction('yawn')
      }, index * 900)
    })
  }

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

  // ---- P6：吃喝 / 溜达 / 互动（F4–F8） ----

  private isFreeActor(actor: PetActor): boolean {
    const id = actor.pet.id
    return !actor.isExiting()
      && !this.overflowIds.has(id)
      && !this.trips.has(id)
      && !this.isInInteraction(id)
      && !this.dashing.has(id)
      && !this.strutPending.has(id)
  }

  private isInInteraction(id: string): boolean {
    return this.ia !== null && (this.ia.aId === id || this.ia.bId === id)
  }

  private actorOf(id: string): PetActor | undefined {
    return this.actors.find(a => a.pet.id === id)
  }

  private updateTrips(now: number): void {
    if (this.tier !== 'roomy' && this.tier !== 'crowded') {
      this.abortTripsAndInteraction('tier')
      return
    }
    // 发起（F5：餐需有食物；sit 需有家具，否则退化为 wander）
    for (const actor of this.actors) {
      if (!this.isFreeActor(actor)) continue
      const id = actor.pet.id
      if (this.nextMealAt.get(id) !== undefined && now >= (this.nextMealAt.get(id) ?? 0) && this.foodServings > 0 && this.layout.showBowls) {
        this.beginTrip(actor, 'meal', now)
        continue
      }
      if (this.nextDrinkAt.get(id) !== undefined && now >= (this.nextDrinkAt.get(id) ?? 0) && this.layout.showBowls) {
        this.beginTrip(actor, 'drink', now)
        continue
      }
      if (this.nextStrollAt.get(id) !== undefined && now >= (this.nextStrollAt.get(id) ?? 0)) {
        this.beginTrip(actor, Math.random() < 0.55 && this.layout.showFurniture ? 'sit' : 'wander', now)
      }
    }
    // 推进
    for (const [id, trip] of [...this.trips]) {
      const actor = this.actorOf(id)
      if (actor === undefined || actor.isExiting()) {
        this.endTrip(id, now)
        continue
      }
      if (!trip.arrived) {
        if (actor.atTarget()) {
          trip.arrived = true
          trip.until = now + TRIP_MS[trip.kind]
          trip.lastParticle = now
          if (trip.kind === 'meal') {
            this.foodServings--
            this.renderProps()
            actor.setPinned('eat')
            this.opts.onPetEvent?.('meal', id)
          } else if (trip.kind === 'drink') {
            actor.setPinned('drink')
            this.opts.onPetEvent?.('drink', id)
          } else if (trip.kind === 'sit') {
            actor.setPinned('sit')
          } else {
            this.endTrip(id, now)
          }
        }
        continue
      }
      if (trip.kind === 'meal' || trip.kind === 'drink') {
        if (now - trip.lastParticle >= 800) {
          trip.lastParticle = now
          const spotX = trip.kind === 'meal' ? this.layout.foodX : this.layout.waterX
          this.spawnParticles(spotX, this.groundY - 18, trip.kind === 'meal' ? 'crumb' : 'drop', 1)
        }
      }
      if (now >= trip.until) this.endTrip(id, now)
    }
  }

  private beginTrip(actor: PetActor, kind: TripKind, now: number): void {
    const id = actor.pet.id
    let targetX: number
    if (kind === 'meal') targetX = this.layout.foodX
    else if (kind === 'drink') targetX = this.layout.waterX
    else if (kind === 'sit') targetX = Math.random() < 0.6 ? this.layout.sofaX : this.layout.tableX
    else targetX = MARGIN + Math.random() * Math.max(0, this.w - 2 * MARGIN)
    actor.setPinned(null)
    actor.setTarget(targetX, true)
    this.trips.set(id, { kind, startedAt: now, arrived: false, until: 0, lastParticle: 0 })
    if (kind === 'meal') this.nextMealAt.delete(id)
    else if (kind === 'drink') this.nextDrinkAt.delete(id)
    else this.nextStrollAt.delete(id)
  }

  private endTrip(id: string, now: number): void {
    const trip = this.trips.get(id)
    this.trips.delete(id)
    const actor = this.actorOf(id)
    if (actor !== undefined && !actor.isExiting()) actor.setPinned(null)
    if (trip?.kind === 'meal') this.nextMealAt.set(id, now + rand(MEAL_GAP_MS))
    else if (trip?.kind === 'drink') this.nextDrinkAt.set(id, now + rand(DRINK_GAP_MS))
    else this.nextStrollAt.set(id, now + rand(STROLL_GAP_MS))
    this.assignSlots()
  }

  /** 中止全部行程与互动（档位跌落/合影；F4/F13）。 */
  private abortTripsAndInteraction(_reason: 'tier' | 'photo'): void {
    const now = Date.now()
    for (const id of [...this.trips.keys()]) this.endTrip(id, now)
    this.cleanupInteraction()
  }

  private updateInteractions(now: number, dt: number): void {
    if (this.ia !== null) {
      this.advanceInteraction(now, dt)
      return
    }
    if (this.tier !== 'roomy' && this.tier !== 'crowded') {
      this.iaNextAt = now + 8000
      return
    }
    if (now < this.iaNextAt) return
    const free = this.actors.filter(a => this.isFreeActor(a))
    if (free.length < 2) {
      this.iaNextAt = now + 6000
      return
    }
    this.iaNextAt = now + rand(IA_GAP_MS)
    const a = free[Math.floor(Math.random() * free.length)]!
    const rest = free.filter(x => x !== a)
    const b = rest[Math.floor(Math.random() * rest.length)]!
    const type = (['cuddle', 'chase', 'ball'] as const)[Math.floor(Math.random() * 3)]!
    this.ia = { type, aId: a.pet.id, bId: b.pet.id, phase: 'approach', until: 0, stepAcc: 0, bats: 0, ballX: 0, chaserIsA: true }
    a.setPinned(null)
    b.setPinned(null)
    if (type === 'cuddle') {
      a.setTarget(b.getX() - 30, true)
    } else if (type === 'chase') {
      this.ia.phase = 'run'
      this.ia.until = now + CHASE_MS
      a.showBubble('等等我！', 1800)
      b.showBubble('嘿嘿！', 1800)
      b.setTarget(MARGIN + Math.random() * Math.max(0, this.w - 2 * MARGIN), true)
      a.setTarget(b.getX(), true)
    } else {
      this.ia.phase = 'bat'
      this.ia.ballX = Math.max(MARGIN, Math.min(this.w - MARGIN, (a.getX() + b.getX()) / 2))
      this.ia.chaserIsA = true
      this.spawnBall()
      this.retargetChaser(now)
    }
    console.info(`[pet-yard] interaction: ${type}（${a.pet.id} & ${b.pet.id}）`)
  }

  private advanceInteraction(now: number, dt: number): void {
    const ia = this.ia!
    const a = this.actorOf(ia.aId)
    const b = this.actorOf(ia.bId)
    if (a === undefined || b === undefined || a.isExiting() || b.isExiting()) {
      this.cleanupInteraction()
      return
    }
    if (ia.phase === 'approach') {
      if (a.atTarget()) {
        ia.phase = 'end'
        ia.until = now + CUDDLE_MS
        a.performAction('stretch')
        b.performAction('stretch')
        this.spawnParticles((a.getX() + b.getX()) / 2, this.groundY - 72, 'heart', 3)
        a.showBubble('贴贴～', 1600)
        b.showBubble('呼噜呼噜…', 1600)
      }
      return
    }
    if (ia.phase === 'run') {
      ia.stepAcc += dt
      if (ia.stepAcc >= 1100) {
        ia.stepAcc = 0
        b.setTarget(MARGIN + Math.random() * Math.max(0, this.w - 2 * MARGIN), true)
      }
      a.setTarget(b.getX(), true)
      if (now >= ia.until) {
        ia.phase = 'end'
        ia.until = now + 1000
        a.performAction('jump')
        b.performAction('jump')
      }
      return
    }
    if (ia.phase === 'bat') {
      const chaser = ia.chaserIsA ? a : b
      if (chaser.atTarget()) {
        ia.bats++
        if (ia.bats >= BALL_BATS) {
          ia.phase = 'end'
          ia.until = now + 1200
          this.fadeBall()
          a.performAction('jump')
          b.performAction('jump')
          a.showBubble('好玩！', 1600)
          return
        }
        ia.chaserIsA = !ia.chaserIsA
        this.moveBall()
        this.retargetChaser()
      }
      return
    }
    if (now >= ia.until) {
      const wasCuddle = ia.type === 'cuddle'
      const cuddleId = ia.aId
      this.cleanupInteraction()
      if (wasCuddle) this.opts.onPetEvent?.('cuddle', cuddleId)
      this.assignSlots()
    }
  }

  private retargetChaser(): void {
    const ia = this.ia
    if (ia === null) return
    const chaser = this.actorOf(ia.chaserIsA ? ia.aId : ia.bId)
    chaser?.setTarget(ia.ballX, true)
  }

  private moveBall(): void {
    const ia = this.ia
    if (ia === null || this.ballEl === null) return
    ia.ballX = MARGIN + Math.random() * Math.max(0, this.w - 2 * MARGIN)
    this.ballEl.style.transform = `translate(${ia.ballX}px, ${this.groundY - 7}px)`
  }

  private spawnBall(): void {
    const ia = this.ia
    if (ia === null) return
    this.ballEl = svgEl('circle', { class: 'py-ball', r: 6, fill: '#e8964f', stroke: '#8a5526', 'stroke-width': 1.5 })
    this.ballEl.style.transform = `translate(${ia.ballX}px, ${this.groundY - 7}px)`
    this.particlesLayer.appendChild(this.ballEl)
  }

  private fadeBall(): void {
    if (this.ballEl === null) return
    this.ballEl.classList.add('py-ball-out')
    const ball = this.ballEl
    this.ballEl = null
    window.setTimeout(() => ball.remove(), 700)
  }

  private cleanupInteraction(): void {
    this.ia = null
    if (this.ballEl !== null) this.fadeBall()
  }
}
```

> 模板已含 P4 全量 + P5 已验证改动（applyPhase/setRain/onWitness/reactionTimer/insertBefore 结构见 CP3 模板正文）。

**验证**：`npm run typecheck`（此刻 controller/panels 尚未接新回调——选项为可选，不阻塞）。

---

## 5. CP4 — 面板与控制器锚点编辑

**`src/client/ui/panels.ts` 锚点编辑四处**：

① `PanelsOptions` 的 `onPostcard` 行后追加：

```ts
  /** 昼夜切换按钮（F10）。 */
  readonly onPhaseCycle: () => void
```

② 工具条 innerHTML：`'<button type="button" data-panel="achv" title="成就">🏆</button>'` 行后追加：

```ts
    + '<button type="button" data-act="phase" title="昼夜：自动">🌓</button>'
```

③ click 委托中 `if (button.dataset.act === 'photo')` 分支后追加：

```ts
    if (button.dataset.act === 'phase') {
      opts.onPhaseCycle()
      return
    }
```

④ `PanelsHandle` 接口加一行 `readonly setPhaseLabel: (label: string, title: string) => void`；返回对象 `dispose` 前追加：

```ts
    setPhaseLabel: (label: string, title: string) => {
      const btn = toolbar.querySelector<HTMLButtonElement>('[data-act="phase"]')
      if (btn !== null) {
        btn.textContent = label
        btn.title = title
      }
    },
```

**`src/client/yardController.ts` 锚点编辑六处**（以当前代码为基底）：

① mood import 行扩为：

```ts
import { MOOD_ZH, averageMood, clampMood, decayMood, moodBandOf, petMood, withMoodDelta } from '../core/mood.ts'
```

② 顶部常量区 `const MOOD_PHOTO_GAIN = 15` 行后追加：

```ts
const PHASE_KEY = 'dsh-plugin-pet/phase'
type PhaseMode = 'auto' | 'day' | 'dusk' | 'night'
const PHASE_ORDER: readonly PhaseMode[] = ['auto', 'day', 'dusk', 'night']
const PHASE_ICON: Record<PhaseMode, string> = { auto: '🌓', day: '☀️', dusk: '🌆', night: '🌙' }
const PHASE_TITLE: Record<PhaseMode, string> = {
  auto: '昼夜：自动（跟随时钟）', day: '昼夜：白天（点击切换）', dusk: '昼夜：黄昏（点击切换）', night: '昼夜：夜晚（点击切换）',
}
const MOOD_EVENT_GAIN: Record<'meal' | 'drink' | 'cuddle', number> = { meal: 3, drink: 2, cuddle: 2 }
```

③ engine 构造 opts 的 `onWitness` 闭包后追加（逗号衔接）：

```ts
      onPropClick: kind => {
        if (kind === 'food') {
          this.engine.refillFood()
          showToast(this.engine.getStageEl(), '添了好吃的！')
        } else {
          showToast(this.engine.getStageEl(), '水碗是满的～')
        }
      },
      onPetEvent: (kind, petId) => this.moodBump(petId, MOOD_EVENT_GAIN[kind]),
```

④ `start()` 中 `this.avatarBar = mountAvatarBar(` 之前（panels 创建处）的 `onPostcard: petId => this.openPostcard(petId),` 行后追加：

```ts
      onPhaseCycle: () => this.cyclePhase(),
```

并在 `this.hudTimer = setInterval(...)` 行前追加：

```ts
    this.applyStoredPhase()
```

⑤ `applyStyle` 方法后追加两个方法：

```ts
  /** 昼昼切换（F10）：循环 auto→day→dusk→night，localStorage 偏好。 */
  private cyclePhase(): void {
    const current = (localStorage.getItem(PHASE_KEY) as PhaseMode | null) ?? 'auto'
    const next = PHASE_ORDER[(PHASE_ORDER.indexOf(current) + 1) % PHASE_ORDER.length]!
    localStorage.setItem(PHASE_KEY, next)
    this.engine.setPhaseOverride(next === 'auto' ? null : next)
    this.panels?.setPhaseLabel(PHASE_ICON[next], PHASE_TITLE[next])
    const stage = this.engine.getStageEl()
    if (next === 'auto') showToast(stage, '昼夜跟随时钟')
    else showToast(stage, `切换到${next === 'day' ? '白天' : next === 'dusk' ? '黄昏' : '夜晚'}`)
  }

  private applyStoredPhase(): void {
    const mode = (localStorage.getItem(PHASE_KEY) as PhaseMode | null) ?? 'auto'
    if (mode !== 'auto') this.engine.setPhaseOverride(mode)
    this.panels?.setPhaseLabel(PHASE_ICON[mode], PHASE_TITLE[mode])
  }

  /** 单宠心情提升（F11：引擎事件 → domain）。 */
  private moodBump(petId: string, delta: number): void {
    if (this.yard === null) return
    const pets = this.yard.pets.map(p =>
      p.id === petId ? { ...p, mood: clampMood(petMood(p) + delta) } : p)
    this.yard = { ...this.yard, pets }
    this.scheduleSave()
    this.refreshHud()
  }
```

⑥ `handlePetClick` 中 `this.engine.poke(petId)` 行后追加一行（点击爱心粒子，F9）：

```ts
    const pos0 = this.engine.getPetPos(petId)
    if (pos0 !== null) this.engine.spawnParticles(pos0.x, pos0.y + 60, 'heart', 3)
```

`openMenu` 的 `onPet`（摸一摸）分支 `this.engine.showBubble(id, '好舒服～', 1600)` 行后追加：

```ts
        const pos = this.engine.getPetPos(id)
        if (pos !== null) this.engine.spawnParticles(pos.x, pos.y + 60, 'heart', 4)
```

**构建**：`npm run typecheck && npm run test && npm run bundle`（144 既有 + particles 2 + props 4 = 150）。

---

## 6. CP5 — 浏览器验证（15 项）

`dsh --profile pets --port 3081`（后台任务），`npm run bundle` 后热替换。逐项记录（无法自动化项请用户确认）：

1. **家具渲染**：宽 ≥420 → 后墙+窗（含窗台小植物）、沙发、小桌、双盆；窄拖到 <420 → 家具消失双盆保留；<240 → 全部消失。
2. **昼夜按钮**：工具条 🌓 → 循环切换；白天/黄昏/夜晚的墙窗沙发桌配色与天空草地同步变化；「自动」回到当前时钟时段；刷新后偏好保留。
3. **手动夜晚打盹**：切到 🌙 后观察 1 分钟——打盹比例上升（与自动夜晚同效）。
4. **水碗**：等待（或快进观察 2 分钟内）→ 某宠物走向水碗 → drink 动作 + 水滴粒子 → 完成归位；HUD 心情均值 +2。
5. **食盆**：初始有食物点 → 宠物走去 eat + 碎屑粒子 → 食物点减少（renderProps 重画）；吃到空后再无人去吃。
6. **添食**：点击食盆 → 闪光粒子 + toast「添了好好的！」+ 食物点恢复（份数 ≤5 钳制：连点两次观察）。
7. **点水碗**：toast「水碗是满的～」。
8. **换位置**：观察期出现「走向沙发坐下 3–6s」与「走向小桌」的行为（sit pinned）；结束后回到自己的格位。
9. **贴贴**：两只宠物靠近 → 双 stretch + 中点 3 心 +「贴贴～」「呼噜呼噜…」；console `interaction: cuddle`。
10. **追逐**：4s 一追一逃（逃者约 1.1s 换向）+ 开场双气泡；结束双 jump。
11. **玩球**：球出现在中场 → 两宠轮流追球拍打 3 次 → 球渐隐 + 双 jump「好玩！」。
12. **档位中断**：互动/行程进行中把宽度拖到 <280 → 行为中止、宠物归位到档位站位（无卡死）。
13. **合影**：📷 → 全员挤团快照**含家具**（墙窗沙发桌入镜）且无球/粒子残留；导出正常。
14. **窄舞台保护**：狭小/聚光灯/极小档不发起任何行程与互动（既有档位语义不回归）。
15. **回归**：typecheck + 150/150 全绿；贴边/探头/聚光灯轮换/冷场哈欠/点名/图鉴/成就/画廊/real 风格抽查不回归；console 无红色报错。

---

## 7. 报告模板（`docs/p6-report.md`）

同 P5 格式：检查点结果表（CP1–CP5）／测试统计／15 项验证记录／视觉微调记录（F14）／偏差与决策树／报错与处置／遗留问题。

## 8. 决策树

**D1 测试失败 / D2 typecheck**：同既有规程。
**D3 家具不显示**：宽度阈值（F2）；`renderProps` 在 relayout/refill 调用；CSS 变量由 `applyPhase` 设置（F3）。
**D4 宠物不去吃喝**：食盆空（F5 餐需 `foodServings>0`）；或宠物处于溢出/互动/行程中（F8 空闲判定）；计时未到（40–90s 起步）。
**D5 互动卡死**：`advanceInteraction` 的各 phase 必须有出口（approach→atTarget、run→until、bat→bats≥3、end→until）；参与者 exiting 即 cleanup；仍卡 → console 记录 ia 状态报告。
**D6 粒子不动/不消失**：内层 g 的 `--dx/--pd` 内联；外层用属性 transform（CSS 动画只在内层，避免覆盖）；animationend + 超时双保险。
**D7 昼夜按钮无效**：panels 的 `onPhaseCycle` 必填（controller 已接）；engine `setPhaseOverride` 后自动切换暂停（loop 内 override 判断）。
**D8 球残留在合影/场景**：`fadeBall` 的 700ms 移除；photoSession 前清空 particlesLayer（F13）。
**D9 anchor 失配**：以函数/语义定位，代码照抄模板；仍失败记录报告。

## 9. 禁止事项

1. 不修改 §0.3-1 列出文件；锚点编辑仅限列出的文件与位置。
2. 不做 P7 候选：礼物收藏架、音效、宿主侧 domain 存储迁移、家具自定义摆放。
3. 食盆份数不持久化（会话态，F6）；家具集合与位置固定（比例布局，不做用户编辑）。
4. 不引入新依赖；粒子 markup / 法典 F1–F13 语义冻结；微调仅限 F14 且记录。
5. 产品语义两难 → 记录并报告。
