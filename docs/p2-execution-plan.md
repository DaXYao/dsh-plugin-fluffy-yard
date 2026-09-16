# P2 执行方案：场景与渲染骨架（执行手册）

> 版本：v1.0 · 对应 `docs/implementation-plan.md` 的 P2 阶段（前置：P1 已验收，见 `docs/p1-report.md`；P1 的两处有据修正——`toDoc` 版本戳、空配饰池守卫——已在代码中，本手册以代码为准）
> **执行者须知**：线性执行手册。所有架构与算法已由主代理设计并固化为代码模板——**按顺序执行，照抄模板，遇分支走决策树**。视觉参数（坐标/时长/速度）允许微调（见 §1 V12），语义与结构不允许改。

---

## 0. 任务说明

### 0.1 目标（= implementation-plan P2 验收门 = 需求 M0）

把 P1 的领域内核接到**活的舞台**上：

1. SVG 分层占位立绘（形状 × 三阶调色，约 25 个几何部件覆盖全部组合）
2. 舞台引擎：rAF 主循环、宠物 Actor（走位/朝向/动作调度）、入场离场动画、名字气泡
3. 档位计算（宽裕/拥挤/狭小/聚光灯/极小）+ `tierChanged` 事件 + 矮窗躺平
4. 面板内 debug 调参模式（宽度/高度滑块、立即到访、时间快进、演示存档、状态快照、重置）
5. 接通真实链路：面板挂载 → 载入/补算 → 引擎呈现 → 防抖持久化

**验收门（M0）**：真实 DSH 面板中——原有宠物原位淡入；新宠物从边缘跑入 + 名字气泡；满员后再到访触发最早的未锁定者挥手→走向边缘→渐隐；拖动宽度滑块跨越档位时状态行变化、热情宠物惊跳、console 输出档位日志；高度低于阈值全员躺平；刷新后状态保留；console 无报错。

### 0.2 检查点映射

| 检查点 | 内容 | 对应任务 |
|---|---|---|
| CP1 | 渲染层：svgDom + palette + parts（占位素材）+ petSprite + sprite 测试 | P2-1 / P2-2 |
| CP2 | 档位计算 tiers.ts + 单测 | P2-6（计算部分） |
| CP3 | 动作系统 actions.ts（定义 + 权重 + CSS 注入） | P2-5 |
| CP4 | PetActor + StageEngine（走位/入离场/气泡/档位事件/矮窗） | P2-4 / P2-6 / P2-7 |
| CP5 | YardController + debug 调参模式 + PetYardView 重写 | P2-3 / P2-8 / P2-9 |
| CP6 | M0 验收 + 全量回归 | 验收 |

### 0.3 执行规则（必须遵守）

1. **工作目录** `E:/dsh-plugin-pet`；新文件用绝对路径创建。
2. **不修改**：`docs/` 下所有既有文档（报告写新文件 `docs/p2-report.md`）、`package.json`（本阶段零新依赖）、`tsdown.config.ts`、`cordis.patch.yml`、`src/index.ts`、`src/client/index.ts`、`src/client/locales.ts`、`src/client/pngExport.ts`、`src/client/persist.ts`、`src/core/` 全部、`tests/` 下既有测试。
3. **允许修改**：`src/config.ts`（**只允许追加** CP1 列出的常量）、`src/client/PetYardView.tsx`（整文件覆写）。
4. 模板代码原样落地；唯一允许的改动：决策树（§8）明确列出的分支，以及 §1 V12 列出的视觉微调。任何偏离记入报告。
5. **测试即验收**：禁止删除断言换通过；失败按 D1 处置。
6. 每个检查点先 `npm run typecheck` 再前进。
7. 长驻命令（`dsh --profile pets --port 3081`）用后台任务；浏览器验证无法自动化时输出清单请用户确认。
8. 中文注释原样保留——它们是语义的一部分。

---

## 1. 设计决策速查（视觉与引擎法典）

| # | 决策 |
|---|---|
| V1 | **局部坐标系**：每只宠物的 sprite 以"脚底中心"为原点绘制，身体占 x∈[-45,45]、y∈[-95,0]。舞台的 SVG 无 viewBox，用户单位 = CSS 像素；宠物根节点用 CSS `transform: translate(x, groundY)` 定位（x = 脚底中心横坐标）。 |
| V2 | **四层 DOM 结构**（顺序固定）：`g.py-pet`（位置层，CSS translate）> `g.py-facing`（朝向层，scaleX(-1) 翻转）> `g.py-action`（动作层，CSS keyframes）> sprite 部件。名字/气泡/ZZZ/徽章在 facing 层**之外**（不镜像）。 |
| V3 | **CSS transform 与 SVG transform 属性互斥**：同一元素只能用其一（CSS 会覆盖属性）。气泡因此用双层：外层 `g.py-bubble-anchor` 用属性 transform 定位，内层 `g.py-bubble` 用 CSS 做淡入动画。 |
| V4 | **永不重建 DOM**：每帧只写 `style.transform`（位置层）与切换 class；sprite 部件 innerHTML 只在挂载时生成一次。 |
| V5 | **形状与颜色分离**：部件 fill 全部用 CSS 变量（`--fur-base/--fur-dark/--fur-light`），变量由 petSprite 按毛色调色板写到 `g.py-sprite` 的 style 上。图案用 `clipPath`（id = `${petId}-body`，天然唯一）裁剪到身体椭圆内。 |
| V6 | **CSS 注入**：全部样式（场景/宠物/动作/HUD/debug）由 `ensureStageStyles()` 以单个 `<style data-plugin="dsh-plugin-pet">` 幂等注入 document.head（对齐 DSH 约定）。 |
| V7 | **引擎是纯视图层**：StageEngine/PetActor 不调用任何 core 写函数，只消费 `readonly Pet[]` 快照（`syncPets` diff：新增→入场、消失→离场、其余→刷新名字/锁定徽章）。领域变更全部走 YardController。 |
| V8 | **时间**：rAF 主循环，dt 钳制 ≤100ms（防挂起后跳变）；到访检查用活跃时间累计（每 30s 一次 `onSpawnCheck`），页面不可见 rAF 自动停 = 天然暂停。 |
| V9 | **Actor 状态机**：`entering`（走到槽位→active）→ `active`（动作调度）→ `exiting`（挥手 1.6s → 走向最近边缘 ≤4s → 渐隐 0.7s → 移除）。槽位分配按 `arrivedAt` 排序，从左到右均布；离场中 actor 不占槽位。 |
| V10 | **档位**：`computeTier(width, count)` 纯函数（宽度 <120 → 极小；格位 = floor(width/140)；格位 ≥ 数 → 宽裕；≥3 → 拥挤；=2 → 狭小；其余 → 聚光灯）。档位变化 → console 日志 + 回调 + 热情宠物跳一下（P2 基础反应；全量反应 P4）。矮窗（高 <160）独立于档位，全员 `flatten`。 |
| V11 | **气泡单行**：入场问候/离场告别/点击喵汪都用同一个 showBubble；文本宽度用 `getBBox()` 实测后画底板。 |
| V12 | **允许微调的视觉参数**（改后记入报告）：部件几何坐标、keyframes 数值、动作时长区间、权重表数字、CSS 颜色。**不允许改**：坐标系定义、分层结构、状态机语义、档位公式、与 core 的接口。 |
| V13 | **debug 调参模式**：院角小齿轮（常驻）或 `?debug=1` 唤出；可见性存 localStorage。这是 P2-3 独立调参页的替代（implementation-plan v1.2 调整）。 |
| V14 | **保存策略**：领域变更后 2s 防抖保存；`visibilitychange`→hidden 立即落盘；→visible 视作一次"打开"（recordOpen + 激活补算，离线文案）。 |

---

## 2. CP1 — 渲染层（占位素材）

**`src/config.ts` 追加**（文件末尾，原样追加）：

```ts
/** 场景最小宽度：低于即“极小”档（implementation-plan §3.5/§6）。 */
export const MIN_STAGE_W = 120

/** 场景高度低于此值触发全员“躺平”彩蛋（需求 §3.7）。 */
export const FLATTEN_H = 160

/** 行走速度（px/秒）。 */
export const WALK_SPEED = 90

/** 引擎到访检查周期（活跃毫秒数；implementation-plan §3.9）。 */
export const SPAWN_CHECK_MS = 30_000

/** 存档保存防抖（毫秒）。 */
export const SAVE_DEBOUNCE_MS = 2000
```

**`src/client/render/palette.ts`**（新建）

```ts
import type { Eyes, Fur } from '../../core/types.ts'

/** 毛色 → 三阶色（形状素材用 CSS 变量引用；V5）。 */
export interface FurPalette {
  readonly base: string
  readonly dark: string
  readonly light: string
}

export const FUR_PALETTE: Record<Fur, FurPalette> = {
  white: { base: '#f2ede4', dark: '#d8d0c0', light: '#ffffff' },
  black: { base: '#4a4540', dark: '#332f2b', light: '#6b645c' },
  orange: { base: '#e8964f', dark: '#c67a37', light: '#f4b87e' },
  gray: { base: '#9a9a98', dark: '#757573', light: '#c0c0be' },
  latte: { base: '#c9a882', dark: '#a8865f', light: '#e0c8a8' },
  cow: { base: '#ece8e0', dark: '#3d3a36', light: '#ffffff' },
  calico: { base: '#e8dcc8', dark: '#c98a4b', light: '#f7f2e8' },
  bluegray: { base: '#8a97a8', dark: '#687485', light: '#adb9c8' },
  cream: { base: '#efdfc4', dark: '#d2bc98', light: '#f9efdd' },
  smokybrown: { base: '#8a7268', dark: '#6b5750', light: '#a8948a' },
}

export const EYE_PALETTE: Record<Exclude<Eyes, 'odd'>, string> = {
  amber: '#d98e32',
  lakeblue: '#5aa8d8',
  emerald: '#58b58a',
}

/** 异瞳：左琥珀右湖蓝（P2 固定搭配）。 */
export const ODD_EYES: { readonly left: string; readonly right: string } = {
  left: '#d98e32',
  right: '#5aa8d8',
}
```

**`src/client/render/parts.ts`**（新建；全部为纯字符串生成，可在 node 下测试）

```ts
import type { Accessory, Body, Ears, Eyes, Pattern, Species, Tail } from '../../core/types.ts'
import { EYE_PALETTE, ODD_EYES } from './palette.ts'

/**
 * 占位素材：几何图形部件（implementation-plan §3.4 的“形状与颜色分离”）。
 * 局部坐标系：脚底中心为原点，身体占 x∈[-45,45]、y∈[-95,0]（V1）。
 * fill 一律用 CSS 变量，由 petSprite 注入（V5）。
 */

/** 体型几何：身体椭圆的 rx/ry。 */
export interface BodyGeom {
  readonly rx: number
  readonly ry: number
}

export function bodyGeom(body: Body): BodyGeom {
  switch (body) {
    case 'small': return { rx: 22, ry: 24 }
    case 'round': return { rx: 28, ry: 25 }
    case 'large': return { rx: 31, ry: 30 }
  }
}

const r = (n: number): number => Math.round(n * 10) / 10

export function bodyPart(geom: BodyGeom): string {
  const { rx, ry } = geom
  return `<ellipse cx="0" cy="${-ry}" rx="${rx}" ry="${ry}" fill="var(--fur-base)"/>`
    + `<ellipse cx="0" cy="${r(-ry * 0.45)}" rx="${r(rx * 0.7)}" ry="${r(ry * 0.45)}" fill="var(--fur-light)" opacity="0.45"/>`
}

export function tailPart(geom: BodyGeom, tail: Tail): string {
  const { rx, ry } = geom
  const ax = r(rx * 0.85)
  const ay = r(-ry * 0.55)
  switch (tail) {
    case 'short':
      return `<path d="M ${ax},${ay} q 11 -5 13 -15" stroke="var(--fur-base)" stroke-width="7" fill="none" stroke-linecap="round"/>`
    case 'long':
      return `<path d="M ${ax},${ay} q 20 -3 25 -28" stroke="var(--fur-base)" stroke-width="8" fill="none" stroke-linecap="round"/>`
    case 'fluffy':
      return `<ellipse cx="${r(ax + 9)}" cy="${r(ay - 10)}" rx="11" ry="16" fill="var(--fur-base)"/>`
        + `<ellipse cx="${r(ax + 4)}" cy="${r(ay - 2)}" rx="7" ry="10" fill="var(--fur-base)"/>`
    case 'curl':
      return `<path d="M ${ax},${ay} q 15 -1 17 -14 q 1 -11 -9 -10" stroke="var(--fur-base)" stroke-width="7" fill="none" stroke-linecap="round"/>`
  }
}

export function earsPart(geom: BodyGeom, ears: Ears): string {
  const { rx, ry } = geom
  const ey = r(-(2 * ry - 3))
  const lx = r(-rx * 0.55)
  const rxx = r(rx * 0.55)
  switch (ears) {
    case 'erect':
      return `<polygon points="${r(lx - 7)},${r(ey + 3)} ${r(lx + 7)},${r(ey + 3)} ${lx},${r(ey - 14)}" fill="var(--fur-base)"/>`
        + `<polygon points="${r(rxx - 7)},${r(ey + 3)} ${r(rxx + 7)},${r(ey + 3)} ${rxx},${r(ey - 14)}" fill="var(--fur-base)"/>`
    case 'fold':
      return `<polygon points="${r(lx - 6)},${r(ey - 1)} ${r(lx + 6)},${r(ey - 1)} ${lx},${r(ey + 10)}" fill="var(--fur-base)"/>`
        + `<polygon points="${r(rxx - 6)},${r(ey - 1)} ${r(rxx + 6)},${r(ey - 1)} ${rxx},${r(ey + 10)}" fill="var(--fur-base)"/>`
    case 'droop':
      return `<ellipse cx="${lx}" cy="${r(ey + 9)}" rx="5.5" ry="11" fill="var(--fur-base)"/>`
        + `<ellipse cx="${rxx}" cy="${r(ey + 9)}" rx="5.5" ry="11" fill="var(--fur-base)"/>`
    case 'elf':
      return `<polygon points="${r(lx - 5)},${r(ey + 3)} ${r(lx + 5)},${r(ey + 3)} ${r(lx - 9)},${r(ey - 15)}" fill="var(--fur-base)"/>`
        + `<polygon points="${r(rxx - 5)},${r(ey + 3)} ${r(rxx + 5)},${r(ey + 3)} ${r(rxx + 9)},${r(ey - 15)}" fill="var(--fur-base)"/>`
  }
}

export function eyesPart(geom: BodyGeom, eyes: Eyes): string {
  const { rx, ry } = geom
  const ex = r(rx * 0.38)
  const ey = r(-ry * 1.45)
  const left = eyes === 'odd' ? ODD_EYES.left : EYE_PALETTE[eyes]
  const right = eyes === 'odd' ? ODD_EYES.right : EYE_PALETTE[eyes]
  return `<circle cx="${r(-ex)}" cy="${ey}" r="4.5" fill="${left}"/>`
    + `<circle cx="${ex}" cy="${ey}" r="4.5" fill="${right}"/>`
}

/** 物种差异：狗有口鼻部（占位级）。 */
export function speciesPart(geom: BodyGeom, species: Species): string {
  if (species !== 'dog') return ''
  const { rx, ry } = geom
  const cy = r(-ry * 0.72)
  return `<ellipse cx="0" cy="${cy}" rx="${r(rx * 0.42)}" ry="${r(ry * 0.22)}" fill="var(--fur-light)"/>`
    + `<circle cx="0" cy="${r(cy - ry * 0.1)}" r="2.5" fill="#3a332e"/>`
}

export function patternPart(geom: BodyGeom, pattern: Pattern, uid: string): string {
  const { rx, ry } = geom
  const clip = `clip-path="url(#${uid}-body)"`
  switch (pattern) {
    case 'solid':
      return ''
    case 'spots':
      return `<g ${clip}>`
        + `<circle cx="${r(-rx * 0.4)}" cy="${r(-ry * 1.3)}" r="6" fill="var(--fur-dark)"/>`
        + `<circle cx="${r(rx * 0.35)}" cy="${r(-ry * 0.9)}" r="5" fill="var(--fur-dark)"/>`
        + `<circle cx="0" cy="${r(-ry * 0.42)}" r="7" fill="var(--fur-dark)"/></g>`
    case 'tabby':
      return `<g ${clip}><path d="M ${-11},${r(-2 * ry + 5)} v 13 M 0,${r(-2 * ry + 2)} v 15 M 11,${r(-2 * ry + 5)} v 13" stroke="var(--fur-dark)" stroke-width="5" stroke-linecap="round" fill="none"/></g>`
    case 'gradient':
      return `<g ${clip}><rect x="${r(-rx)}" y="${r(-2 * ry)}" width="${r(rx * 2)}" height="${r(ry)}" fill="var(--fur-light)" opacity="0.5"/></g>`
    case 'mittens':
      return `<g ${clip}>`
        + `<ellipse cx="${r(-rx * 0.45)}" cy="-5" rx="6.5" ry="5" fill="var(--fur-light)"/>`
        + `<ellipse cx="${r(rx * 0.45)}" cy="-5" rx="6.5" ry="5" fill="var(--fur-light)"/>`
        + `<ellipse cx="0" cy="${r(-ry * 0.95)}" rx="${r(rx * 0.5)}" ry="${r(ry * 0.32)}" fill="var(--fur-light)" opacity="0.85"/></g>`
  }
}

export function accessoryPart(geom: BodyGeom, accessory: Accessory): string {
  const { rx, ry } = geom
  switch (accessory) {
    case 'none':
      return ''
    case 'scarf':
      return `<rect x="${r(-rx * 0.92)}" y="${r(-ry * 1.18)}" width="${r(rx * 1.84)}" height="9" rx="4.5" fill="#d96a5a" transform="rotate(-3)"/>`
    case 'bell':
      return `<circle cx="0" cy="${r(-ry * 0.98)}" r="5" fill="#e8b93c" stroke="#b98f2a" stroke-width="1"/>`
        + `<circle cx="0" cy="${r(-ry * 0.98)}" r="1.6" fill="#7a5f1d"/>`
    case 'bowtie':
      return `<polygon points="-4,${r(-ry * 1.02)} -15,${r(-ry * 1.02 - 6)} -15,${r(-ry * 1.02 + 6)}" fill="#d96a5a"/>`
        + `<polygon points="4,${r(-ry * 1.02)} 15,${r(-ry * 1.02 - 6)} 15,${r(-ry * 1.02 + 6)}" fill="#d96a5a"/>`
        + `<circle cx="0" cy="${r(-ry * 1.02)}" r="2.6" fill="#b5544a"/>`
  }
}
```

**`src/client/render/petSprite.ts`**（新建）

```ts
import type { Traits } from '../../core/types.ts'
import { FUR_PALETTE } from './palette.ts'
import {
  accessoryPart, bodyGeom, bodyPart, earsPart, eyesPart, patternPart, speciesPart, tailPart,
} from './parts.ts'

/**
 * traits → 完整分层 sprite 的 SVG 字符串（V2/V5）。
 * 图层顺序：尾巴（后）→ 身体 → 花纹（裁剪）→ 物种件 → 耳朵 → 眼睛 → 配饰。
 * @param uid 唯一标识（用宠物 id），保证 clipPath 不冲突。
 */
export function petSpriteMarkup(traits: Traits, uid: string): string {
  const geom = bodyGeom(traits.body)
  const fur = FUR_PALETTE[traits.fur]
  return `<g class="py-sprite" style="--fur-base:${fur.base};--fur-dark:${fur.dark};--fur-light:${fur.light}">`
    + `<defs><clipPath id="${uid}-body"><ellipse cx="0" cy="${-geom.ry}" rx="${geom.rx}" ry="${geom.ry}"/></clipPath></defs>`
    + tailPart(geom, traits.tail)
    + bodyPart(geom)
    + patternPart(geom, traits.pattern, uid)
    + speciesPart(geom, traits.species)
    + earsPart(geom, traits.ears)
    + eyesPart(geom, traits.eyes)
    + accessoryPart(geom, traits.accessory)
    + `</g>`
}
```

**`src/client/stage/svgDom.ts`**（新建）

```ts
const SVG_NS = 'http://www.w3.org/2000/svg'

/** 创建 SVG 元素并设置属性（attrs 值会被 String() 化）。 */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value))
  return el
}
```

**`tests/sprite.spec.ts`**（新建，按用例清单编写）

1. `petSpriteMarkup(orange 毛色的固定 traits, 'u1')` 返回串包含 `--fur-base:#e8964f`。
2. 两次调用 uid 不同（`'u1'` / `'u2'`）→ clipPath id 分别为 `u1-body` / `u2-body` 且互不包含对方的 id。
3. `eyes: 'odd'` → 同时包含 `#d98e32` 与 `#5aa8d8`；`eyes: 'amber'` → `#d98e32` 出现 2 次、`#5aa8d8` 出现 0 次。
4. `accessory: 'bell'` → 包含 `#e8b93c`；`accessory: 'none'` → 不含 `#e8b93c`。
5. `pattern: 'mittens'` → `var(--fur-light)` 出现 ≥ 4 次（身体肚皮 + 两爪 + 胸口）；`pattern: 'solid'` → 出现 1 次（仅肚皮）。
6. 抽样循环：10 毛色 × 5 花纹（其余维度固定）共 50 组合 → 输出非空、以 `</g>` 结尾、包含 `class="py-sprite"`。
7. `bodyGeom`：small/round/large 的 rx 严格递增。

**验证**：`npm run typecheck && npx vitest run tests/sprite.spec.ts` 全绿。

---

## 3. CP2 — 档位计算

**`src/client/stage/tiers.ts`**（新建）

```ts
import { CELL_W, MIN_STAGE_W } from '../../config.ts'

/** 场景档位（需求 §3.7 分档行为；P2 只计算与广播，分档行为全量在 P4）。 */
export type Tier = 'tiny' | 'spotlight' | 'narrow' | 'crowded' | 'roomy'

/** 可见格位数 = floor(宽 / 舒适格位宽)。 */
export function slotsFor(width: number): number {
  return Math.max(0, Math.floor(width / CELL_W))
}

/**
 * 档位判定（implementation-plan §3.5，按序判定）：
 * 宽 < MIN_STAGE_W → 极小；格位 ≥ 在场数 → 宽裕；格位 ≥ 3 → 拥挤；
 * 格位 = 2 → 狭小；其余（格位 ≤ 1）→ 聚光灯。
 */
export function computeTier(width: number, petCount: number): Tier {
  if (width < MIN_STAGE_W) return 'tiny'
  const slots = slotsFor(width)
  if (slots >= petCount) return 'roomy'
  if (slots >= 3) return 'crowded'
  if (slots === 2) return 'narrow'
  return 'spotlight'
}

export const TIER_LABEL_ZH: Record<Tier, string> = {
  tiny: '极小',
  spotlight: '聚光灯',
  narrow: '狭小',
  crowded: '拥挤',
  roomy: '宽裕',
}
```

**`tests/tiers.spec.ts`**（新建，完整照抄）

```ts
import { describe, expect, it } from 'vitest'
import { computeTier, slotsFor, TIER_LABEL_ZH, type Tier } from '../src/client/stage/tiers.ts'

describe('档位计算（implementation-plan §3.5）', () => {
  it('宽 < 120 → 极小（无论数量）', () => {
    expect(computeTier(60, 1)).toBe('tiny')
    expect(computeTier(119, 5)).toBe('tiny')
  })
  it('格位 ≥ 在场数 → 宽裕', () => {
    expect(computeTier(700, 3)).toBe('roomy')
    expect(computeTier(140, 1)).toBe('roomy')
    expect(computeTier(1400, 5)).toBe('roomy')
  })
  it('格位 < 在场数且 ≥ 3 → 拥挤', () => {
    expect(computeTier(700, 6)).toBe('crowded')
    expect(computeTier(420, 4)).toBe('crowded')
  })
  it('格位 = 2 → 狭小', () => {
    expect(computeTier(300, 5)).toBe('narrow')
    expect(computeTier(300, 3)).toBe('narrow')
  })
  it('格位 ≤ 1（且宽 ≥ 120）→ 聚光灯', () => {
    expect(computeTier(200, 3)).toBe('spotlight')
    expect(computeTier(130, 1)).toBe('spotlight')
  })
  it('空场恒宽裕', () => {
    expect(computeTier(300, 0)).toBe('roomy')
  })
  it('格位数 = floor(宽/140)', () => {
    expect(slotsFor(139)).toBe(0)
    expect(slotsFor(140)).toBe(1)
    expect(slotsFor(279)).toBe(1)
    expect(slotsFor(280)).toBe(2)
  })
  it('标签表覆盖全部档位', () => {
    const tiers: Tier[] = ['tiny', 'spotlight', 'narrow', 'crowded', 'roomy']
    for (const tier of tiers) expect(TIER_LABEL_ZH[tier].length).toBeGreaterThan(0)
  })
})
```

**验证**：`npx vitest run tests/tiers.spec.ts` 全绿。

---

## 4. CP3 — 动作系统与样式

**`src/client/stage/actions.ts`**（新建）

```ts
import type { Personality } from '../../core/types.ts'

export type ActionName = 'idle' | 'walk' | 'jump' | 'roll' | 'sit' | 'sleep' | 'wave' | 'flatten'

/** 可被日常调度选中的动作（wave/flatten 由引擎指令触发，不参与随机）。 */
export type ScheduledAction = 'idle' | 'walk' | 'jump' | 'roll' | 'sit' | 'sleep'

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
}

/** 日常动作的性格权重（需求 §3.7：性格轻微影响日常动作偏好）。 */
export const ACTION_WEIGHTS: Record<ScheduledAction, Record<Personality, number>> = {
  idle: { eager: 2, calm: 3, aloof: 3 },
  walk: { eager: 4, calm: 3, aloof: 2 },
  jump: { eager: 4, calm: 2, aloof: 1 },
  roll: { eager: 3, calm: 2, aloof: 1 },
  sit: { eager: 1, calm: 3, aloof: 3 },
  sleep: { eager: 1, calm: 2, aloof: 4 },
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
@keyframes py-idle { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.97); } }
@keyframes py-walk { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes py-jump { 0%, 100% { transform: translateY(0); } 35% { transform: translateY(-34px); } 45% { transform: translateY(-28px); } 60% { transform: translateY(-38px); } }
@keyframes py-roll { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
@keyframes py-sit { from { transform: scaleY(1); } to { transform: scaleY(0.86) translateY(4px); } }
@keyframes py-sleep { 0%, 100% { transform: scaleY(0.9); } 50% { transform: scaleY(0.85); } }
@keyframes py-wave { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
@keyframes py-flatten { from { transform: scale(1, 1); } to { transform: scale(1.5, 0.3); } }
@keyframes py-zzz { 0% { opacity: 0; transform: translate(0, 0); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(10px, -20px); } }
.py-hud { position: absolute; top: 8px; left: 10px; padding: 3px 10px; border-radius: 999px; background: rgba(255,253,248,0.85); border: 1px solid #d8c9b8; color: #6b5b4d; font-size: 12px; pointer-events: none; z-index: 5; }
.py-debug { position: absolute; top: 8px; right: 8px; z-index: 10; background: #fffdf8; border: 1px solid #d8c9b8; border-radius: 10px; padding: 8px; font-size: 12px; color: #4a3f35; display: flex; flex-direction: column; gap: 6px; max-width: 240px; }
.py-debug-title { font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
.py-debug-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.py-debug button { font-size: 12px; padding: 3px 8px; border-radius: 6px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-debug input[type='range'] { width: 90px; }
.py-debug-gear { position: absolute; left: 8px; bottom: 8px; z-index: 10; width: 26px; height: 26px; border-radius: 50%; border: 1px solid #c9b8a5; background: rgba(255,253,248,0.9); cursor: pointer; font-size: 13px; }
`
```

**验证**：`npm run typecheck`（actions.ts 此时无引用方，纯编译检查）。

---

## 5. CP4 — PetActor 与 StageEngine

**`src/client/stage/actor.ts`**（新建，完整照抄）

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
      '<text class="py-badge" x="-30" y="-64">🔒</text>',
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
    this.badgeEl.style.display = pet.locked ? '' : 'none'
    if (initialFadeIn) this.scheduleNext()
  }

  setTarget(x: number): void {
    this.targetX = x
  }

  isExiting(): boolean {
    return this.state === 'exiting'
  }

  isDone(): boolean {
    return this.done
  }

  /** 引擎指令：跳一下（点击反馈/档位反应/点名，P2 基础反应）。 */
  poke(): void {
    if (this.state === 'active' && this.action !== 'flatten') this.playAction('jump')
  }

  updatePet(pet: Pet): void {
    this.pet = pet
    this.nameEl.textContent = pet.name
    this.badgeEl.style.display = pet.locked ? '' : 'none'
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

  /** 挑下一个日常动作；walk = 在当前槽位附近游走（V9/V12 权重表）。 */
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

**`src/client/stage/engine.ts`**（新建，完整照抄）

```ts
import { FLATTEN_H, SPAWN_CHECK_MS } from '../../config.ts'
import { personalityOf } from '../../core/traits.ts'
import type { Pet } from '../../core/types.ts'
import { ensureStageStyles } from './actions.ts'
import { PetActor, type ActorContext } from './actor.ts'
import { svgEl } from './svgDom.ts'
import { computeTier, type Tier } from './tiers.ts'

export interface EngineOptions {
  readonly onPetClick?: (petId: string) => void
  readonly onPetEntered?: (petId: string) => void
  readonly onSpawnCheck?: (now: number) => void
  readonly onTierChanged?: (tier: Tier, prev: Tier) => void
}

const MARGIN = 70

/**
 * 舞台引擎（V7/V8）：纯视图层。消费 Pet 快照（syncPets diff），
 * rAF 主循环驱动 Actor；ResizeObserver → 档位/矮窗评估。
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
      this.actors = this.actors.filter(actor => !actor.isDone())
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

  setHudText(text: string): void {
    this.hud.textContent = text
  }

  showBubble(petId: string, text: string, ms?: number): void {
    this.actors.find(actor => actor.pet.id === petId)?.showBubble(text, ms)
  }

  poke(petId: string): void {
    this.actors.find(actor => actor.pet.id === petId)?.poke()
  }

  /** debug 调参：null = 跟随面板（V13）。 */
  setDebugSize(w: number | null, h: number | null): void {
    this.stageDiv.style.width = w === null ? '100%' : `${w}px`
    this.stageDiv.style.height = h === null ? '100%' : `${h}px`
  }

  /**
   * 快照 diff（V7）：新增 → 入场（或 initial 模式原位淡入）；
   * 消失 → 离场；其余 → 刷新名字/锁定徽章。
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
      actor.root.addEventListener('click', () => this.opts.onPetClick?.(pet.id))
      actor.setTarget(slot)
      this.actors.push(actor)
      this.svg.appendChild(actor.root)
      if (options.initial !== true) this.opts.onPetEntered?.(pet.id)
    })
    this.assignSlots()
    this.evalTier()
  }

  private slotX(index: number, count: number): number {
    const usable = Math.max(0, this.w - 2 * MARGIN)
    return MARGIN + (index + 0.5) * usable / Math.max(1, count)
  }

  /** 槽位按到场时间从左到右均布；离场中 actor 不占槽（V9）。 */
  private assignSlots(): void {
    const active = this.actors.filter(actor => !actor.isExiting())
    const sorted = [...active].sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    sorted.forEach((actor, index) => actor.setTarget(this.slotX(index, sorted.length)))
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
    }
    const flatten = this.h > 0 && this.h < FLATTEN_H
    if (flatten !== this.flatten) {
      this.flatten = flatten
      console.info(`[pet-yard] flatten: ${flatten ? 'on' : 'off'}`)
    }
  }
}
```

**验证**：`npm run typecheck`。

---

## 6. CP5 — 接线：控制器、调参台、面板

**`src/client/yardController.ts`**（新建，完整照抄）

```ts
import { SAVE_DEBOUNCE_MS } from '../config.ts'
import { createInitialDoc, fromDoc, toDoc } from '../core/doc.ts'
import { dueSpawnCount, spawnIntervalMs, spawnPet, type SpawnResult } from '../core/spawn.ts'
import { recordOpen } from '../core/stats.ts'
import type { Yard } from '../core/types.ts'
import { mountDebugPanel } from './debug.ts'
import { loadYard, saveYard } from './persist.ts'
import { triggerDownload } from './pngExport.ts'
import { StageEngine } from './stage/engine.ts'
import { TIER_LABEL_ZH } from './stage/tiers.ts'

const STORAGE_KEY = 'dsh-plugin-pet/state'

/**
 * 领域驱动器（V7/V14）：加载/激活补算/定时到访检查/防抖保存，
 * 把 Yard 变化同步给 StageEngine。引擎与 debug 面板只经由此类读写领域。
 */
export class YardController {
  private yard: Yard | null = null
  private readonly engine: StageEngine
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private hudTimer: ReturnType<typeof setInterval> | null = null
  private disposeDebug: (() => void) | null = null
  private readonly pendingGreet = new Map<string, string>()
  private disposed = false

  constructor(private readonly container: HTMLElement) {
    this.engine = new StageEngine(container, {
      onPetClick: petId => this.handlePetClick(petId),
      onPetEntered: petId => this.handlePetEntered(petId),
      onSpawnCheck: now => this.handleSpawnCheck(now),
      onTierChanged: () => this.refreshHud(),
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
    this.refreshHud()
    this.scheduleSave()
  }

  dispose(): void {
    this.disposed = true
    this.flushSave()
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.hudTimer !== null) clearInterval(this.hudTimer)
    this.disposeDebug?.()
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
      this.refreshHud()
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
    this.refreshHud()
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
  }

  // ---- debug 调参台 API（V13） ----

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
    for (let i = 0; i < 5; i++) yard = spawnPet(yard, now - (5 - i) * 60_000).yard
    this.yard = yard
    this.engine.syncPets(yard.pets)
    this.scheduleSave()
    this.refreshHud()
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

  private refreshHud(): void {
    if (this.yard === null) return
    const remaining = Math.max(0, this.yard.lastSpawnAt + spawnIntervalMs(this.yard) - Date.now())
    const mm = Math.floor(remaining / 60_000)
    const ss = Math.floor((remaining % 60_000) / 1000)
    this.engine.setHudText(
      `${TIER_LABEL_ZH[this.engine.getTier()]} · 在场 ${this.yard.pets.length}/5 · 已相遇 ${this.yard.stats.metTotal} · 下次到访 ${mm}:${String(ss).padStart(2, '0')}`,
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

**`src/client/debug.ts`**（新建，完整照抄）

```ts
import type { StageEngine } from './stage/engine.ts'
import type { YardController } from './yardController.ts'

const DEBUG_KEY = 'dsh-plugin-pet/debug'

/** debug 调参台（V13）：小齿轮或 ?debug=1 唤出，可见性存 localStorage。 */
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
    '<div class="py-debug-row"><button data-act="demo" type="button">载入演示存档</button><button data-act="snapshot" type="button">状态快照</button></div>',
    '<div class="py-debug-row"><button data-act="reset" type="button">重置存档</button><button data-act="follow" type="button">恢复跟随面板</button></div>',
    '<label class="py-debug-row">宽 <input data-k="w" type="range" min="80" max="1400" step="10" value="600"/> <span data-v="w"></span></label>',
    '<label class="py-debug-row">高 <input data-k="h" type="range" min="80" max="800" step="10" value="360"/> <span data-v="h"></span></label>',
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

  gear.addEventListener('click', () => applyVisible(panel.style.display === 'none'))
  panel.querySelector('.py-debug-close')?.addEventListener('click', () => applyVisible(false))

  panel.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    switch (button.dataset.act) {
      case 'spawn': controller.forceSpawn(); break
      case 'travel': controller.timeTravel(); break
      case 'demo': controller.loadDemoArchive(); break
      case 'snapshot': controller.snapshotState(); break
      case 'reset': controller.resetArchive(); break
      case 'follow': {
        debugW = null
        debugH = null
        applySize()
        const wSpan = panel.querySelector<HTMLElement>('[data-v="w"]')
        const hSpan = panel.querySelector<HTMLElement>('[data-v="h"]')
        if (wSpan !== null) wSpan.textContent = ''
        if (hSpan !== null) hSpan.textContent = ''
        break
      }
    }
  })

  for (const input of panel.querySelectorAll<HTMLInputElement>('input[type=range]')) {
    input.addEventListener('input', () => {
      const value = Number(input.value)
      const span = panel.querySelector<HTMLElement>(`[data-v="${input.dataset.k}"]`)
      if (span !== null) span.textContent = `${value}px`
      if (input.dataset.k === 'w') debugW = value
      else debugH = value
      applySize()
    })
  }

  const urlDebug = new URLSearchParams(location.search).get('debug') === '1'
  applyVisible(urlDebug || localStorage.getItem(DEBUG_KEY) === '1')
  stage.append(panel, gear)
  return () => {
    panel.remove()
    gear.remove()
  }
}
```

**`src/client/PetYardView.tsx`**（**整文件覆写**）

```tsx
import { useEffect, useRef } from 'react'
import { YardController } from './yardController.ts'

/** 宠物小院面板：容器 + 控制器接线（薄壳，V7——领域与舞台都在 controller/engine 里）。 */
export function PetYardView(_props: unknown): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (containerRef.current === null) return
    const controller = new YardController(containerRef.current)
    controller.start()
    return () => controller.dispose()
  }, [])
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 360, position: 'relative', overflow: 'hidden' }}
    />
  )
}
```

**验证**：`npm run typecheck && npm run test && npm run bundle`（全部测试含 P1 的 59 个 + 新增 sprite/tiers 全绿；产物工厂包裹仍在）。

---

## 7. CP6 — M0 验收

启动（若 3081 未在跑）：后台 `dsh --profile pets --port 3081 --no-open`，等 URL 打印；`npm run bundle` 后 client-hmr 数秒内自动热替换（P0 已验证）。

**验收清单**（无法自动化的项输出给用户确认，逐项记录）：

1. **原位淡入**：打开宠物小院 tab → 草地场景 + 此前存档的宠物在各自位置淡入（无气泡、无走位）。
2. **入场动画**：点齿轮 🛠 → 调参台展开 → 「立即到访」→ 新宠物从左/右边缘跑入（走路起伏动画 + 朝向正确）→ 头顶弹出气泡「你好呀，我是X！」→ 走到空位开始做小动作（呼吸/踱步/跳/打滚/坐/打盹 ZZZ）。
3. **满员淘汰（M0 核心）**：连续到访至第 6 只 → 到场最早的宠物原地挥手 → 走向最近边缘 → 渐隐消失；状态行「已相遇」+1。
4. **定时轮换路径**：「快进一个间隔」→ 立刻发生一次到访（气泡正常问候文案）。
5. **档位切换**：拖「宽」滑块从 600 → 1400 → 280 → 200 → 100：
   - 状态行档位依次变化（宽裕→拥挤→狭小→聚光灯→极小）；
   - 每次跨越档位，console 输出 `[pet-yard] tier: X → Y`，热情性格（热情度 ≥60）的宠物跳一下；
   - 宠物间距随宽度收窄而靠近。
6. **矮窗躺平**：拖「高」滑块 < 160 → 全员压扁成"宽扁"形态，console 输出 `flatten: on`；调回 → 恢复。
7. **点击反馈**：点任意宠物 → 跳一下 + 气泡「喵～」/「汪！」。
8. **持久化**：F5 → 宠物、统计、档位保留。
9. **状态快照**：点「状态快照」→ 下载 JSON，打开确认 pets/archive/usedCombos 结构完整。
10. **演示存档**：点「载入演示存档」→ 5 只新宠物陆续入场。
11. **console 无红色报错**；`dsh` 终端无 fiber 报错。

**回归**：`npm run typecheck && npm run test`（全量）。

---

## 8. 决策树（失败时的唯一分支来源）

**D1 · 测试失败**：同 P1 D2 规程——先怀疑测试笔误；模板互相矛盾或与 §1 法典矛盾 → 停下记录报告，禁止单方面改语义；绝不允许删断言换通过。

**D2 · typecheck 报错**：依次检查——类型导入用 `import type`；`Record<X, string>` 覆盖全部字面量；`querySelector<SVGGElement>('...')!` 的非空断言写法；SVG 元素 style 上不存在的属性（如 `style.opacity` 合法、`style.transform` 合法）。不用 `any` 绕过。

**D3 · 动画不播放/位置不对**（按序检查，每次只改一处并记录）：
1. 元素是否同时被 CSS transform 和 SVG transform 属性驱动（V3 冲突）；
2. 动作层是否有 `.py-action` class 且 `transform-box: fill-box` 生效（DevTools 查看 computed style）；
3. 位置层是否每帧写 `style.transform`（打断点/console 验证）；
4. keyframes 名称与 class 拼写一致（`py-jump` ↔ `@keyframes py-jump`）。
若仍异常：截图/描述现象记入报告，允许按 V12 微调几何与数值，不允许改结构。

**D4 · 气泡不显示**：检查 `.py-bubble-anchor`（属性 transform）与 `.py-bubble`（CSS 动画）是否为两层（V3）；`getBBox()` 需要元素已挂载（showBubble 在 appendChild 之后调用）。

**D5 · 热替换后面板空白/双份**：F5 强刷；仍异常 → 重启 dsh 进程（`netstat -ano | grep 3081` 找 PID，`taskkill //F //PID <pid>`，再后台启动）。dispose() 清理不干净属实现缺陷，记录报告。

**D6 · 性能问题（掉帧）**：确认只写 transform/class（V4）；DevTools Performance 查看是否有每帧 layout（getBoundingClientRect 只在 relayout 调用）。

---

## 9. 报告模板（`docs/p2-report.md` 原样填空）

```markdown
# P2 执行报告

- 日期：
- 执行环境：

## 检查点结果

| 检查点 | 结果 | 备注 |
|---|---|---|
| CP1 渲染层 | | sprite 测试用例数 |
| CP2 档位 | | 用例数 |
| CP3 动作系统 | | |
| CP4 引擎 | | |
| CP5 接线 | | |
| CP6 M0 验收 | | 11 项逐项结果 |

## 测试统计

（npm run test 输出摘要：文件数 / 用例数）

## M0 验收记录

（11 项清单逐项：✓/✗ + 现象描述；无法自动化项标注"用户确认"）

## 视觉微调记录（V12）

（每处微调：参数 + 原值 → 新值 + 原因）

## 偏差与决策树使用记录

## 遇到的报错与处置

## 遗留问题 / 待用户决策
```

---

## 10. 禁止事项

1. 不修改 §0.3-2 列出的文件；`src/config.ts` 只允许追加 CP1 列出的常量。
2. 不实现 P3+ 内容：互动菜单、锁定按钮 UI、档案卡、设置页、统计面板、聚光灯/分档全量行为、实时反应全量——点击反馈与热情惊跳是 P2 的全部交互。
3. 不引入新依赖；不使用 Canvas/WebGL（SVG + CSS 是既定技术路线）。
4. 不改坐标系（V1）、分层结构（V2）、状态机语义（V9）、档位公式（V10）、与 core 的接口（V7）。
5. 视觉参数微调仅限 V12 列出的范围，且必须记录。
6. 遇到需要产品判断的情况 → 记录并报告，不擅自定夺。
