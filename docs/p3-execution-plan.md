# P3 执行方案：MVP 交互闭环（执行手册）

> 版本：v1.0 · 对应 `docs/implementation-plan.md` 的 P3 阶段（前置：P2 已验收 M0，见 `docs/p2-report.md`）
> 本阶段包含两项**用户新决策**（implementation-plan v1.3）：① 几何简笔形象转正为可选美术风格（注册表架构）；② 调参台常驻且宽/高支持数值精确输入。
> **执行者须知**：线性执行手册，按顺序执行，照抄模板，遇分支走决策树。本手册的全部模板基于**当前仓库实际代码**（含 P2 执行者的两处修正：`CELL_W` 常量、离场 DOM 移除），整文件覆写即以模板为准。

---

## 0. 任务说明

### 0.1 目标（= implementation-plan P3 验收门 = 需求 M1）

在 P2 舞台之上补齐全部 MVP 交互：

1. **美术风格系统**：`STYLE_REGISTRY` 注册表；当前几何简笔 = 风格 `geo`（转正）；`Settings.artStyle` 持久化；设置面板可切换（当前仅 geo 一项，`real` 预留给最终版美术）。
2. **调参台升级**：宽/高滑条 + 数值输入双向同步，精确调整。
3. **互动菜单**：摸摸 / 看档案（弹窗预览）/ 锁定解锁 / 重命名 / 导出档案卡。
4. **头像条**：≤5 圆头像迷你立绘，锁定/持有者角标，点击打开菜单（宠物不可见时可操作）。
5. **争宠基础版**：聚光灯档热情者轮换（15s/锁定 30s+👑，撞飞"哇！"/上台"看我！"编排）；拥挤/狭小档贴边探头 + 热情者冲挤；冷场基础版（无热情者舞台空置）。
6. **档案卡**：540×720 离屏渲染（名字/№/特征标签/性格/相遇日期/风格名/二世标记）+ PNG 导出。
7. **统计面板 + 设置面板 + toast**；卖萌动作集五式。
8. 修复 P2 遗留 #1（行走中点击被 walk 覆盖）。

**验收门（M1）**：`npm run typecheck` + 全部测试（74 + 新增 ≥25）全绿；浏览器按 §10 清单逐项通过。

### 0.2 检查点映射

| 检查点 | 内容 | 对应任务 |
|---|---|---|
| CP1 | 美术风格注册表 + Settings.artStyle + 迁移测试 | P3-0（风格部分） |
| CP2 | 卖萌动作集 + P3 全部 UI 样式（actions.ts 重写） | P3-8 |
| CP3 | actor.ts 重写（公共 API + poke 修复）+ spotlight.ts 纯状态机 + 测试 | P3-4（逻辑）+ P2 遗留 #1 |
| CP4 | engine.ts 重写（档位感知站位/聚光灯编排/探头冲挤/公共查询） | P3-4（编排） |
| CP5 | UI 模块：toast + interactMenu + avatarBar | P3-1/P3-3 |
| CP6 | labels + cardRender + panels（工具条/统计/设置/卡片弹窗）+ 测试 | P3-5/P3-6/P3-7 |
| CP7 | debug.ts 数值输入 + yardController 最终重写 + 构建 | P3-0（输入部分）/P3-2/接线 |
| CP8 | M1 验收 + 全量回归 | P3-9 |

### 0.3 执行规则（必须遵守）

1. **工作目录** `E:/dsh-plugin-pet`；新文件绝对路径创建。
2. **不修改**：`docs/` 全部既有文档（报告写新文件 `docs/p3-report.md`）、`package.json`（零新依赖）、`tsdown.config.ts`、`cordis.patch.yml`、`src/index.ts`、`src/client/index.ts`、`src/client/locales.ts`、`src/client/pngExport.ts`、`src/client/persist.ts`、`src/client/PetYardView.tsx`（薄壳无需动）、`src/client/render/palette.ts`、`src/client/render/parts.ts`、`src/client/render/petSprite.ts`、`src/client/stage/svgDom.ts`、`src/client/stage/tiers.ts`、`src/core/` 其余文件（rng/namer/spawn/stats/traits）、`tests/` 全部既有测试。
3. **允许修改**（按模板指定方式）：
   - `src/config.ts`：**只追加** CP1 列出的常量；
   - `src/core/types.ts`、`src/core/doc.ts`：只做 CP1 给出的**精确编辑**（Settings.artStyle 加性字段）；
   - `src/client/stage/actions.ts` / `actor.ts` / `engine.ts` / `debug.ts` / `yardController.ts`：**整文件覆写**为模板。
4. 模板代码原样落地；唯一允许改动：决策树（§12）分支与 §1 法典注明的视觉微调。偏离记入报告。
5. **测试即验收**：禁止删断言换通过（同 P1/P2 D 规程）。
6. 每个检查点结束跑 `npm run typecheck`；CP3/CP4 之间允许只做类型门（浏览器验证集中在 CP8）。
7. 中文注释原样保留。

---

## 1. 设计决策速查（P3 法典）

| # | 决策 |
|---|---|
| M1 | **美术风格 = 数据驱动注册表**（`render/styles.ts`）。`geo`（几何简笔）是首个正式风格；`real` 是最终版美术的预留 id——**未注册前不可选**，`styleOf('real')` 回退 geo。风格含 `render(traits, uid)`（舞台 sprite，局部坐标系 V1 不变）与 `portraitBox`（头像/档案卡裁剪框）。 |
| M2 | `Settings.artStyle` 是**加性字段**：`normalize` 兜底默认 `'geo'`，非法值回退——**不升 schemaVersion**（v2 存档读写兼容）。风格跟随存档（不是浏览器偏好）。 |
| M3 | **调参台常驻**（齿轮 + `?debug=1` + localStorage 可见性，P2 行为不变）；宽/高 = 滑条 + 数值输入**双向同步**；数值输入回车/失焦应用并钳制（宽 80–1400，高 80–800）；空白数值框显示 placeholder「自动」，但恢复跟随仍走「恢复跟随面板」按钮。 |
| M4 | **互动菜单**锚定被点宠物的舞台坐标（头顶上方，钳制不出界）；从头像条打开时锚定头像条上方。菜单项：摸一摸/看档案/锁定\|解锁/重命名/导出档案卡。点击宠物 = poke + 喵/汪气泡 + 打开菜单（三者并存）。同一时刻至多一个菜单；空白点击/Esc 关闭。 |
| M5 | **poke 修复**（P2 遗留 #1）：自由游走中的宠物被点击会先停下再跳；**引擎编排的移动**（directed：聚光灯上台/打飞/贴边/冲挤）不被 poke 打断。摸一摸 = stretch 动作 + 「好舒服～」气泡。 |
| M6 | **头像条**常驻底部居中：≤5 圆头像（当前风格迷你立绘 + portraitBox）；锁定 🔒、聚光灯持有者 👑（锁定且持有）角标；持有者头像金色描边。点击头像 = 打开该宠物菜单。 |
| M7 | **档案卡**：540×720，当前风格完整立绘离屏渲染（缩放 2.4，不受窗口档位影响）；内容 = 名字 / №编号（+⭐二世）/ 特征标签（耳·色·尾·配饰）/ 明细行（物种·体型·花纹·眼瞳）/ 性格 / 相遇日期 / 风格名。文件名 `档案卡_№<数字>_<名字>.png`。`photosTaken` 只统计合影（P4），档案卡**不**计入。 |
| M8 | **争宠基础版只作用于聚光灯档**：持有者必须是热情者（无热情者 → 舞台空置、全员贴边 = 冷场基础版；console 提示一次）。轮换 15s，**锁定持有者 30s 且徽章 👑**（仅锁定 🔒）。挑战者从热情者（≠现任）随机；编排 = 现任 roll + 「哇！」→ 退至边缘，挑战者走向中央，就位后 jump + 「看我！」。冷场的趴卧打盹/哈欠传染、淡定者上台、点名上台 = **P4**，不做。 |
| M9 | **拥挤/狭小档站位**：按到场时间排序，前 `slots` 只占格位；溢出者左右交替贴边（身体中心 x=22 起、每侧间隔 30，半身被舞台裁剪 = 探头）。**热情的溢出者**每 2–5s 随机发起一次冲挤（冲入内侧任意点，气泡「让我进去！」，到达后退回边缘，4–9s 后再来）；不热情者安静贴边。聚光灯档 = 持有者居中，其余全部贴边。宽裕/极小档保持 P2 均布行为。 |
| M10 | **全锁定暂停提示**：进入暂停态 toast 一次「小院已满，住满都是你锁定的宝贝」+ HUD 后缀「· 全锁定暂停中」；恢复后提示复位。 |
| M11 | **设置面板**：到访间隔（数值输入 10–1440 分钟，应用时钳制取整）+ 美术风格单选（来自注册表 `availableStyles()`）。应用即存档；风格切换 → 引擎 restyle + 头像条重绘 + toast。 |
| M12 | **统计面板**只读：总探望/连续/最长/累计打开/相遇总数/合影次数（P4 前恒 0）+ 最近探望日志 ≤10 条（倒序）。 |
| M13 | **UI 挂载层级**（全部在 `.py-stage` 内，坐标系与舞台一致）：zIndex — HUD 5 / 头像条 7 / 工具条 8 / 浮层面板 9 / 调参台 10 / 菜单 20 / toast 30 / 档案卡弹窗 40。 |
| M14 | 允许微调（记入报告）：keyframes 数值、贴边/间隔像素、dash 周期、菜单/面板 CSS。**不允许改**：坐标系、分层结构、状态机语义、档位/轮换时长常量语义、与 core 的接口、M1–M13 的规则。 |

---

## 2. CP1 — 美术风格注册表与 Settings 扩展

**`src/config.ts` 追加**（文件末尾）：

```ts
/** 聚光灯轮换周期（ms，需求 §3.7：约每 15 秒一次）。 */
export const ROTATE_MS = 15_000

/** 锁定宠物的聚光灯时长（ms，需求 §3.7：加倍 30s）。 */
export const ROTATE_LOCKED_MS = 30_000
```

**`src/core/types.ts` 精确编辑**：找到

```ts
export interface Settings {
  /** 到访间隔（分钟），P1 无 UI，恒为默认值。 */
  readonly spawnIntervalMin: number
}
```

替换为：

```ts
/** 立绘美术风格 id：'geo' 几何简笔（P2 形象转正）；'real' 预留给最终版美术。 */
export type ArtStyleId = 'geo' | 'real'

export interface Settings {
  /** 到访间隔（分钟）。 */
  readonly spawnIntervalMin: number
  /** 立绘美术风格（用户决策 #11；持久化于存档，M1/M2）。 */
  readonly artStyle: ArtStyleId
}
```

**`src/core/doc.ts` 精确编辑两处**：

① `createInitialDoc` 中的 `settings: { spawnIntervalMin: SPAWN_INTERVAL_DEFAULT_MIN },` 替换为：

```ts
    settings: { spawnIntervalMin: SPAWN_INTERVAL_DEFAULT_MIN, artStyle: 'geo' },
```

② `settingsOr` 整个函数替换为：

```ts
function settingsOr(v: unknown): Settings {
  if (typeof v !== 'object' || v === null) {
    return { spawnIntervalMin: SPAWN_INTERVAL_DEFAULT_MIN, artStyle: 'geo' }
  }
  const s = v as Record<string, unknown>
  return {
    spawnIntervalMin: numOr(s.spawnIntervalMin, SPAWN_INTERVAL_DEFAULT_MIN),
    artStyle: s.artStyle === 'real' ? 'real' : 'geo',
  }
}
```

**`src/client/render/styles.ts`**（新建，整文件）：

```ts
import type { ArtStyleId, Traits } from '../../core/types.ts'
import { petSpriteMarkup } from './petSprite.ts'

/** 一种美术风格的全部呈现参数（M1）。 */
export interface ArtStyle {
  readonly id: ArtStyleId
  readonly labelZh: string
  /** traits → sprite SVG 字符串（局部坐标系：脚底原点，V1）。 */
  render(traits: Traits, uid: string): string
  /** 头像/档案卡立绘裁剪框（SVG viewBox 的 x y w h）。 */
  readonly portraitBox: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
}

/** 几何简笔风：P2 占位形象转正为长期可选风格（用户决策 #11）。 */
export const GEO_STYLE: ArtStyle = {
  id: 'geo',
  labelZh: '几何简笔',
  render: petSpriteMarkup,
  portraitBox: { x: -50, y: -105, w: 100, h: 112 },
}

/** 已注册风格表；'real'（最终版美术）为预留 id，注册前不可选。 */
export const STYLE_REGISTRY: Readonly<Partial<Record<ArtStyleId, ArtStyle>>> = {
  geo: GEO_STYLE,
}

/** 可供用户选择的风格 = 已注册者（设置面板数据源，M11）。 */
export function availableStyles(): readonly ArtStyle[] {
  return Object.values(STYLE_REGISTRY).filter((s): s is ArtStyle => s !== undefined)
}

/** 按 id 取风格；未注册（含预留 'real'）回退 geo（M1）。 */
export function styleOf(id: ArtStyleId): ArtStyle {
  return STYLE_REGISTRY[id] ?? GEO_STYLE
}
```

**`tests/settings.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { createInitialDoc, migrate } from '../src/core/doc.ts'

const NOW = 1_700_000_000_000
const V2_BASE = {
  idCounter: 1, cycle: 1, pets: [], archive: [], usedCombos: [],
  stats: {}, settings: {}, lastSpawnAt: 1, createdAt: 1,
}

describe('Settings.artStyle（M2：加性字段，不升 schemaVersion）', () => {
  it('首档默认 geo', () => {
    expect(createInitialDoc(NOW).settings.artStyle).toBe('geo')
  })
  it('v2 旧档无 artStyle → 默认 geo', () => {
    expect(migrate({ ...V2_BASE, schemaVersion: 2 }, NOW).settings.artStyle).toBe('geo')
  })
  it('合法值保留（含预留 real）', () => {
    const doc = migrate({ ...V2_BASE, schemaVersion: 2, settings: { spawnIntervalMin: 30, artStyle: 'real' } }, NOW)
    expect(doc.settings.artStyle).toBe('real')
    const doc2 = migrate({ ...V2_BASE, schemaVersion: 2, settings: { artStyle: 'geo' } }, NOW)
    expect(doc2.settings.artStyle).toBe('geo')
  })
  it('非法值回退 geo', () => {
    const doc = migrate({ ...V2_BASE, schemaVersion: 2, settings: { artStyle: 'weird' } }, NOW)
    expect(doc.settings.artStyle).toBe('geo')
  })
})
```

**`tests/styles.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { petSpriteMarkup } from '../src/client/render/petSprite.ts'
import { GEO_STYLE, STYLE_REGISTRY, availableStyles, styleOf } from '../src/client/render/styles.ts'
import type { Traits } from '../src/core/types.ts'

const TRAITS: Traits = {
  species: 'cat', body: 'round', ears: 'fold', fur: 'cow',
  pattern: 'spots', tail: 'fluffy', eyes: 'odd', accessory: 'bell',
}

describe('美术风格注册表（M1）', () => {
  it('geo 已注册且渲染等价 petSpriteMarkup', () => {
    expect(STYLE_REGISTRY.geo).toBe(GEO_STYLE)
    expect(GEO_STYLE.render(TRAITS, 'u1')).toBe(petSpriteMarkup(TRAITS, 'u1'))
  })
  it('未注册 id（预留 real）回退 geo', () => {
    expect(styleOf('real')).toBe(GEO_STYLE)
    expect(styleOf('geo')).toBe(GEO_STYLE)
  })
  it('可选风格 = 已注册风格，带中文名与合法裁剪框', () => {
    const list = availableStyles()
    expect(list.map(s => s.id)).toContain('geo')
    expect(list.map(s => s.id)).not.toContain('real')
    for (const s of list) {
      expect(s.labelZh.length).toBeGreaterThan(0)
      expect(s.portraitBox.w).toBeGreaterThan(0)
      expect(s.portraitBox.h).toBeGreaterThan(0)
    }
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/settings.spec.ts tests/styles.spec.ts tests/doc.spec.ts` 全绿（既有 doc.spec 不受影响——settings 为加性字段，往返两侧同源）。

---

## 3. CP2 — 卖萌动作集与全部 P3 样式

**`src/client/stage/actions.ts`**（**整文件覆写**；结构沿用 P2，新增五式卖萌动作 + P3 全部 UI 样式）：

```ts
import type { Personality } from '../../core/types.ts'

export type ActionName =
  | 'idle' | 'walk' | 'jump' | 'roll' | 'sit' | 'sleep' | 'wave' | 'flatten'
  | 'spin' | 'tail' | 'stretch' | 'lick' | 'tilt'

/** 可被日常调度选中的动作（wave/flatten 由引擎指令触发，不参与随机）。 */
export type ScheduledAction =
  | 'idle' | 'walk' | 'jump' | 'roll' | 'sit' | 'sleep'
  | 'spin' | 'tail' | 'stretch' | 'lick' | 'tilt'

/** 动作时长（ms，[min, max]；walk 由移动驱动，时长无效）。 */
export const ACTION_DURATION: Record<ActionName, readonly [number, number]> = {
  idle: [1600, 3200],
  walk: [0, 0],
  jump: [900, 900],
  roll: [1100, 1100],
  sit: [4000, 8000],
  sleep: [8000, 14000],
  wave: [1600, 1600],
  flatten: [600, 600],
  spin: [1000, 1000],
  tail: [1400, 1400],
  stretch: [1600, 1600],
  lick: [1200, 1200],
  tilt: [900, 900],
}

/** 日常动作的性格权重（需求 §3.7：热情者更爱蹦跳转圈，高冷更常舔毛打盹）。 */
export const ACTION_WEIGHTS: Record<ScheduledAction, Record<Personality, number>> = {
  idle: { eager: 2, calm: 3, aloof: 3 },
  walk: { eager: 4, calm: 3, aloof: 2 },
  jump: { eager: 4, calm: 2, aloof: 1 },
  roll: { eager: 3, calm: 2, aloof: 1 },
  sit: { eager: 1, calm: 3, aloof: 3 },
  sleep: { eager: 1, calm: 2, aloof: 4 },
  spin: { eager: 3, calm: 1, aloof: 1 },
  tail: { eager: 3, calm: 1, aloof: 0 },
  stretch: { eager: 2, calm: 2, aloof: 2 },
  lick: { eager: 1, calm: 2, aloof: 3 },
  tilt: { eager: 2, calm: 2, aloof: 1 },
}

/** 按性格权重随机挑一个日常动作（视觉随机，用 Math.random，非领域推导）。 */
export function pickAction(personality: Personality): ScheduledAction {
  const entries = Object.keys(ACTION_WEIGHTS) as ScheduledAction[]
  const total = entries.reduce((sum, key) => sum + ACTION_WEIGHTS[key][personality], 0)
  let roll = Math.random() * total
  for (const key of entries) {
    roll -= ACTION_WEIGHTS[key][personality]
    if (roll <= 0) return key
  }
  return 'idle'
}

/** 场景样式，幂等注入单个 style 标签（V6，对齐 DSH 的 data-plugin 约定）。 */
export function ensureStageStyles(): void {
  if (document.querySelector('style[data-plugin="dsh-plugin-pet"]') !== null) return
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-plugin-pet'
  style.textContent = STAGE_CSS
  document.head.appendChild(style)
}

const STAGE_CSS = `
.py-stage { position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none; background: #dcecf5; font-family: system-ui, sans-serif; }
.py-stage > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.py-sky { fill: #dcecf5; }
.py-grass { fill: #c4e0b8; }
.py-pet { cursor: pointer; transition: opacity 0.6s ease; }
.py-name { font-size: 11px; fill: #5a4f44; text-anchor: middle; paint-order: stroke; stroke: rgba(255,255,255,0.8); stroke-width: 3px; }
.py-badge { font-size: 13px; text-anchor: middle; }
.py-zzz { font-size: 12px; font-weight: 600; fill: #7a8fa8; display: none; }
.py-pet.is-sleeping .py-zzz { display: block; animation: py-zzz 2.4s linear infinite; }
.py-bubble { opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease; transform: translateY(4px); pointer-events: none; }
.py-bubble.show { opacity: 1; transform: translateY(0); }
.py-bubble-bg { fill: #fffdf8; stroke: #d8c9b8; stroke-width: 1; }
.py-bubble-text { font-size: 12px; fill: #4a3f35; text-anchor: middle; }
.py-action { transform-box: fill-box; transform-origin: 50% 100%; }
.py-idle { animation: py-idle 2.6s ease-in-out infinite; }
.py-walk { animation: py-walk 0.4s ease-in-out infinite; }
.py-jump { animation: py-jump 0.9s ease-in-out; }
.py-roll { animation: py-roll 1.1s ease-in-out; }
.py-sit { animation: py-sit 0.35s ease-out forwards; }
.py-sleep { animation: py-sleep 3s ease-in-out infinite; }
.py-wave { animation: py-wave 0.8s ease-in-out 2; }
.py-flatten { animation: py-flatten 0.4s ease-out forwards; }
.py-spin { animation: py-spin 1s linear; }
.py-tail { animation: py-tail 0.35s ease-in-out 4; }
.py-stretch { animation: py-stretch 1.6s ease-in-out; }
.py-lick { animation: py-lick 1.2s ease-in-out; }
.py-tilt { animation: py-tilt 0.9s ease-in-out; }
@keyframes py-idle { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.97); } }
@keyframes py-walk { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes py-jump { 0%, 100% { transform: translateY(0); } 35% { transform: translateY(-34px); } 45% { transform: translateY(-28px); } 60% { transform: translateY(-38px); } }
@keyframes py-roll { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
@keyframes py-sit { from { transform: scaleY(1); } to { transform: scaleY(0.86) translateY(4px); } }
@keyframes py-sleep { 0%, 100% { transform: scaleY(0.9); } 50% { transform: scaleY(0.85); } }
@keyframes py-wave { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
@keyframes py-flatten { from { transform: scale(1, 1); } to { transform: scale(1.5, 0.3); } }
@keyframes py-spin { to { transform: rotate(360deg); } }
@keyframes py-tail { 0%, 100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }
@keyframes py-stretch { 0%, 100% { transform: scale(1, 1); } 45% { transform: scale(1.16, 0.82); } }
@keyframes py-lick { 0%, 100% { transform: translateY(0) rotate(0deg); } 40% { transform: translateY(3px) rotate(-6deg); } 70% { transform: translateY(1px) rotate(4deg); } }
@keyframes py-tilt { 0%, 100% { transform: rotate(0deg); } 45% { transform: rotate(-14deg); } }
@keyframes py-zzz { 0% { opacity: 0; transform: translate(0, 0); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(10px, -20px); } }
.py-hud { position: absolute; top: 8px; left: 10px; padding: 3px 10px; border-radius: 999px; background: rgba(255,253,248,0.85); border: 1px solid #d8c9b8; color: #6b5b4d; font-size: 12px; pointer-events: none; z-index: 5; }
.py-toolbar { position: absolute; top: 8px; right: 8px; z-index: 8; display: flex; gap: 6px; }
.py-toolbar button { width: 28px; height: 28px; border-radius: 8px; border: 1px solid #c9b8a5; background: rgba(255,253,248,0.9); cursor: pointer; font-size: 14px; }
.py-toolbar button:hover { background: #fff; }
.py-panel { position: absolute; top: 44px; right: 8px; z-index: 9; width: 264px; max-height: 72%; overflow: auto; background: #fffdf8; border: 1px solid #d8c9b8; border-radius: 12px; padding: 12px; font-size: 13px; color: #4a3f35; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.py-panel h3 { margin: 8px 0 6px; font-size: 14px; }
.py-panel h3:first-of-type { margin-top: 0; }
.py-panel .row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; gap: 6px; }
.py-panel .log { color: #8a7a66; font-size: 12px; padding: 1px 0; }
.py-panel button { font-size: 13px; padding: 3px 10px; border-radius: 7px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-panel input[type='number'] { width: 72px; padding: 2px 4px; border: 1px solid #c9b8a5; border-radius: 6px; font-size: 13px; }
.py-panel label.row { cursor: pointer; }
.py-close { position: absolute; top: 6px; right: 8px; border: none; background: none; cursor: pointer; font-size: 14px; color: #8a7a66; }
.py-avatarbar { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 7; display: flex; gap: 8px; }
.py-avatar { position: relative; width: 44px; height: 44px; border-radius: 50%; border: 2px solid #d8c9b8; background: #fffdf8; cursor: pointer; padding: 0; overflow: hidden; }
.py-avatar:hover { border-color: #e8964f; }
.py-avatar.holder-ring { border-color: #e8b93c; }
.py-avatar svg { width: 100%; height: 100%; display: block; }
.py-avatar .mark { position: absolute; right: -1px; top: -3px; font-size: 13px; }
.py-menu { position: absolute; z-index: 20; background: #fffdf8; border: 1px solid #d8c9b8; border-radius: 10px; padding: 6px; display: flex; flex-direction: column; gap: 4px; min-width: 122px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
.py-menu button { border: 1px solid #e5d9c9; background: #fff; border-radius: 7px; padding: 5px 10px; font-size: 13px; cursor: pointer; color: #4a3f35; text-align: left; }
.py-menu button:hover { background: #f7efe3; }
.py-menu input { font-size: 13px; padding: 4px 6px; border: 1px solid #c9b8a5; border-radius: 6px; width: 110px; }
.py-toast { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); z-index: 30; background: rgba(74,63,53,0.92); color: #fff; border-radius: 999px; padding: 5px 14px; font-size: 12px; pointer-events: none; white-space: nowrap; animation: py-toast-in 0.25s ease; }
@keyframes py-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(-6px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
.py-card-modal { position: absolute; inset: 0; z-index: 40; background: rgba(58,46,38,0.35); display: flex; align-items: center; justify-content: center; }
.py-card-modal .inner { background: #fffdf8; border-radius: 14px; padding: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.25); text-align: center; }
.py-card-modal svg { width: min(70%, 378px); height: auto; border-radius: 10px; display: block; }
.py-card-modal .acts { margin-top: 8px; display: flex; gap: 8px; justify-content: center; }
.py-card-modal button { font-size: 13px; padding: 5px 14px; border-radius: 8px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-debug { position: absolute; top: 8px; right: 78px; z-index: 10; background: #fffdf8; border: 1px solid #d8c9b8; border-radius: 10px; padding: 8px; font-size: 12px; color: #4a3f35; display: flex; flex-direction: column; gap: 6px; max-width: 250px; }
.py-debug-title { font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
.py-debug-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.py-debug button { font-size: 12px; padding: 3px 8px; border-radius: 6px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-debug input[type='range'] { width: 80px; }
.py-debug input[type='number'] { width: 52px; }
`
```

> 注意：`.py-debug` 的 `right` 从 8px 改为 78px——给右上工具条（宽约 62px + 8px 边距）让位（M13 层级）。

**验证**：`npm run typecheck`（actions 的消费方 actor/engine 尚用旧签名——新 union 是超集，兼容）。

---

## 4. CP3 — Actor 公共 API 与聚光灯状态机

**`src/client/stage/actor.ts`**（**整文件覆写**；基于当前实现 + M5 修复 + 公共 API）：

```ts
import type { Pet } from '../../core/types.ts'
import { personalityOf } from '../../core/traits.ts'
import { WALK_SPEED } from '../../config.ts'
import { petSpriteMarkup } from '../render/petSprite.ts'
import { bodyGeom } from '../render/parts.ts'
import { ACTION_DURATION, pickAction, type ActionName } from './actions.ts'
import { svgEl } from './svgDom.ts'

export interface ActorContext {
  readonly width: number
  readonly groundY: number
  readonly flatten: boolean
}

type ActorState = 'entering' | 'active' | 'exiting'

const MARGIN = 70

/**
 * 单只宠物的舞台呈现（V2/V4/V9）：位置层 CSS translate、朝向层 scaleX、
 * 动作层 keyframes；每帧只写 transform 与 class。
 * P3 新增：directed 移动标记（引擎编排的移动不被 poke 打断，M5）、
 * 公共动作/徽章/立绘接口（争宠编排与风格切换，M1/M8）。
 */
export class PetActor {
  readonly root: SVGGElement
  pet: Pet

  private readonly facingEl: SVGGElement
  private readonly actionEl: SVGGElement
  private readonly nameEl: SVGTextElement
  private readonly badgeEl: SVGTextElement
  private readonly bubbleAnchor: SVGGElement
  private readonly bubbleEl: SVGGElement
  private readonly bubbleRect: SVGRectElement
  private readonly bubbleText: SVGTextElement

  private x: number
  private targetX: number
  private directed = false
  private facing: 1 | -1 = 1
  private state: ActorState
  private action: ActionName = 'idle'
  private actionTimer = 0
  private bubbleTimer = 0
  private exitPhase = 0
  private exitTimer = 0
  private done = false
  private wasFlatten = false
  private lastWidth = 0

  constructor(pet: Pet, startX: number, initialFadeIn: boolean) {
    this.pet = pet
    this.x = startX
    this.targetX = startX
    this.state = initialFadeIn ? 'active' : 'entering'
    this.root = svgEl('g', { class: 'py-pet', 'data-id': pet.id })
    if (initialFadeIn) {
      this.root.style.opacity = '0'
      requestAnimationFrame(() => { this.root.style.opacity = '1' })
    }
    // 注意 V3：气泡双层——外层属性 transform 定位，内层 CSS 动画
    this.root.innerHTML = [
      '<g class="py-facing"><g class="py-action py-idle"></g></g>',
      '<text class="py-name" y="16"></text>',
      '<g class="py-bubble-anchor"><g class="py-bubble">',
      '<rect class="py-bubble-bg" x="0" y="0" width="0" height="0" rx="8"/>',
      '<text class="py-bubble-text" x="0" y="0"></text>',
      '</g></g>',
      '<text class="py-zzz" x="22" y="-76">Z z z</text>',
      '<text class="py-badge" x="-30" y="-64" style="display:none"></text>',
    ].join('')
    this.facingEl = this.root.querySelector<SVGGElement>('.py-facing')!
    this.actionEl = this.root.querySelector<SVGGElement>('.py-action')!
    this.nameEl = this.root.querySelector<SVGTextElement>('.py-name')!
    this.bubbleAnchor = this.root.querySelector<SVGGElement>('.py-bubble-anchor')!
    this.bubbleEl = this.root.querySelector<SVGGElement>('.py-bubble')!
    this.bubbleRect = this.root.querySelector<SVGRectElement>('.py-bubble-bg')!
    this.bubbleText = this.root.querySelector<SVGTextElement>('.py-bubble-text')!
    this.badgeEl = this.root.querySelector<SVGTextElement>('.py-badge')!
    this.actionEl.innerHTML = petSpriteMarkup(pet.traits, pet.id)
    this.nameEl.textContent = pet.name
    if (initialFadeIn) this.scheduleNext()
  }

  /** 引擎移动指令；directed=true 表示编排移动（poke 不打断，M5）。 */
  setTarget(x: number, directed = false): void {
    this.targetX = x
    this.directed = directed
  }

  isExiting(): boolean {
    return this.state === 'exiting'
  }

  isDone(): boolean {
    return this.done
  }

  atTarget(): boolean {
    return Math.abs(this.targetX - this.x) <= 2
  }

  getX(): number {
    return this.x
  }

  /** 引擎指令：跳一下。自由游走中的宠物会先停下再跳（P2 遗留 #1，M5）。 */
  poke(): void {
    if (this.state !== 'active' || this.action === 'flatten') return
    if (this.action === 'walk' && !this.directed) this.targetX = this.x
    this.playAction('jump')
  }

  /** 引擎指令：播放指定动作（争宠编排用，M8）。 */
  performAction(name: ActionName): void {
    if (this.state !== 'exiting') this.playAction(name)
  }

  /** 徽章由引擎统一刷新：'' 无 / '🔒' 锁定 / '👑' 锁定且聚光灯持有（M6/M8）。 */
  setBadge(text: string): void {
    this.badgeEl.textContent = text
    this.badgeEl.style.display = text === '' ? 'none' : ''
  }

  /** 更换立绘（美术风格切换，M1/M11）。 */
  setSpriteMarkup(markup: string): void {
    this.actionEl.innerHTML = markup
  }

  updatePet(pet: Pet): void {
    this.pet = pet
    this.nameEl.textContent = pet.name
  }

  /** 开始离场（V9）：挥手 1.6s → 走向最近边缘 ≤4s → 渐隐 0.7s → done。 */
  beginExit(): void {
    if (this.state === 'exiting') return
    this.state = 'exiting'
    this.exitPhase = 1
    this.exitTimer = 1600
    this.playAction('wave')
    this.bubbleEl.classList.remove('show')
    this.bubbleTimer = 0
  }

  showBubble(text: string, ms = 3000): void {
    this.bubbleText.textContent = text
    this.bubbleEl.classList.add('show')
    this.bubbleTimer = ms
    const box = this.bubbleText.getBBox()
    const w = box.width + 22
    const h = 28
    const top = -(2 * bodyGeom(this.pet.traits.body).ry) - 14
    this.bubbleRect.setAttribute('x', String(-w / 2))
    this.bubbleRect.setAttribute('y', String(-h))
    this.bubbleRect.setAttribute('width', String(w))
    this.bubbleRect.setAttribute('height', String(h))
    this.bubbleText.setAttribute('y', String(-h + 18))
    this.bubbleAnchor.setAttribute('transform', `translate(0, ${top})`)
  }

  update(dt: number, ctx: ActorContext): void {
    this.lastWidth = ctx.width

    // 出场时间线
    if (this.state === 'exiting') {
      this.exitTimer -= dt
      if (this.exitPhase === 1 && this.exitTimer <= 0) {
        this.exitPhase = 2
        this.exitTimer = 4000
        this.targetX = this.x < ctx.width / 2 ? -MARGIN : ctx.width + MARGIN
      } else if (this.exitPhase === 2 && (Math.abs(this.targetX - this.x) <= 3 || this.exitTimer <= 0)) {
        this.exitPhase = 3
        this.exitTimer = 700
        this.root.style.opacity = '0'
      } else if (this.exitPhase === 3 && this.exitTimer <= 0) {
        this.done = true
      }
    }

    // 矮窗躺平覆盖（最高优先级形态；V10）
    if (ctx.flatten) {
      this.wasFlatten = true
      if (this.action !== 'flatten') this.playAction('flatten')
    } else if (this.wasFlatten) {
      this.wasFlatten = false
      if (this.state === 'active') this.scheduleNext()
    }

    // 移动（walking 动画由移动自动触发）
    const dx = this.targetX - this.x
    if (Math.abs(dx) > 2) {
      const step = Math.min(Math.abs(dx), (WALK_SPEED * dt) / 1000)
      this.x += Math.sign(dx) * step
      this.setFacing(dx > 0 ? 1 : -1)
      if (this.action !== 'walk' && this.action !== 'flatten') this.playAction('walk')
    } else if (this.action === 'walk') {
      if (this.state === 'entering') {
        this.state = 'active'
        this.scheduleNext()
      } else if (this.state === 'active') {
        this.scheduleNext()
      }
    }

    // 动作计时（仅活跃态；walk 由移动驱动）
    if (this.state === 'active' && this.action !== 'walk' && !ctx.flatten && this.actionTimer > 0) {
      this.actionTimer -= dt
      if (this.actionTimer <= 0) this.scheduleNext()
    }

    // 气泡计时
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt
      if (this.bubbleTimer <= 0) this.bubbleEl.classList.remove('show')
    }

    this.root.style.transform = `translate(${this.x}px, ${ctx.groundY}px)`
  }

  private playAction(name: ActionName): void {
    this.action = name
    this.actionEl.setAttribute('class', `py-action py-${name}`)
    const [min, max] = ACTION_DURATION[name]
    this.actionTimer = min === max ? min : min + Math.random() * (max - min)
    this.root.classList.toggle('is-sleeping', name === 'sleep')
  }

  /** 挑下一个日常动作；walk = 在当前槽位附近游走（自由移动，M5）。 */
  private scheduleNext(): void {
    const next = pickAction(personalityOf(this.pet.passion))
    if (next === 'walk') {
      // 舞台宽度未知（首帧前）时退化为待机，避免游走目标被钳到边缘
      if (this.lastWidth <= 2 * MARGIN) {
        this.playAction('idle')
        return
      }
      const direction = Math.random() < 0.5 ? -1 : 1
      const distance = 30 + Math.random() * 70
      const maxX = Math.max(MARGIN, this.lastWidth - MARGIN)
      this.targetX = Math.min(Math.max(this.targetX + direction * distance, MARGIN), maxX)
      this.directed = false
    } else {
      this.playAction(next)
    }
  }

  private setFacing(dir: 1 | -1): void {
    if (this.facing === dir) return
    this.facing = dir
    this.facingEl.style.transform = dir === 1 ? '' : 'scaleX(-1)'
  }
}
```

> 变更点清单（对照 P2 版）：`directed` 字段与 `setTarget` 第二参；`poke` 停走逻辑；`performAction/atTarget/getX/setBadge/setSpriteMarkup` 公共方法；构造器徽章初始隐藏（引擎统一刷新）；`updatePet` 不再直接写徽章；`scheduleNext` 游走分支清除 directed。

**`src/client/stage/spotlight.ts`**（新建，整文件；**纯逻辑零 DOM，可单测**）：

```ts
import type { Tier } from './tiers.ts'

/** 聚光灯决策所需的最小宠物切片（M8）。 */
export interface SpotlightPet {
  readonly id: string
  readonly passion: number
  readonly locked: boolean
  readonly arrivedAt: number
}

export type SpotlightEvent =
  | { readonly type: 'appoint'; readonly petId: string }
  | { readonly type: 'vacant' }
  | { readonly type: 'challenge'; readonly challengerId: string; readonly previousHolderId: string }

export interface SpotlightOptions {
  readonly rotateMs: number
  readonly rotateLockedMs: number
}

/** 热情阈值（与 core/traits.personalityOf 一致；本地复述避免反向依赖）。 */
const EAGER_PASSION = 60

/**
 * 聚光灯轮换状态机（M8，纯逻辑）：只在 spotlight 档活动。
 * 持有者必须热情；无热情者 → 舞台空置（冷场基础版，事件只发一次）。
 * 轮换 15s，锁定持有者 30s；挑战者从热情者（≠现任）中随机。
 */
export class SpotlightMachine {
  private holderId: string | null = null
  private endsAt = 0
  private vacantAnnounced = false

  constructor(private readonly opts: SpotlightOptions) {}

  getHolder(): string | null {
    return this.holderId
  }

  /** 引擎每帧调用；返回的事件由引擎编排动画。 */
  tick(pets: readonly SpotlightPet[], tier: Tier, now: number): readonly SpotlightEvent[] {
    if (tier !== 'spotlight') {
      this.holderId = null
      this.vacantAnnounced = false
      return []
    }
    if (this.holderId !== null && !pets.some(p => p.id === this.holderId)) {
      this.holderId = null
    }
    if (this.holderId === null) {
      const eager = pets.filter(p => p.passion >= EAGER_PASSION)
      const candidate = eager.slice().sort((a, b) => a.arrivedAt - b.arrivedAt)[0]
      if (candidate === undefined) {
        if (!this.vacantAnnounced) {
          this.vacantAnnounced = true
          return [{ type: 'vacant' }]
        }
        return []
      }
      this.holderId = candidate.id
      this.endsAt = now + this.durationOf(candidate)
      this.vacantAnnounced = false
      return [{ type: 'appoint', petId: candidate.id }]
    }
    if (now < this.endsAt) return []
    const holder = pets.find(p => p.id === this.holderId) ?? null
    const challengers = pets.filter(p => p.passion >= EAGER_PASSION && p.id !== this.holderId)
    if (challengers.length === 0) {
      // 没有别的热情者：续期（独占舞台者溜达再杀回马枪属 P4）
      if (holder !== null) this.endsAt = now + this.durationOf(holder)
      return []
    }
    const challenger = challengers[Math.floor(Math.random() * challengers.length)]!
    const previousHolderId = this.holderId
    this.holderId = challenger.id
    this.endsAt = now + this.durationOf(challenger)
    return [{ type: 'challenge', challengerId: challenger.id, previousHolderId }]
  }

  private durationOf(pet: SpotlightPet): number {
    return pet.locked ? this.opts.rotateLockedMs : this.opts.rotateMs
  }
}
```

**`tests/spotlight.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { SpotlightMachine, type SpotlightPet } from '../src/client/stage/spotlight.ts'

const OPTS = { rotateMs: 15_000, rotateLockedMs: 30_000 }
const T0 = 1_000_000

function petOf(id: string, passion: number, locked = false, arrivedAt = 0): SpotlightPet {
  return { id, passion, locked, arrivedAt }
}

describe('聚光灯状态机（M8）', () => {
  it('非聚光灯档：不活动且无事件', () => {
    const m = new SpotlightMachine(OPTS)
    expect(m.tick([petOf('a', 80)], 'roomy', T0)).toEqual([])
    expect(m.getHolder()).toBeNull()
  })

  it('任命到场最早的热情者', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('b', 80, false, 20), petOf('a', 90, false, 10), petOf('c', 10)]
    expect(m.tick(pets, 'spotlight', T0)).toEqual([{ type: 'appoint', petId: 'a' }])
    expect(m.getHolder()).toBe('a')
  })

  it('无热情者：仅一次 vacant，舞台空置', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 10), petOf('b', 50)]
    expect(m.tick(pets, 'spotlight', T0)).toEqual([{ type: 'vacant' }])
    expect(m.tick(pets, 'spotlight', T0 + 9999)).toEqual([])
    expect(m.getHolder()).toBeNull()
  })

  it('轮换到期：唯一热情挑战者顶替现任', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 70, false, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 14_999)).toEqual([])
    const ev = m.tick(pets, 'spotlight', T0 + 15_000)
    expect(ev).toEqual([{ type: 'challenge', challengerId: 'b', previousHolderId: 'a' }])
    expect(m.getHolder()).toBe('b')
  })

  it('锁定持有者时长 30s（15s 时未轮换）', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, true, 10), petOf('b', 70, false, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 15_000)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 29_999)).toEqual([])
    expect(m.tick(pets, 'spotlight', T0 + 30_000)[0]?.type).toBe('challenge')
  })

  it('没有其他热情者：到期续期不轮换', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 30)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick(pets, 'spotlight', T0 + 60_000)).toEqual([])
    expect(m.getHolder()).toBe('a')
  })

  it('持有者离场：立即重新任命', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90, false, 10), petOf('b', 70, false, 20)]
    m.tick(pets, 'spotlight', T0)
    expect(m.tick([pets[1]!], 'spotlight', T0 + 100)).toEqual([{ type: 'appoint', petId: 'b' }])
  })

  it('离开聚光灯档后重置，重进重新任命', () => {
    const m = new SpotlightMachine(OPTS)
    const pets = [petOf('a', 90)]
    m.tick(pets, 'spotlight', T0)
    m.tick(pets, 'crowded', T0 + 1)
    expect(m.getHolder()).toBeNull()
    expect(m.tick(pets, 'spotlight', T0 + 2)).toEqual([{ type: 'appoint', petId: 'a' }])
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/spotlight.spec.ts` 全绿。

---

## 5. CP4 — 引擎重写（档位感知站位与争宠编排）

**`src/client/stage/engine.ts`**（**整文件覆写**）：

```ts
import { FLATTEN_H, ROTATE_LOCKED_MS, ROTATE_MS, SPAWN_CHECK_MS } from '../../config.ts'
import { personalityOf } from '../../core/traits.ts'
import type { ArtStyleId, Pet } from '../../core/types.ts'
import { styleOf } from '../render/styles.ts'
import { ensureStageStyles, type ActionName } from './actions.ts'
import { PetActor, type ActorContext } from './actor.ts'
import { SpotlightMachine, type SpotlightEvent } from './spotlight.ts'
import { svgEl } from './svgDom.ts'
import { computeTier, slotsFor, type Tier } from './tiers.ts'

export interface EngineOptions {
  readonly onPetClick?: (petId: string) => void
  readonly onPetEntered?: (petId: string) => void
  readonly onSpawnCheck?: (now: number) => void
  readonly onTierChanged?: (tier: Tier, prev: Tier) => void
  readonly onHolderChanged?: (petId: string | null) => void
}

const MARGIN = 70
/** 贴边探头：最外侧身体中心（半身被舞台裁剪，M9）。 */
const EDGE_X = 22
/** 同侧贴边间隔。 */
const EDGE_GAP = 30

/**
 * 舞台引擎（V7/V8 + M8/M9）：纯视图层。消费 Pet 快照（syncPets diff），
 * rAF 驱动 Actor；ResizeObserver → 档位/矮窗评估 → 档位感知站位；
 * 聚光灯状态机决定轮换，引擎负责移动/动作编排。
 */
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
      for (const actor of this.actors) actor.update(dt, ctx)
      // V9：离场完成的 actor 移除 DOM 节点（渐隐 → 移除）
      this.actors = this.actors.filter(actor => {
        if (!actor.isDone()) return true
        actor.root.remove()
        return false
      })
      this.runSpotlight()
      this.updateStrut()
      this.updateDash()
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

  /** 宠物的舞台坐标（菜单锚点用，M4）；不在场返回 null。 */
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

  /** 切换全体立绘（美术风格，M1/M11）。 */
  restyle(styleId: ArtStyleId): void {
    this.styleId = styleId
    const style = styleOf(styleId)
    for (const actor of this.actors) actor.setSpriteMarkup(style.render(actor.pet.traits, actor.pet.id))
  }

  /** debug 调参：null = 跟随面板（V13）。 */
  setDebugSize(w: number | null, h: number | null): void {
    this.stageDiv.style.width = w === null ? '100%' : `${w}px`
    this.stageDiv.style.height = h === null ? '100%' : `${h}px`
  }

  /**
   * 快照 diff（V7）：新增 → 入场（或 initial 模式原位淡入）；
   * 消失 → 离场；其余 → 刷新名字。
   */
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

  /** 左右交替贴边目标位（每侧由外向内排开，M9）。 */
  private edgeTargets(count: number): number[] {
    const pos: number[] = []
    let li = 0
    let ri = 0
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) pos.push(EDGE_X + (li++) * EDGE_GAP)
      else pos.push(this.w - EDGE_X - (ri++) * EDGE_GAP)
    }
    return pos
  }

  /** 档位感知站位（M9）：离场中 actor 不占槽（V9）。 */
  private assignSlots(): void {
    const active = this.actors.filter(actor => !actor.isExiting())
    const sorted = [...active].sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    const slots = slotsFor(this.w)
    this.overflowIds.clear()

    if (this.tier === 'spotlight') {
      const holderId = this.spotlight.getHolder()
      const edges = this.edgeTargets(Math.max(0, sorted.length - (holderId === null ? 0 : 1)))
      let edgeIndex = 0
      for (const actor of sorted) {
        if (actor.pet.id === holderId) {
          actor.setTarget(this.w / 2, true)
        } else {
          actor.setTarget(edges[edgeIndex++] ?? EDGE_X, true)
          this.overflowIds.add(actor.pet.id)
        }
      }
      return
    }

    if (slots === 0 || slots >= sorted.length) {
      sorted.forEach((actor, index) => actor.setTarget(this.slotX(index, sorted.length), true))
      return
    }

    const edges = this.edgeTargets(sorted.length - slots)
    sorted.forEach((actor, index) => {
      if (index < slots) {
        actor.setTarget(this.slotX(index, slots), true)
      } else {
        actor.setTarget(edges[index - slots] ?? EDGE_X, true)
        this.overflowIds.add(actor.pet.id)
      }
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
      // P2 基础即时反应：热情宠物惊跳一下（全量反应 P4）
      for (const actor of this.actors) {
        if (!actor.isExiting() && personalityOf(actor.pet.passion) === 'eager') actor.poke()
      }
      this.assignSlots()
    }
    const flatten = this.h > 0 && this.h < FLATTEN_H
    if (flatten !== this.flatten) {
      this.flatten = flatten
      console.info(`[pet-yard] flatten: ${flatten ? 'on' : 'off'}`)
    }
  }

  // ---- 聚光灯（M8） ----

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
      console.info('[pet-yard] spotlight: 没有热情的宝贝，舞台空着（冷场基础版）')
      this.assignSlots()
    } else {
      const prev = this.actors.find(a => a.pet.id === ev.previousHolderId)
      const next = this.actors.find(a => a.pet.id === ev.challengerId)
      if (prev !== undefined && !prev.isExiting()) {
        prev.performAction('roll')
        prev.showBubble('哇！', 1600)
      }
      if (next !== undefined && !next.isExiting()) {
        next.setTarget(this.w / 2, true)
        this.strutPending.add(ev.challengerId)
      }
      console.info(`[pet-yard] spotlight: ${ev.challengerId} 顶替 ${ev.previousHolderId}`)
      this.assignSlots()
    }
  }

  /** 挑战者就位后的臭美（M8）；档位已离开聚光灯则取消待演。 */
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

  /** 拥挤/狭小档的热情溢出者冲挤（M9）。 */
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
        actor.setTarget(60 + Math.random() * Math.max(60, this.w - 120), true)
        actor.showBubble('让我进去！', 1500)
      }
    }
  }

  /** 徽章统一刷新（M6/M8）：🔒 锁定；👑 锁定且聚光灯持有。 */
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

**验证**：`npm run typecheck`。变更点对照 P2 版：新增 spotlight/overflow/dash/strut 字段与三个私有方法、`assignSlots` 档位感知重写、`evalTier` 档位变化时重排站位、`getStageEl/getStageSize/getHolderId/getPetPos/performAction/restyle` 公共方法、`syncPets` 创建 actor 后按当前风格设置立绘、DOM 移除/入场/反应逻辑保持。

---

## 6. CP5 — UI 模块：toast、互动菜单、头像条

**`src/client/ui/toast.ts`**（新建，整文件）：

```ts
/** 顶部 toast（M10/M11）：同一时刻至多一条。 */
export function showToast(stage: HTMLElement, text: string, ms = 2500): void {
  for (const el of stage.querySelectorAll('.py-toast')) el.remove()
  const toast = document.createElement('div')
  toast.className = 'py-toast'
  toast.textContent = text
  stage.appendChild(toast)
  window.setTimeout(() => toast.remove(), ms)
}
```

**`src/client/ui/interactMenu.ts`**（新建，整文件）：

```ts
export interface MenuPetInfo {
  readonly id: string
  readonly name: string
  readonly locked: boolean
}

export interface InteractMenuHandlers {
  readonly onPet: (petId: string) => void
  readonly onCard: (petId: string) => void
  readonly onToggleLock: (petId: string) => void
  readonly onRename: (petId: string, name: string) => void
  readonly onExport: (petId: string) => void
}

export interface MenuAnchor {
  readonly x: number
  readonly y: number
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 互动菜单（M4）：锚点为舞台坐标，菜单置于锚点上方并钳制不出界；
 * 同一时刻至多一个；空白点击 / Esc 关闭。
 */
export function openInteractMenu(
  stage: HTMLElement,
  pet: MenuPetInfo,
  anchor: MenuAnchor,
  handlers: InteractMenuHandlers,
): void {
  closeInteractMenu(stage)
  const menu = document.createElement('div')
  menu.className = 'py-menu'
  const btn = (act: string, label: string): string =>
    `<button type="button" data-act="${act}">${label}</button>`
  menu.innerHTML = [
    btn('pet', '摸一摸'),
    btn('card', '看档案'),
    btn('lock', pet.locked ? '解锁' : '锁定'),
    btn('rename', '重命名'),
    btn('export', '导出档案卡'),
  ].join('')

  menu.style.visibility = 'hidden'
  stage.appendChild(menu)
  const rect = stage.getBoundingClientRect()
  const mw = menu.offsetWidth || 128
  const mh = menu.offsetHeight || 190
  const left = Math.max(4, Math.min(anchor.x - mw / 2, rect.width - mw - 4))
  const top = Math.max(4, Math.min(anchor.y - mh - 8, rect.height - mh - 4))
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
  menu.style.visibility = ''

  const onDocClick = (event: MouseEvent): void => {
    if (event.target instanceof Node && menu.contains(event.target)) return
    close()
  }
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close()
  }
  const close = (): void => {
    closeInteractMenu(stage)
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onKey)
  }
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onKey)

  menu.addEventListener('click', event => {
    if (menu.dataset.renaming === '1') return
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    const act = button.dataset.act
    if (act === 'rename') {
      showRenameRow(stage, menu, pet, handlers)
      return
    }
    close()
    if (act === 'pet') handlers.onPet(pet.id)
    else if (act === 'card') handlers.onCard(pet.id)
    else if (act === 'lock') handlers.onToggleLock(pet.id)
    else if (act === 'export') handlers.onExport(pet.id)
  })
}

/** 重命名行：输入 + 确定/取消；置 renaming 标记屏蔽主监听器，确定时空名忽略。 */
function showRenameRow(
  stage: HTMLElement,
  menu: HTMLElement,
  pet: MenuPetInfo,
  handlers: InteractMenuHandlers,
): void {
  menu.dataset.renaming = '1'
  menu.innerHTML = `<input type="text" maxlength="12" placeholder="新名字" value="${esc(pet.name)}"/>`
    + `<button type="button" data-act="confirm">确定</button>`
    + `<button type="button" data-act="cancel">取消</button>`
  const input = menu.querySelector<HTMLInputElement>('input')
  input?.focus()
  input?.select()

  const confirm = (): void => {
    const name = input?.value.trim() ?? ''
    closeInteractMenu(stage)
    if (name !== '') handlers.onRename(pet.id, name)
  }
  menu.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    if (button.dataset.act === 'confirm') confirm()
    else closeInteractMenu(stage)
  })
  menu.addEventListener('keydown', event => {
    if (event.key === 'Enter') confirm()
  })
}

export function closeInteractMenu(stage: HTMLElement): void {
  stage.querySelector('.py-menu')?.remove()
}
```

**`src/client/ui/avatarBar.ts`**（新建，整文件）：

```ts
import type { Pet } from '../../core/types.ts'
import type { ArtStyle } from '../render/styles.ts'

export interface AvatarBarHandle {
  readonly refresh: (pets: readonly Pet[], holderId: string | null) => void
  readonly dispose: () => void
}

/**
 * 底部头像条（M6）：≤5 圆头像迷你立绘（当前风格 + portraitBox）；
 * 锁定 🔒、锁定且持有 👑 角标；持有者金色描边。点击头像打开互动菜单。
 */
export function mountAvatarBar(
  stage: HTMLElement,
  getStyle: () => ArtStyle,
  onAvatarClick: (petId: string) => void,
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
        const button = document.createElement('button')
        button.type = 'button'
        button.className = pet.id === holderId ? 'py-avatar holder-ring' : 'py-avatar'
        button.title = pet.name
        const mark = pet.locked ? (pet.id === holderId ? '👑' : '🔒') : ''
        button.innerHTML = `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}">`
          + `${style.render(pet.traits, `av-${pet.id}`)}</svg>`
          + `<span class="mark">${mark}</span>`
        button.addEventListener('click', () => onAvatarClick(pet.id))
        bar.appendChild(button)
      }
    },
    dispose() {
      bar.remove()
    },
  }
}
```

> avatar 的 `getStyle` 闭包由 controller 提供：`() => styleOf(this.yard?.settings.artStyle ?? 'geo')`——读取的是**当前** yard 而非启动时快照（风格切换后头像条重绘即生效；`styleOf('real')` 回退 geo，M1）。

**验证**：`npm run typecheck`（模块暂无引用方）。

---

## 7. CP6 — 标签、档案卡与浮层面板

**`src/client/render/labels.ts`**（新建，整文件；**标签文案冻结**——档案卡是收藏品的一部分）：

```ts
import type {
  Accessory, Body, Ears, Eyes, Fur, Pattern, Personality, Species, Tail, Traits,
} from '../../core/types.ts'

export const SPECIES_ZH: Record<Species, string> = { cat: '猫猫', dog: '狗狗' }
export const BODY_ZH: Record<Body, string> = { small: '小巧', round: '圆润', large: '大只' }
export const EARS_ZH: Record<Ears, string> = { erect: '立耳', fold: '折耳', droop: '垂耳', elf: '精灵耳' }
export const FUR_ZH: Record<Fur, string> = {
  white: '纯白', black: '玄黑', orange: '橘色', gray: '灰色', latte: '奶咖',
  cow: '奶牛', calico: '三花', bluegray: '蓝灰', cream: '奶油', smokybrown: '烟棕',
}
export const PATTERN_ZH: Record<Pattern, string> = {
  solid: '纯色', spots: '斑点', tabby: '虎斑', gradient: '渐层', mittens: '白手套',
}
export const TAIL_ZH: Record<Tail, string> = { short: '短尾', long: '长尾', fluffy: '蓬松大尾', curl: '卷尾' }
export const EYES_ZH: Record<Eyes, string> = { amber: '琥珀', lakeblue: '湖蓝', emerald: '翠绿', odd: '异瞳' }
export const ACCESSORY_ZH: Record<Accessory, string> = { none: '', scarf: '小围巾', bell: '铃铛', bowtie: '蝴蝶结' }
export const PERSONALITY_ZH: Record<Personality, string> = { eager: '热情', calm: '淡定', aloof: '高冷' }

/** 档案卡特征标签（需求 §3.5 示例「垂耳 · 奶牛色 · 蓬松尾」）：耳·色·尾（+配饰）。 */
export function traitTags(t: Traits): string[] {
  const tags = [EARS_ZH[t.ears], FUR_ZH[t.fur], TAIL_ZH[t.tail]]
  if (t.accessory !== 'none') tags.push(ACCESSORY_ZH[t.accessory])
  return tags
}
```

**`src/client/render/cardRender.ts`**（新建，整文件）：

```ts
import type { ArtStyleId, Pet } from '../../core/types.ts'
import { personalityOf } from '../../core/traits.ts'
import { BODY_ZH, EYES_ZH, PATTERN_ZH, PERSONALITY_ZH, SPECIES_ZH, traitTags } from './labels.ts'
import { styleOf } from './styles.ts'

export const CARD_W = 540
export const CARD_H = 720
/** 立绘缩放与脚底锚点（M7：完整立绘，不受窗口档位影响）。 */
const PORTRAIT_SCALE = 2.4
const PORTRAIT_FOOT_Y = 520

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 宠物档案卡 SVG（M7）。 */
export function cardSvg(pet: Pet, artStyle: ArtStyleId): string {
  const style = styleOf(artStyle)
  const no = pet.id.slice(2)
  const tags = traitTags(pet.traits).join(' · ')
  const detail = [
    SPECIES_ZH[pet.traits.species], BODY_ZH[pet.traits.body],
    PATTERN_ZH[pet.traits.pattern], EYES_ZH[pet.traits.eyes],
  ].join(' · ')
  const date = new Date(pet.arrivedAt).toLocaleDateString('zh-CN')
  const personality = PERSONALITY_ZH[personalityOf(pet.passion)]
  const cycleMark = pet.cycle >= 2 ? ' ⭐二世' : ''
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
    + `<text x="${cx}" y="682" font-family="sans-serif" font-size="15" fill="#a89880" text-anchor="middle">相遇于 ${date} · ${style.labelZh} · 毛茸茸小院</text>`
    + `</svg>`
}

/** 导出文件名：档案卡_№000042_汤圆.png（M7）。 */
export function cardFileName(pet: Pet): string {
  return `档案卡_№${pet.id.slice(2)}_${pet.name}.png`
}
```

**`src/client/ui/panels.ts`**（新建，整文件）：

```ts
import type { ArtStyleId, Yard } from '../../core/types.ts'
import { SPAWN_INTERVAL_MAX_MIN, SPAWN_INTERVAL_MIN_MIN } from '../../config.ts'
import { availableStyles } from '../render/styles.ts'

export interface PanelsOptions {
  readonly getYard: () => Yard | null
  readonly onIntervalChange: (min: number) => void
  readonly onStyleChange: (id: ArtStyleId) => void
}

export interface PanelsHandle {
  readonly openStats: () => void
  readonly openSettings: () => void
  readonly refresh: () => void
  readonly dispose: () => void
}

/** 右上工具条 + 统计/设置浮层面板（M11/M12）。 */
export function mountPanels(stage: HTMLElement, opts: PanelsOptions): PanelsHandle {
  const toolbar = document.createElement('div')
  toolbar.className = 'py-toolbar'
  toolbar.innerHTML = '<button type="button" data-panel="stats" title="探望统计">📊</button>'
    + '<button type="button" data-panel="settings" title="设置">⚙️</button>'
  stage.appendChild(toolbar)

  const panel = document.createElement('div')
  panel.className = 'py-panel'
  panel.style.display = 'none'
  stage.appendChild(panel)

  let opened: 'stats' | 'settings' | null = null
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

  const renderSettings = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const radios = availableStyles().map(s =>
      `<label class="row"><input type="radio" name="py-style" value="${s.id}"`
      + `${s.id === yard.settings.artStyle ? ' checked' : ''}/> ${s.labelZh}</label>`).join('')
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
    const which = button.dataset.panel === 'settings' ? 'settings' : 'stats'
    if (opened === which) {
      close()
      return
    }
    opened = which
    if (which === 'stats') renderStats()
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
    }
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
    },
    dispose: () => {
      toolbar.remove()
      panel.remove()
    },
  }
}

/** 档案卡弹窗（M7）：预览 + 导出按钮。 */
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

**`tests/labels.spec.ts`**（新建，完整照抄——穷尽式：core 池与标签表永不脱节）：

```ts
import { describe, expect, it } from 'vitest'
import {
  ACCESSORY_POOL, BODY_POOL, EARS_POOL, EYES_POOL, FUR_POOL,
  PATTERN_POOL, SPECIES_POOL, TAIL_POOL,
} from '../src/core/traits.ts'
import {
  ACCESSORY_ZH, BODY_ZH, EARS_ZH, EYES_ZH, FUR_ZH, PATTERN_ZH, SPECIES_ZH, TAIL_ZH, traitTags,
} from '../src/client/render/labels.ts'
import type { Traits } from '../src/core/types.ts'

describe('特征中文标签全量覆盖（M7）', () => {
  it('每个维度取值都有非空标签（accessory 无需为 none 提供标签）', () => {
    for (const v of SPECIES_POOL) expect(SPECIES_ZH[v].length, `species ${v}`).toBeGreaterThan(0)
    for (const v of BODY_POOL) expect(BODY_ZH[v].length, `body ${v}`).toBeGreaterThan(0)
    for (const v of EARS_POOL) expect(EARS_ZH[v].length, `ears ${v}`).toBeGreaterThan(0)
    for (const v of FUR_POOL) expect(FUR_ZH[v].length, `fur ${v}`).toBeGreaterThan(0)
    for (const v of PATTERN_POOL) expect(PATTERN_ZH[v].length, `pattern ${v}`).toBeGreaterThan(0)
    for (const v of TAIL_POOL) expect(TAIL_ZH[v].length, `tail ${v}`).toBeGreaterThan(0)
    for (const v of EYES_POOL) expect(EYES_ZH[v].length, `eyes ${v}`).toBeGreaterThan(0)
    for (const v of ACCESSORY_POOL) expect(ACCESSORY_ZH[v].length, `accessory ${v}`).toBeGreaterThan(0)
  })

  it('traitTags = 耳·色·尾，配饰非 none 时追加', () => {
    const base: Traits = {
      species: 'cat', body: 'small', ears: 'fold', fur: 'cow',
      pattern: 'solid', tail: 'fluffy', eyes: 'amber', accessory: 'none',
    }
    expect(traitTags(base)).toEqual(['折耳', '奶牛', '蓬松大尾'])
    expect(traitTags({ ...base, accessory: 'bell' })).toEqual(['折耳', '奶牛', '蓬松大尾', '铃铛'])
  })
})
```

**`tests/cardRender.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { cardFileName, cardSvg } from '../src/client/render/cardRender.ts'
import type { Pet } from '../src/core/types.ts'

const ARRIVED = new Date(2026, 7, 15, 10).getTime()

const PET: Pet = {
  id: 'p_000042',
  name: '汤圆',
  traits: {
    species: 'cat', body: 'round', ears: 'fold', fur: 'cow',
    pattern: 'spots', tail: 'fluffy', eyes: 'odd', accessory: 'bell',
  },
  passion: 72,
  arrivedAt: ARRIVED,
  locked: false,
  cycle: 1,
}

describe('档案卡渲染（M7）', () => {
  it('包含名字/编号/标签/明细/性格/相遇日期/风格名', () => {
    const svg = cardSvg(PET, 'geo')
    expect(svg).toContain('汤圆')
    expect(svg).toContain('№000042')
    expect(svg).toContain('折耳 · 奶牛 · 蓬松大尾 · 铃铛')
    expect(svg).toContain('猫猫 · 圆润 · 斑点 · 异瞳')
    expect(svg).toContain('性格 · 热情')
    expect(svg).toContain(new Date(ARRIVED).toLocaleDateString('zh-CN'))
    expect(svg).toContain('几何简笔')
    expect(svg).not.toContain('二世')
  })

  it('轮回 ≥2 标记二世', () => {
    expect(cardSvg({ ...PET, cycle: 2 }, 'geo')).toContain('二世')
  })

  it('立绘用独立 uid（不与舞台冲突）', () => {
    expect(cardSvg(PET, 'geo')).toContain('card-p_000042')
  })

  it('文件名格式', () => {
    expect(cardFileName(PET)).toBe('档案卡_№000042_汤圆.png')
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/labels.spec.ts tests/cardRender.spec.ts` 全绿。

---

## 8. CP7 — 调参台升级与控制器最终接线

**`src/client/debug.ts`**（**整文件覆写**；M3：数值输入 + 冷场存档按钮）：

```ts
import type { StageEngine } from './stage/engine.ts'
import type { YardController } from './yardController.ts'

const DEBUG_KEY = 'dsh-plugin-pet/debug'
const W_MIN = 80
const W_MAX = 1400
const H_MIN = 80
const H_MAX = 800

function sizeRow(k: 'w' | 'h', label: string, min: number, max: number): string {
  return `<label class="py-debug-row">${label} `
    + `<input data-k="${k}" data-t="range" type="range" min="${min}" max="${max}" step="10"/>`
    + `<input data-k="${k}" data-t="num" type="number" min="${min}" max="${max}" step="10" placeholder="自动"/></label>`
}

/**
 * debug 调参台（M3）：常驻小齿轮或 ?debug=1 唤出，可见性存 localStorage。
 * 宽/高 = 滑条 + 数值输入双向同步；数值回车/失焦应用并钳制；
 * 空白数值框显示「自动」，恢复跟随走「恢复跟随面板」按钮。
 */
export function mountDebugPanel(
  container: HTMLElement,
  controller: YardController,
  engine: StageEngine,
): () => void {
  const stage = container.querySelector<HTMLElement>('.py-stage')
  if (stage === null) return () => {}

  const panel = document.createElement('div')
  panel.className = 'py-debug'
  panel.innerHTML = [
    '<div class="py-debug-title">小院调参台 <button class="py-debug-close" type="button">×</button></div>',
    '<div class="py-debug-row"><button data-act="spawn" type="button">立即到访</button><button data-act="travel" type="button">快进一个间隔</button></div>',
    '<div class="py-debug-row"><button data-act="demo" type="button">演示存档</button><button data-act="cold" type="button">冷场存档</button></div>',
    '<div class="py-debug-row"><button data-act="snapshot" type="button">状态快照</button><button data-act="reset" type="button">重置存档</button></div>',
    '<div class="py-debug-row"><button data-act="follow" type="button">恢复跟随面板</button></div>',
    sizeRow('w', '宽', W_MIN, W_MAX),
    sizeRow('h', '高', H_MIN, H_MAX),
  ].join('')

  const gear = document.createElement('button')
  gear.type = 'button'
  gear.className = 'py-debug-gear'
  gear.textContent = '🛠'

  const applyVisible = (visible: boolean): void => {
    panel.style.display = visible ? '' : 'none'
    localStorage.setItem(DEBUG_KEY, visible ? '1' : '0')
  }

  let debugW: number | null = null
  let debugH: number | null = null
  const applySize = (): void => engine.setDebugSize(debugW, debugH)

  /** 统一写入某轴尺寸并同步滑条/数值框（v=null 即跟随面板；写入值钳制到范围）。 */
  const setVal = (k: 'w' | 'h', v: number | null): void => {
    const min = k === 'w' ? W_MIN : H_MIN
    const max = k === 'w' ? W_MAX : H_MAX
    const fallback = k === 'w' ? 600 : 360
    const clamped = v === null ? null : Math.min(max, Math.max(min, Math.round(v)))
    if (k === 'w') debugW = clamped
    else debugH = clamped
    for (const input of panel.querySelectorAll<HTMLInputElement>(`input[data-k="${k}"]`)) {
      if (input.dataset.t === 'range') input.value = String(clamped ?? fallback)
      else input.value = clamped === null ? '' : String(clamped)
    }
    applySize()
  }

  gear.addEventListener('click', () => applyVisible(panel.style.display === 'none'))
  panel.querySelector('.py-debug-close')?.addEventListener('click', () => applyVisible(false))

  panel.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    switch (button.dataset.act) {
      case 'spawn': controller.forceSpawn(); break
      case 'travel': controller.timeTravel(); break
      case 'demo': controller.loadDemoArchive(); break
      case 'cold': controller.loadColdArchive(); break
      case 'snapshot': controller.snapshotState(); break
      case 'reset': controller.resetArchive(); break
      case 'follow': {
        setVal('w', null)
        setVal('h', null)
        break
      }
    }
  })

  for (const input of panel.querySelectorAll<HTMLInputElement>('input[data-k]')) {
    if (input.dataset.t === 'range') {
      input.addEventListener('input', () => setVal(input.dataset.k as 'w' | 'h', Number(input.value)))
    } else {
      const apply = (): void => {
        const raw = input.value.trim()
        if (raw === '') return
        const value = Number(raw)
        if (Number.isFinite(value)) setVal(input.dataset.k as 'w' | 'h', value)
      }
      input.addEventListener('change', apply)
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') apply()
      })
    }
  }

  // 初始：跟随面板（滑条给默认显示值，数值框空白「自动」）
  setVal('w', null)
  setVal('h', null)

  const urlDebug = new URLSearchParams(location.search).get('debug') === '1'
  applyVisible(urlDebug || localStorage.getItem(DEBUG_KEY) === '1')
  stage.append(panel, gear)
  return () => {
    panel.remove()
    gear.remove()
  }
}
```

**`src/client/yardController.ts`**（**整文件覆写**；最终接线：菜单/头像条/面板/档案卡/设置/暂停提示）：

```ts
import { MAX_PETS, SAVE_DEBOUNCE_MS } from '../config.ts'
import { createInitialDoc, fromDoc, toDoc } from '../core/doc.ts'
import {
  dueSpawnCount, formatPetId, isSpawnPaused, renamePet, setLocked,
  spawnIntervalMs, spawnPet, type SpawnResult,
} from '../core/spawn.ts'
import { recordOpen } from '../core/stats.ts'
import { derivePet } from '../core/traits.ts'
import type { ArtStyleId, Pet, Yard } from '../core/types.ts'
import { mountDebugPanel } from './debug.ts'
import { loadYard, saveYard } from './persist.ts'
import { downloadSvgAsPng, triggerDownload } from './pngExport.ts'
import { cardFileName, cardSvg } from './render/cardRender.ts'
import { styleOf } from './render/styles.ts'
import { StageEngine } from './stage/engine.ts'
import { TIER_LABEL_ZH } from './stage/tiers.ts'
import { mountAvatarBar, type AvatarBarHandle } from './ui/avatarBar.ts'
import { closeInteractMenu, openInteractMenu } from './ui/interactMenu.ts'
import { closeCardModal, mountPanels, openCardModal, type PanelsHandle } from './ui/panels.ts'
import { showToast } from './ui/toast.ts'

const STORAGE_KEY = 'dsh-plugin-pet/state'

/**
 * 领域驱动器（V7/V14 + M4–M12）：加载/激活补算/定时到访/防抖保存；
 * 互动菜单、头像条、浮层面板、档案卡、设置与暂停提示全部经由此类接线。
 */
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

  constructor(private readonly container: HTMLElement) {
    this.engine = new StageEngine(container, {
      onPetClick: petId => this.handlePetClick(petId),
      onPetEntered: petId => this.handlePetEntered(petId),
      onSpawnCheck: now => this.handleSpawnCheck(now),
      onTierChanged: () => this.refreshHud(),
      onHolderChanged: () => this.refreshUi(),
    })
  }

  start(): void {
    const now = Date.now()
    let yard = loadYard(now)
    yard = { ...yard, stats: recordOpen(yard.stats, now) }
    // 激活补算：离线到访最多 1 只（离线文案）
    let offlinePetId: string | null = null
    if (dueSpawnCount(yard, now) > 0) {
      const result = spawnPet(yard, now)
      yard = result.yard
      if (result.pet !== null) offlinePetId = result.pet.id
    }
    this.yard = yard
    this.engine.start()
    this.engine.restyle(yard.settings.artStyle)

    const stage = this.engine.getStageEl()
    this.panels = mountPanels(stage, {
      getYard: () => this.yard,
      onIntervalChange: min => this.applyInterval(min),
      onStyleChange: id => this.applyStyle(id),
    })
    this.avatarBar = mountAvatarBar(
      stage,
      () => styleOf(this.yard?.settings.artStyle ?? 'geo'),
      petId => this.openMenuForPet(petId),
    )

    // 初始呈现：原有宠物原位淡入（不含离线新到访者——它随后从边缘跑入）
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

  // ---- 互动菜单（M4/M5） ----

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

  private toggleLock(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    this.yard = setLocked(this.yard, petId, !pet.locked)
    this.engine.syncPets(this.yard.pets)
    this.scheduleSave()
    this.refreshUi()
    const stage = this.engine.getStageEl()
    showToast(stage, pet.locked ? `${pet.name} 已解锁` : `${pet.name} 已锁定`)
  }

  private rename(petId: string, name: string): void {
    if (this.yard === null) return
    const next = renamePet(this.yard, petId, name)
    if (next === this.yard) return
    this.yard = next
    this.engine.syncPets(this.yard.pets)
    this.scheduleSave()
    this.refreshUi()
    const stage = this.engine.getStageEl()
    showToast(stage, `已改名为 ${name}`)
  }

  // ---- 档案卡（M7） ----

  private openCard(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    const stage = this.engine.getStageEl()
    openCardModal(stage, cardSvg(pet, this.yard.settings.artStyle), () => this.exportCard(petId))
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

  // ---- 设置（M11） ----

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

  // ---- debug 调参台 API（V13/M3） ----

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

  /** 冷场存档：确定性凑齐 5 只高冷宠物（M8 冷场基础版的验收工具）。 */
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
          id,
          name: derived.defaultName,
          traits: derived.traits,
          passion: derived.passion,
          arrivedAt: now - (MAX_PETS - pets.length) * 60_000,
          locked: false,
          cycle: 1,
        })
      }
      counter++
    }
    this.yard = {
      ...yard,
      pets,
      idCounter: counter,
      usedCombos: used,
      stats: { ...yard.stats, metTotal: pets.length },
    }
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

  // ---- 刷新 ----

  /** 头像条/浮层面板/HUD/暂停提示的统一刷新点。 */
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

**构建与全量回归**：

```bash
npm run typecheck
npm run test        # 74 既有 + settings 4 + styles 3 + spotlight 8 + labels 2 + cardRender 4 = 95
npm run bundle
head -c 120 lib/client.js   # 工厂包裹仍在
```

---

## 9. 浏览器冒烟（CP8 前置）

启动/复用 `dsh --profile pets --port 3081 --no-open`（后台任务）；`npm run bundle` 后热替换自动生效。快速冒烟（详细验收在 §10）：

1. 面板出现右上 📊 ⚙️ 工具条、底部头像条；HUD 正常。
2. 点宠物 → 菜单出现在其头顶；摸一摸 → stretch + 气泡。
3. 宽度数值输入 `200` 回车 → 舞台精确变 200px，聚光灯档生效。

---

## 10. CP8 — M1 验收清单

逐项验证并记录（无法自动化项请用户确认）：

1. **互动菜单**：点宠物 → 菜单（五个按钮）锚定头顶不出界；点空白/Esc 关闭；菜单关闭再点另一只正常切换。
2. **摸一摸**：stretch 动作 + 「好舒服～」；点击本体 = jump + 喵/汪（P2 行为不回归）。
3. **锁定/解锁**：菜单锁定 → 头顶 🔒 + 头像角标 + toast；全 5 只锁定 → 到访暂停 toast + HUD「全锁定暂停中」；解锁恢复（被淘汰者 = 最早未锁定，含刚解锁者）。
4. **重命名**：输入新名确定 → 名字牌/头像 title/气泡生效；空名忽略。
5. **头像条**：≤5 圆头像迷你立绘；点击头像打开菜单；聚光灯持有者头像金圈。
6. **争宠-聚光灯**：宽调至格位 ≤1 → 最早到场的热情者居中；15s 后挑战（现任 roll「哇！」退至边缘，挑战者上台 jump「看我！」）；锁定持有者 30s + 👑；console 有 `[pet-yard] spotlight:` 日志。
7. **冷场基础版**：调参台「冷场存档」→ 宽调至聚光灯 → 全员贴边、舞台空置，console 提示一次。
8. **拥挤探头**：宽调至格位 3–4、5 只在场 → 溢出者左右贴边半身探头；热情溢出者周期冲入（「让我进去！」）再退回。
9. **卖萌动作**：观察 1–2 分钟，出现转圈/追尾/伸懒腰/舔毛/歪头（热情者更频繁）。
10. **档案卡**：菜单「看档案」→ 弹窗卡片（名字/№/标签/明细/性格/相遇日期/几何简笔）；「导出 PNG」落盘，文件名 `档案卡_№xxxxxx_名字.png`。
11. **统计面板**：📊 → 六项指标 + 最近探望 ≤10 条；「合影次数」为 0（P4 前占位）。
12. **设置面板**：⚙️ → 间隔输入 10 应用 → HUD 倒计时按 10 分钟走（快进一个间隔验证）；风格单选仅「几何简笔」。
13. **调参台数值输入**：宽输入 350 → 舞台 350px；滑条同步；「恢复跟随面板」还原；数值越界钳制（输入 5000 → 1400）。
14. **回归**：`npm run typecheck && npm run test` 全绿；F5 后全部状态保留（含 artStyle）；console 无红色报错；P2 的 11 项行为抽查（入场/淘汰/档位日志/躺平）不回归。

---

## 11. 报告模板（`docs/p3-report.md` 原样填空）

```markdown
# P3 执行报告

- 日期：
- 执行环境：

## 检查点结果

| 检查点 | 结果 | 备注 |
|---|---|---|
| CP1 风格系统 | | settings/styles 测试用例数 |
| CP2 卖萌动作+样式 | | |
| CP3 Actor+Spotlight | | spotlight 测试用例数 |
| CP4 引擎重写 | | |
| CP5 UI 模块 | | |
| CP6 标签/档案卡/面板 | | labels/cardRender 测试用例数 |
| CP7 调参台+控制器 | | |
| CP8 M1 验收 | | 14 项逐项结果 |

## 测试统计

（npm run test 输出摘要：文件数 / 用例数）

## M1 验收记录

（14 项清单逐项：✓/✗ + 现象；无法自动化项标注「用户确认」）

## 视觉微调记录（M14）

（每处微调：参数 + 原值 → 新值 + 原因）

## 偏差与决策树使用记录

## 遇到的报错与处置

## 遗留问题 / 待用户决策
```

---

## 12. 决策树（失败时的唯一分支来源）

**D1 · 测试失败**：同 P1/P2 规程——先查测试笔误；模板互相矛盾或与 §1 法典矛盾 → 停下记录，禁止单方面改语义；绝不删断言换通过。

**D2 · typecheck 报错**：依次检查——`import type` 用法；`Record<字面量联合, string>` 全覆盖；`partial record`（STYLE_REGISTRY）取值后的 undefined 过滤；DOM 事件 target 转型（`as HTMLElement` + `closest`）；不用 `any` 绕过。

**D3 · 菜单/弹窗定位异常**：确认挂载在 `.py-stage` 内（`engine.getStageEl()`），坐标系与舞台一致；确认 `stage.getBoundingClientRect()` 在 appendChild 之后测量（模板顺序：先挂载再量尺寸再定位）。

**D4 · 聚光灯不轮换/不任命**：确认 `runSpotlight` 在主循环内每帧执行；确认 `tier === 'spotlight'`（HUD 档位显示）；确认在场者热情度（冷场存档 = 全高冷，应空置而非轮换）；console 日志核对。

**D5 · 贴边/冲挤表现异常**：确认 `assignSlots` 在档位变化（`evalTier`）与 `syncPets` 后都执行；确认舞台 `overflow: hidden` 生效（半身裁剪 = 探头）；冲挤仅作用于 overflowIds ∧ 热情者。

**D6 · 数值输入不生效**：确认监听 `change`（失焦/回车）而非仅 `input`；确认 `setVal` 的钳制分支；确认 range/number 两个 input 的 `data-k` 一致。

**D7 · 风格切换不生效**：确认 `engine.restyle` 被调用（现有 actor 重绘）+ `syncPets` 新建路径用 `styleOf(this.styleId)`；头像条 `getStyle` 闭包读取的是**当前** yard（不是启动时快照）。

**D8 · 热替换后 UI 双份/空白**：F5 强刷；确认 dispose 清理（controller.dispose 移除 panels/avatarBar/menu/modal）；仍异常 → 重启 dsh 进程并记录。

---

## 13. 禁止事项

1. 不修改 §0.3-2 列出的保护文件；`src/config.ts` 只追加 CP1 常量；`types.ts`/`doc.ts` 只做 CP1 精确编辑。
2. 不实现 P4 内容：三档性格分档全量差异、冷场趴卧打盹/哈欠、点名上台、实时缩放反应全量、合影、图鉴、心情、明信片、成就、昼夜。
3. 不注册 `real` 风格（预留 id，最终版美术到位后以并列风格接入）。
4. 不引入新依赖；不使用 Canvas/WebGL；标签文案（labels.ts）与音节池同样冻结。
5. 视觉微调仅限 M14 范围且必须记录。
6. 遇到需要产品判断的情况 → 记录并报告，不擅自定夺。
