# 美术执行方案：软萌手绘风 `real`（执行手册）

> 版本：v1.0 · 对应 `docs/implementation-plan.md` 的 A 美术工作流（v1.6 激活；前置：P0–P5 架构就绪，`ArtStyle` 注册表/设置切换/档案卡/头像条均已按风格驱动）
> **执行者须知**：本手册交付最终版猫狗美术——以**代码手绘的 SVG 矢量插画**（软萌贴纸风）实现，注册为并列风格 `real`，与 `geo` 并存（需求决策 #11）。模板给出关键部件的**完整范例路径**与**系统性变体构造规则**；照抄范例、按规则推变体，不要自由发挥比例。

---

## 0. 任务说明

### 0.1 目标与验收门

1. 新风格 `real`（软萌手绘）：覆盖全部特征维度（2 物种 × 3 体型 × 4 耳型 × 10 毛色 × 5 花纹 × 4 尾巴 × 4 眼色 × 4 配饰），注册进 `STYLE_REGISTRY`。
2. 设置面板出现两个风格单选，切换即时生效（舞台/头像条/档案卡/图鉴/明信片/合影全部跟随）。
3. 调参台新增「立绘画廊」：全维度矩阵预览 + 双风格对照——**美术的 QA 工作台**。
4. **验收门**：typecheck + 全部测试（既有 + 新增 ≥10）全绿；画廊截图 + 真实舞台/档案卡截图入报告；**视觉终审由用户确认**（手册含迭代微调流程）。

### 0.2 检查点

| CP | 内容 |
|---|---|
| CP1 | 画廊先行：`ui/gallery.ts` + debug/controller/CSS 接线（先用 geo 验证画廊本身） |
| CP2 | `render/real/palette.ts`（10 毛色四阶色）+ palette 测试 |
| CP3 | `render/real/parts.ts` 主体：身形/物种件/爪/腮红/白边（含猫形完整范例路径）+ 画廊目检 |
| CP4 | parts.ts 五官与配件：耳/尾/眼/花纹/配饰 + 画廊目检 |
| CP5 | `render/realSprite.ts` 组装 + `styles.ts` 注册 + 结构化测试（全组合） |
| CP6 | 打磨轮：截图 → 微调清单 → 迭代（A9 流程）+ 全量回归 + 验收 |

### 0.3 执行规则

1. 工作目录 `E:/dsh-plugin-pet`。**不修改**：`docs/` 既有文档（报告写 `docs/art-report.md`）、`package.json`（零新依赖）、`tsdown.config.ts`、`cordis.patch.yml`、`src/index.ts`、`src/client/index.ts`、`locales.ts`、`pngExport.ts`、`persist.ts`、`PetYardView.tsx`、`render/`（palette/parts/petSprite/cardRender/photoExport/labels）、`stage/` 全部、`ui/`（interactMenu/toast/avatarBar/panels）、`src/core/` 全部、`tests/` 全部既有测试。
2. **允许修改**：`src/client/render/styles.ts`（CP5 精确编辑注册）、`src/client/debug.ts`（CP1 精确编辑加按钮）、`src/client/yardController.ts`（CP1 精确编辑加 openGallery）。
3. **新建**：`src/client/render/real/palette.ts`、`src/client/render/real/parts.ts`、`src/client/render/realSprite.ts`、`src/client/ui/gallery.ts`、`tests/realStyle.spec.ts`、`tests/realPalette.spec.ts`、`tests/gallery.spec.ts`（可选）。
4. 模板原样落地；偏离走 §9 决策树并记录。测试即验收。每 CP 后 `npm run typecheck`。中文注释保留。

---

## 1. 设计决策速查（美术法典 A1–A12）

| # | 决策 |
|---|---|
| A1 | **风格定位：软萌贴纸风**。正-faced 对称构图、大头小身（chibi 坐姿）、统一深色描边 + 外圈白色贴纸边、平涂 + 简单阴影色块（腮红/肚皮/高光）。这是代码矢量可稳定产出且观感统一的路线；**不做**写实毛发/透视。 |
| A2 | **坐标系与包络（硬约束）**：脚底原点不变；立绘高度按体型对齐 geo 包络——small 顶点 y≈-48±4、round≈-50±4、large≈-60±4（气泡锚点 `actor.ts` 用 geo `bodyGeom` 计算，包络一致则锚点正确，不改 actor）。横向：身体最宽 ±(rx+4)，尾巴可伸出但 |x| ≤ 54（portraitBox 裁剪内）。 |
| A3 | **颜色全部走内联 CSS 变量**：real 的根 `<g class="py-sprite" style="--rb:…;--rd:…;--rl:…;--rw:…;--ln:…">`（base/deep/light/white/line 五变量）。内联 style 会随序列化保留 → 合影/档案卡/头像自动正确，无需改 PHOTO_CSS。 |
| A4 | **描边体系**：统一 `stroke:var(--ln)` `stroke-width:2.5` `stroke-linejoin:round`；贴纸白边 = 身体主路径底层复制一份 `fill:none stroke:#fffdf8 stroke-width:8`。描边元素显式写 stroke 属性（不依赖外部 CSS）。 |
| A5 | **clipPath 约定**：花纹裁剪到身体路径，id = `${uid}-body`（与 geo 同名约定但互不冲突——同屏同 uid 只会出现一次；画廊遍历时 uid 带索引）。 |
| A6 | **体型 = 参数缩放，不是重画**：`REAL_BODY: Record<Body, {rx;h;headY;…}>` 基准形（round 猫）写死路径，small/large 用控制点缩放系数生成（§3 变体规则）。物种差异叠加在体型之上（嘴吻/眉毛/胡须/耳形微调）。 |
| A7 | **毛色语义**：fur 提供四阶色；**奶牛/三花在 solid 下也呈现固有花斑**（真实猫狗如此），其余花纹叠加于四阶色之上——traits 仍是唯一真相，这只是 real 风格的视觉映射。 |
| A8 | **眼色**：琥珀/湖蓝/翠绿/异瞳——大圆眼（底色椭圆 + 深瞳 + 双高光点），异瞳左琥珀右湖蓝（与 geo 一致）。 |
| A9 | **打磨轮**：CP6 由执行者截图 → 报告列出视觉问题清单 → **用户挑要点反馈** → 执行者按反馈微调（仅 A10 允许的参数）。美术质量是主观验收，鼓励多轮。 |
| A10 | **允许微调（记录）**：一切路径控制点坐标、色值、描边宽度、高光/腮红位置、变体缩放系数。**不可改**：A1–A8 规则、`ArtStyle` 契约、注册表结构、坐标包络硬约束。 |
| A11 | **画廊 = 双风格对照**：顶部 geo/real 切换；分区块展示 物种×体型 / 耳型×物种 / 尾巴×物种 / 毛色板 / 花纹 / 眼色 / 配饰。画廊 uid 带区块前缀防 clipPath 冲突。 |
| A12 | 注册后 `availableStyles()` 自动出现「软萌手绘」；设置切换链路（restyle/头像/卡片/合影）P3–P5 已就绪，**零额外接线**。 |

---

## 2. CP1 — 立绘画廊（QA 工作台先行）

**`src/client/ui/gallery.ts`**（新建，整文件）：

```ts
import type { ArtStyleId, Body, Ears, Eyes, Fur, Pattern, Species, Tail, Traits } from '../../core/types.ts'
import { styleOf } from '../render/styles.ts'

interface Cell { readonly label: string; readonly traits: Traits }

const BASE: Traits = {
  species: 'cat', body: 'round', ears: 'erect', fur: 'orange',
  pattern: 'solid', tail: 'fluffy', eyes: 'amber', accessory: 'none',
}

function cell(label: string, patch: Partial<Traits>): Cell {
  return { label, traits: { ...BASE, ...patch } }
}

function section(title: string, cells: readonly Cell[]): string {
  const items = cells.map((c, i) => galleryItem(c, i, title)).join('')
  return `<h3>${title}</h3><div class="py-gallery-grid">${items}</div>`
}

function galleryItem(c: Cell, index: number, salt: string): string {
  const style = styleOf(currentStyle)
  const box = style.portraitBox
  return `<figure class="py-gallery-cell">`
    + `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${style.render(c.traits, `ga-${salt}-${index}`)}</svg>`
    + `<figcaption>${c.label}</figcaption></figure>`
}

let currentStyle: ArtStyleId = 'geo'

/** 立绘画廊（A11）：全维度矩阵 + 双风格对照。 */
export function openGallery(stage: HTMLElement): void {
  closeGallery(stage)
  const overlay = document.createElement('div')
  overlay.className = 'py-gallery'
  overlay.innerHTML = '<div class="py-gallery-bar">'
    + '<strong>立绘画廊</strong> '
    + '<label><input type="radio" name="py-gstyle" value="geo" checked/> 几何简笔</label> '
    + '<label><input type="radio" name="py-gstyle" value="real"/> 软萌手绘</label> '
    + '<button type="button" class="py-gallery-close">关闭</button></div>'
    + '<div class="py-gallery-body"></div>'
  stage.appendChild(overlay)

  const body = overlay.querySelector<HTMLElement>('.py-gallery-body')!
  const render = (): void => {
    const bodies: readonly Body[] = ['small', 'round', 'large']
    const ears: readonly Ears[] = ['erect', 'fold', 'droop', 'elf']
    const tails: readonly Tail[] = ['short', 'long', 'fluffy', 'curl']
    const furs: readonly Fur[] = ['white', 'black', 'orange', 'gray', 'latte', 'cow', 'calico', 'bluegray', 'cream', 'smokybrown']
    const patterns: readonly Pattern[] = ['solid', 'spots', 'tabby', 'gradient', 'mittens']
    const eyesList: readonly Eyes[] = ['amber', 'lakeblue', 'emerald', 'odd']
    const species: readonly Species[] = ['cat', 'dog']
    body.innerHTML =
      section('物种 × 体型', species.flatMap(s => bodies.map(b => cell(`${s === 'cat' ? '猫' : '狗'}·${b}`, { species: s, body: b }))))
      + section('耳型', ears.flatMap(e => species.map(s => cell(`${e}·${s}`, { ears: e, species: s }))))
      + section('尾巴', tails.flatMap(t => species.map(s => cell(`${t}·${s}`, { tail: t, species: s }))))
      + section('毛色', furs.map(f => cell(f, { fur: f })))
      + section('花纹', patterns.map(p => cell(p, { pattern: p, fur: 'gray' })))
      + section('眼色', eyesList.map(e => cell(e, { eyes: e })))
      + section('配饰', ['none', 'scarf', 'bell', 'bowtie'].map(a => cell(a, { accessory: a as Traits['accessory'] })))
  }
  render()

  overlay.addEventListener('change', event => {
    const input = event.target as HTMLInputElement
    if (input.name === 'py-gstyle' && input.checked) {
      currentStyle = input.value as ArtStyleId
      render()
    }
  })
  overlay.addEventListener('click', event => {
    if (event.target === overlay || (event.target as HTMLElement).closest('.py-gallery-close') !== null) {
      closeGallery(stage)
    }
  })
}

export function closeGallery(stage: HTMLElement): void {
  stage.querySelector('.py-gallery')?.remove()
}
```

**`src/client/debug.ts` 精确编辑**：标题行 `'<div class="py-debug-title">小院调参台 …` 所在 innerHTML 数组中，「恢复跟随面板」按钮行后追加一行：

```ts
    '<div class="py-debug-row"><button data-act="gallery" type="button">立绘画廊</button></div>',
```

click 委托 switch 中 `case 'follow'` 分支后追加：

```ts
      case 'gallery': controller.openGallery(); break
```

**`src/client/yardController.ts` 精确编辑**：`snapshotState()` 方法前插入：

```ts
  /** 立绘画廊（美术 QA，A11）。 */
  openGallery(): void {
    openGallery(this.engine.getStageEl())
  }

```

并在 panels import 行后追加 `import { openGallery } from './ui/gallery.ts'`。`dispose()` 中 `closeCardModal(stage)` 行后追加 `closeGallery(stage)` 与对应 import（`import { closeGallery, openGallery } from './ui/gallery.ts'`，合并为一条）。

**`src/client/stage/actions.ts` 精确编辑**：STAGE_CSS 末尾（`.py-panel .achv-row` 规则后、闭合反引号前）追加：

```css
.py-gallery { position: absolute; inset: 0; z-index: 50; background: rgba(250,246,240,0.97); overflow: auto; padding: 12px; font-size: 13px; color: #4a3f35; }
.py-gallery-bar { position: sticky; top: 0; background: #fffdf8; border-bottom: 1px solid #e5d9c9; padding: 6px 8px; display: flex; gap: 14px; align-items: center; z-index: 1; }
.py-gallery-bar button { border: 1px solid #c9b8a5; background: #fff; border-radius: 7px; padding: 3px 10px; cursor: pointer; }
.py-gallery h3 { margin: 14px 0 6px; }
.py-gallery-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.py-gallery-cell { margin: 0; width: 96px; text-align: center; }
.py-gallery-cell svg { width: 96px; height: 104px; background: #fff; border: 1px solid #eee2d2; border-radius: 8px; }
.py-gallery-cell figcaption { font-size: 11px; color: #8a7a66; margin-top: 2px; }
```

**验证**：`npm run typecheck && npm run bundle` → 浏览器：调参台出现「立绘画廊」→ 打开 → geo 风格全矩阵渲染（物种×体型 6 格、耳/尾 8 格、毛色 10 格、花纹 5、眼色 4、配饰 4）；关闭正常。**截图入报告**。

---

## 3. CP2 — real 调色板

**`src/client/render/real/palette.ts`**（新建，整文件；**色值冻结**——风格一致性的一部分，微调走 A10 记录）：

```ts
import type { Fur } from '../../../core/types.ts'

/** real 风格四阶色 + 描边色（A3/A7）。 */
export interface RealPalette {
  /** 主色。 */
  readonly base: string
  /** 深色（阴影/花纹/耳内）。 */
  readonly deep: string
  /** 亮色（肚皮/胸口/高光过渡）。 */
  readonly light: string
  /** 白斑色（白手套/奶牛块/眉间点）。 */
  readonly white: string
  /** 描边（A4）。 */
  readonly line: string
}

export const REAL_PALETTE: Record<Fur, RealPalette> = {
  white:    { base: '#f4efe6', deep: '#d9cfbe', light: '#fbf8f1', white: '#ffffff', line: '#5b4a3c' },
  black:    { base: '#574f4a', deep: '#3e3733', light: '#726860', white: '#f4efe6', line: '#332c27' },
  orange:   { base: '#f0a35e', deep: '#d07f3a', light: '#f8c896', white: '#fdf4e7', line: '#8a5526' },
  gray:     { base: '#a8a8a4', deep: '#83837e', light: '#c6c6c1', white: '#f2f0ea', line: '#565450' },
  latte:    { base: '#d2b18b', deep: '#b28e64', light: '#e8d3b4', white: '#faf3e6', line: '#7c5c38' },
  cow:      { base: '#f2eee6', deep: '#45403a', light: '#fbf8f1', white: '#ffffff', line: '#3f3a34' },
  calico:   { base: '#f3e7d3', deep: '#d78c4a', light: '#faf3e6', white: '#ffffff', line: '#7c5c38' },
  bluegray: { base: '#97a3b4', deep: '#71808f', light: '#bfc9d6', white: '#f0f2f4', line: '#4c5561' },
  cream:    { base: '#f2e3c8', deep: '#d6bd97', light: '#faefdd', white: '#fffaf0', line: '#8a6f4d' },
  smokybrown: { base: '#9a8177', deep: '#77605a', light: '#b7a29a', white: '#efe6df', line: '#4f3f39' },
}

/** 眼色（A8；异瞳双色与 geo 一致）。 */
export const REAL_EYE: Record<Exclude<import('../../../core/types.ts').Eyes, 'odd'>, string> = {
  amber: '#c9852f',
  lakeblue: '#4f9bd1',
  emerald: '#4fae85',
}

export const REAL_ODD: { readonly left: string; readonly right: string } = {
  left: '#c9852f',
  right: '#4f9bd1',
}

/** 奶牛/三花的固有花斑（A7）：solid 下也显示。cow 用 deep 黑斑，calico 用 deep 橘斑 + white 白斑。 */
export function intrinsicPatches(fur: Fur): boolean {
  return fur === 'cow' || fur === 'calico'
}
```

**`tests/realPalette.spec.ts`**（新建，完整照抄）：

```ts
import { describe, expect, it } from 'vitest'
import { FUR_POOL } from '../src/core/traits.ts'
import { REAL_EYE, REAL_ODD, REAL_PALETTE } from '../src/client/render/real/palette.ts'

const HEX = /^#[0-9a-f]{6}$/

describe('real 调色板（A3/A7）', () => {
  it('10 毛色 × 5 色全为合法 hex', () => {
    for (const fur of FUR_POOL) {
      const p = REAL_PALETTE[fur]
      for (const color of [p.base, p.deep, p.light, p.white, p.line]) {
        expect(color, `${fur}.${color}`).toMatch(HEX)
      }
    }
  })
  it('眼色与异瞳', () => {
    expect(REAL_EYE.amber).toMatch(HEX)
    expect(REAL_ODD.left).not.toBe(REAL_ODD.right)
  })
  it('固有色斑标记', () => {
    expect(REAL_PALETTE.cow.deep).not.toBe(REAL_PALETTE.cow.base)
    expect(REAL_PALETTE.calico.deep).not.toBe(REAL_PALETTE.calico.base)
  })
})
```

**验证**：`npx vitest run tests/realPalette.spec.ts` 全绿。

---

## 4. CP3 — 主体：身形、物种件、白边（猫形完整范例）

**`src/client/render/real/parts.ts`**（新建；本 CP 落「主体」部分，CP4 续写五官——同一文件分两段落地）。文件头 + 主体：

```ts
import type { Accessory, Body, Ears, Eyes, Fur, Pattern, Species, Tail, Traits } from '../../../core/types.ts'
import { REAL_EYE, REAL_ODD, REAL_PALETTE, intrinsicPatches } from './palette.ts'

/**
 * 软萌手绘风部件（A1–A7）：正 faced 对称 chibi 坐姿。
 * 全部部件以 round 猫为基准形（REAL_BODY.round 的控制点写死），
 * 其余体型/物种按变体规则缩放/叠加（A6）。
 */

/** 体型参数（A2/A6）：h 为包络高度上限（对齐 geo 2*ry ±4）。 */
export interface RealBodyGeom {
  /** 身体最宽半宽（含描边余量）。 */
  readonly rx: number
  /** 包络高度（头顶 y = -h）。 */
  readonly h: number
  /** 头部中心 y（眼/耳定位基准）。 */
  readonly headY: number
  /** 眼睛横向偏移。 */
  readonly eyeX: number
  /** 耳朵锚点 x（y 由头顶弧推得）。 */
  readonly earX: number
}

export const REAL_BODY: Record<Body, RealBodyGeom> = {
  small: { rx: 26, h: 84, headY: -50, eyeX: 9.5, earX: 16 },
  round: { rx: 31, h: 92, headY: -55, eyeX: 11, earX: 19 },
  large: { rx: 35, h: 99, headY: -59, eyeX: 12.5, earX: 22 },
}

const r = (n: number): number => Math.round(n * 10) / 10

/**
 * 身体主路径（梨形豆丁：底窄中宽头顶圆）。
 * 以 round 基准控制点 + rx/h 比例缩放生成（A6 变体规则）：
 * round 基准点 → (x', y') = (x * rx/31, y * h/92)。
 */
export function bodyPath(g: RealBodyGeom): string {
  const sx = g.rx / 31
  const sy = g.h / 92
  const p = (x: number, y: number): string => `${r(x * sx)},${r(y * sy)}`
  // round 基准（脚底原点）：底左(-24,0) → 左腰(-31,-30) → 左肩(-23,-68) → 头左(-13,-88) → 顶(0,-92)（右侧镜像）
  return `M ${p(-24, 0)}`
    + ` C ${p(-31, -8)} ${p(-32, -20)} ${p(-31, -30)}`
    + ` C ${p(-29, -50)} ${p(-28, -58)} ${p(-23, -68)}`
    + ` C ${p(-19, -82)} ${p(-8, -92)} ${p(0, -92)}`
    + ` C ${p(8, -92)} ${p(19, -82)} ${p(23, -68)}`
    + ` C ${p(28, -58)} ${p(29, -50)} ${p(31, -30)}`
    + ` C ${p(32, -20)} ${p(31, -8)} ${p(24, 0)}`
    + ` C ${p(14, 3)} ${p(-14, 3)} ${p(-24, 0)} Z`
}

/** 贴纸白边（A4）：身体路径底层放大的浅描边。 */
function stickerHalo(g: RealBodyGeom): string {
  return `<path d="${bodyPath(g)}" fill="none" stroke="#fffdf8" stroke-width="8" stroke-linejoin="round"/>`
}

/** 身体 + 肚皮 + 前爪。 */
export function bodyPart(g: RealBodyGeom): string {
  const sy = g.h / 92
  return stickerHalo(g)
    + `<path d="${bodyPath(g)}" fill="var(--rb)" stroke="var(--ln)" stroke-width="2.5" stroke-linejoin="round"/>`
    + `<ellipse cx="0" cy="${r(-26 * sy)}" rx="${r(g.rx * 0.52)}" ry="${r(16 * sy)}" fill="var(--rl)" opacity="0.9"/>`
    + `<ellipse cx="${r(-g.rx * 0.24)}" cy="${r(-4 * sy)}" rx="${r(g.rx * 0.26)}" ry="5" fill="var(--rw)" stroke="var(--ln)" stroke-width="2"/>`
    + `<ellipse cx="${r(g.rx * 0.24)}" cy="${r(-4 * sy)}" rx="${r(g.rx * 0.26)}" ry="5" fill="var(--rw)" stroke="var(--ln)" stroke-width="2"/>`
    + `<path d="M ${r(-g.rx * 0.26 - 2)},${r(-9 * sy)} q 2,-3 4,0 M ${r(g.rx * 0.26 - 2)},${r(-9 * sy)} q 2,-3 4,0" fill="none" stroke="var(--ln)" stroke-width="1.6" stroke-linecap="round"/>`
}

/** 腮红 + 嘴（ω）。 */
export function facePart(g: RealBodyGeom): string {
  const sy = g.h / 92
  const mouthY = g.headY + 12 * sy
  return `<ellipse cx="${r(-g.rx * 0.62)}" cy="${r(g.headY + 6 * sy)}" rx="4.5" ry="2.8" fill="#f2a9a0" opacity="0.55"/>`
    + `<ellipse cx="${r(g.rx * 0.62)}" cy="${r(g.headY + 6 * sy)}" rx="4.5" ry="2.8" fill="#f2a9a0" opacity="0.55"/>`
    + `<path d="M -4,${r(mouthY)} q 2,3 4,0 q 2,3 4,0" fill="none" stroke="var(--ln)" stroke-width="1.8" stroke-linecap="round"/>`
}

/** 物种件（A6）：狗 = 嘴吻 + 鼻 + 眉点；猫 = 胡须。 */
export function speciesPart(g: RealBodyGeom, species: Species): string {
  const sy = g.h / 92
  const my = g.headY + 10 * sy
  if (species === 'dog') {
    return `<ellipse cx="0" cy="${r(my)}" rx="${r(g.rx * 0.3)}" ry="${r(6.5 * sy)}" fill="var(--rl)" stroke="var(--ln)" stroke-width="1.8"/>`
      + `<path d="M -3.5,${r(my - 3 * sy)} q 3.5,-3 7,0 q -1,3.5 -3.5,3.5 q -2.5,0 -3.5,-3.5 Z" fill="var(--ln)"/>`
      + `<circle cx="${r(-g.eyeX)}" cy="${r(g.headY - 9 * sy)}" r="1.4" fill="var(--ln)"/>`
      + `<circle cx="${r(g.eyeX)}" cy="${r(g.headY - 9 * sy)}" r="1.4" fill="var(--ln)"/>`
  }
  const wx = g.rx * 0.52
  return `<g stroke="var(--ln)" stroke-width="1.2" stroke-linecap="round" opacity="0.75">`
    + `<path d="M ${r(-wx)},${r(my - 2)} q -7,-1 -11,-3"/>`
    + `<path d="M ${r(-wx)},${r(my)} q -7,1 -11,3"/>`
    + `<path d="M ${r(wx)},${r(my - 2)} q 7,-1 11,-3"/>`
    + `<path d="M ${r(wx)},${r(my)} q 7,1 11,3"/></g>`
}
```

**变体规则（A6，写进文件顶注释）**：small/large 不重画路径——`REAL_BODY` 表给出 rx/h/headY/eyeX/earX，全部部件只读这五个参数（身体路径内部按 `sx/sy` 比例缩放）。物种差异只叠加 `speciesPart`，身形不变。

**CP3 画廊目检**：此时间渲染未组装——跳过画廊，直接以单元测试做结构验证：

**`tests/realStyle.spec.ts`**（新建，先落主体用例；CP4/CP5 扩充）：

```ts
import { describe, expect, it } from 'vitest'
import { REAL_BODY, bodyPath } from '../src/client/render/real/parts.ts'

describe('real 主体（A2/A6）', () => {
  it('包络高度对齐 geo ±4（气泡锚点耦合）', () => {
    const geoHeight = { small: 48, round: 50, large: 60 }
    for (const [body, g] of Object.entries(REAL_BODY)) {
      expect(Math.abs(g.h - geoHeight[body as keyof typeof geoHeight])).toBeLessThanOrEqual(4)
    }
  })
  it('身体路径闭合且以脚底为原点（含 M…Z）', () => {
    for (const g of Object.values(REAL_BODY)) {
      const d = bodyPath(g)
      expect(d.startsWith('M ')).toBe(true)
      expect(d.endsWith('Z')).toBe(true)
      expect(d.match(/Z/g)?.length).toBe(1)
    }
  })
  it('体型单调：rx 与 h 随 small→large 递增', () => {
    expect(REAL_BODY.small.rx).toBeLessThan(REAL_BODY.round.rx)
    expect(REAL_BODY.round.rx).toBeLessThan(REAL_BODY.large.rx)
    expect(REAL_BODY.small.h).toBeLessThan(REAL_BODY.large.h)
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/realStyle.spec.ts tests/realPalette.spec.ts`。

---

## 5. CP4 — 五官与配件（耳/尾/眼/花纹/配饰）

**`src/client/render/real/parts.ts` 续写**（文件末尾追加；**范例路径为 round 基准，落地时按锚点平移 + 按 `sy = h/92` 纵向缩放**）：

```ts

/** 耳朵：锚点 (±earX, 头顶弧面 y)，四种耳型 × 物种微调（狗耳整体宽 1.15 倍）。 */
export function earsPart(g: RealBodyGeom, ears: Ears, species: Species): string {
  const sy = g.h / 92
  const topY = -g.h + 6 * sy
  const k = species === 'dog' ? 1.15 : 1
  const one = (side: 1 | -1): string => {
    const x = side * g.earX
    const mirror = side === -1 ? ` transform="translate(${r(2 * x)},0) scale(-1,1)"` : ''
    const group = (shape: string, inner: string): string =>
      `<g${mirror}>${shape}${inner}</g>`
    switch (ears) {
      case 'erect':
        return group(
          `<path d="M ${r(x - 7 * k)},${r(topY + 10)} C ${r(x - 6 * k)},${r(topY - 4)} ${r(x - 2)},${r(topY - 8)} ${r(x + 5 * k)},${r(topY - 7)} C ${r(x + 8 * k)},${r(topY + 2)} ${r(x + 7 * k)},${r(topY + 8)} ${r(x + 5 * k)},${r(topY + 11)} Z" fill="var(--rb)" stroke="var(--ln)" stroke-width="2.2" stroke-linejoin="round"/>`,
          `<path d="M ${r(x - 3 * k)},${r(topY + 7)} C ${r(x - 2 * k)},${r(topY - 1)} ${r(x + 1)},${r(topY - 3)} ${r(x + 4 * k)},${r(topY - 2)} C ${r(x + 5 * k)},${r(topY + 3)} ${r(x + 4 * k)},${r(topY + 6)} ${r(x + 3 * k)},${r(topY + 8)} Z" fill="var(--rd)"/>`,
        )
      case 'fold':
        return group(
          `<path d="M ${r(x - 6 * k)},${r(topY + 11)} C ${r(x - 6 * k)},${r(topY + 2)} ${r(x - 1)},${r(topY - 2)} ${r(x + 6 * k)},${r(topY + 1)} C ${r(x + 7 * k)},${r(topY + 6)} ${r(x + 5 * k)},${r(topY + 10)} ${r(x + 2 * k)},${r(topY + 12)} Z" fill="var(--rb)" stroke="var(--ln)" stroke-width="2.2" stroke-linejoin="round"/>`,
          `<path d="M ${r(x + 1 * k)},${r(topY + 3)} q 3,2 3,6" fill="none" stroke="var(--rd)" stroke-width="1.8" stroke-linecap="round"/>`,
        )
      case 'droop':
        return group(
          `<path d="M ${r(x - 5 * k)},${r(topY + 9)} C ${r(x - 8 * k)},${r(topY + 18)} ${r(x - 6 * k)},${r(topY + 30)} ${r(x + 1)},${r(topY + 33)} C ${r(x + 7 * k)},${r(topY + 33)} ${r(x + 8 * k)},${r(topY + 24)} ${r(x + 5 * k)},${r(topY + 12)} Z" fill="var(--rb)" stroke="var(--ln)" stroke-width="2.2" stroke-linejoin="round"/>`,
          `<path d="M ${r(x - 1)},${r(topY + 14)} C ${r(x - 3 * k)},${r(topY + 21)} ${r(x - 2 * k)},${r(topY + 27)} ${r(x + 1)},${r(topY + 29)}" fill="none" stroke="var(--rd)" stroke-width="1.8" stroke-linecap="round"/>`,
        )
      case 'elf':
        return group(
          `<path d="M ${r(x - 4 * k)},${r(topY + 10)} C ${r(x - 8 * k)},${r(topY + 2)} ${r(x - 12 * k)},${r(topY - 9)} ${r(x - 10 * k)},${r(topY - 13)} C ${r(x - 4 * k)},${r(topY - 11)} ${r(x + 3)},${r(topY - 4)} ${r(x + 6 * k)},${r(topY + 8)} Z" fill="var(--rb)" stroke="var(--ln)" stroke-width="2.2" stroke-linejoin="round"/>`,
          `<path d="M ${r(x - 6 * k)},${r(topY + 4)} C ${r(x - 8 * k)},${r(topY - 3)} ${r(x - 9 * k)},${r(topY - 8)} ${r(x - 8 * k)},${r(topY - 10)}" fill="none" stroke="var(--rd)" stroke-width="1.6" stroke-linecap="round"/>`,
        )
    }
  }
  return one(1) + one(-1)
}

/** 尾巴：锚点 (rx*0.82, -16*sy)，四种。 */
export function tailPart(g: RealBodyGeom, tail: Tail): string {
  const sy = g.h / 92
  const ax = r(g.rx * 0.82)
  const ay = r(-16 * sy)
  switch (tail) {
    case 'short':
      return `<path d="M ${ax},${ay} q 8,2 9,-6" fill="none" stroke="var(--rb)" stroke-width="8" stroke-linecap="round"/>`
        + `<path d="M ${ax},${ay} q 8,2 9,-6" fill="none" stroke="var(--ln)" stroke-width="2" stroke-linecap="round" opacity="0.35"/>`
    case 'long':
      return `<path d="M ${ax},${ay} q 12,-2 15,-16 q 2,-11 -4,-16" fill="none" stroke="var(--rb)" stroke-width="9" stroke-linecap="round"/>`
        + `<path d="M ${ax},${ay} q 12,-2 15,-16 q 2,-11 -4,-16" fill="none" stroke="var(--ln)" stroke-width="2" stroke-linecap="round" opacity="0.35"/>`
    case 'fluffy':
      return `<path d="M ${ax},${ay} q 10,-4 12,-15 q 1,-8 -3,-13 l -6,6 q -2,10 -8,16 Z" fill="var(--rb)" stroke="var(--ln)" stroke-width="2.2" stroke-linejoin="round"/>`
        + `<ellipse cx="${r(ax + 6)}" cy="${r(ay - 18)}" rx="7" ry="9" fill="var(--rl)" opacity="0.7"/>`
    case 'curl':
      return `<path d="M ${ax},${ay} q 10,-1 12,-10 q 1,-8 -6,-10 q -5,-1 -7,3 q -1,3 2,4 q 3,1 4,-2" fill="none" stroke="var(--rb)" stroke-width="7.5" stroke-linecap="round"/>`
        + `<circle cx="${r(ax + 6)}" cy="${r(ay - 14)}" r="2" fill="var(--rw)"/>`
  }
}

/** 眼睛（A8）：大圆眼 + 深瞳 + 双高光。 */
export function eyesPart(g: RealBodyGeom, eyes: Eyes): string {
  const sy = g.h / 92
  const ey = r(g.headY + 2 * sy)
  const left = eyes === 'odd' ? REAL_ODD.left : REAL_EYE[eyes]
  const right = eyes === 'odd' ? REAL_ODD.right : REAL_EYE[eyes]
  const one = (x: number, color: string): string =>
    `<ellipse cx="${r(x)}" cy="${ey}" rx="5.2" ry="6" fill="${color}" stroke="var(--ln)" stroke-width="1.6"/>`
      + `<ellipse cx="${r(x)}" cy="${ey + 1}" rx="2.2" ry="3.4" fill="#33281f"/>`
      + `<circle cx="${r(x - 1.8)}" cy="${r(ey - 2.2)}" r="1.5" fill="#fff"/>`
      + `<circle cx="${r(x + 1.6)}" cy="${r(ey + 2)}" r="0.8" fill="#fff" opacity="0.85"/>`
  return one(-g.eyeX, left) + one(g.eyeX, right)
}

/** 花纹（A5/A7）：裁剪到身体；奶牛/三花 solid 也加固有斑。 */
export function patternPart(g: RealBodyGeom, pattern: Pattern, fur: Fur, uid: string): string {
  const clip = `clip-path="url(#${uid}-body)"`
  const sy = g.h / 92
  const patches = fur === 'cow'
    ? `<ellipse cx="${r(-g.rx * 0.5)}" cy="${r(-64 * sy)}" rx="9" ry="7" fill="var(--rd)"/>`
      + `<ellipse cx="${r(g.rx * 0.55)}" cy="${r(-30 * sy)}" rx="8" ry="9" fill="var(--rd)"/>`
      + `<ellipse cx="${r(g.rx * 0.4)}" cy="${r(-70 * sy)}" rx="6" ry="5" fill="var(--rw)" opacity="0.9"/>`
    : fur === 'calico'
      ? `<ellipse cx="${r(-g.rx * 0.45)}" cy="${r(-60 * sy)}" rx="8" ry="7" fill="var(--rd)"/>`
        + `<ellipse cx="${r(g.rx * 0.5)}" cy="${r(-38 * sy)}" rx="7" ry="8" fill="var(--rd)"/>`
        + `<ellipse cx="0" cy="${r(-74 * sy)}" rx="6" ry="5" fill="var(--rw)"/>`
      : ''
  const extra = (() => {
    switch (pattern) {
      case 'solid':
        return ''
      case 'spots':
        return `<ellipse cx="${r(-g.rx * 0.35)}" cy="${r(-56 * sy)}" rx="6" ry="5" fill="var(--rd)"/>`
          + `<ellipse cx="${r(g.rx * 0.3)}" cy="${r(-40 * sy)}" rx="5" ry="6" fill="var(--rd)"/>`
          + `<ellipse cx="${r(g.rx * 0.15)}" cy="${r(-72 * sy)}" rx="4" ry="3.5" fill="var(--rd)"/>`
      case 'tabby':
        return `<path d="M -9,${r(-84 * sy)} q 1,6 0,10 M 0,${r(-87 * sy)} q 1,7 0,12 M 9,${r(-84 * sy)} q -1,6 0,10" stroke="var(--rd)" stroke-width="3.4" stroke-linecap="round" fill="none"/>`
          + `<path d="M ${r(-g.rx * 0.7)},${r(-34 * sy)} q 6,2 10,0 M ${r(g.rx * 0.7)},${r(-34 * sy)} q -6,2 -10,0" stroke="var(--rd)" stroke-width="3" stroke-linecap="round" fill="none"/>`
      case 'gradient':
        return `<path d="M ${r(-g.rx)},${r(-44 * sy)} q ${g.rx},14 ${2 * g.rx},0 L ${g.rx},0 L ${r(-g.rx)},0 Z" fill="var(--rl)" opacity="0.75"/>`
          + `<ellipse cx="0" cy="${r(-12 * sy)}" rx="${r(g.rx * 0.6)}" ry="7" fill="var(--rw)" opacity="0.6"/>`
      case 'mittens':
        return `<ellipse cx="${r(-g.rx * 0.24)}" cy="${r(-5 * sy)}" rx="${r(g.rx * 0.27)}" ry="5.5" fill="var(--rw)"/>`
          + `<ellipse cx="${r(g.rx * 0.24)}" cy="${r(-5 * sy)}" rx="${r(g.rx * 0.27)}" ry="5.5" fill="var(--rw)"/>`
          + `<ellipse cx="0" cy="${r(-70 * sy)}" rx="${r(g.rx * 0.4)}" ry="${r(9 * sy)}" fill="var(--rw)" opacity="0.95"/>`
          + `<path d="M ${r(-g.eyeX - 3)},${r(-g.h + 8 * sy)} q 3,-2 6,0 q 3,-2 6,0" stroke="var(--rw)" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
    }
  })()
  if (patches === '' && extra === '') return ''
  return `<g ${clip}>${patches}${extra}</g>`
}

/** 配饰。 */
export function accessoryPart(g: RealBodyGeom, accessory: Accessory): string {
  const sy = g.h / 92
  const ny = r(-56 * sy)
  switch (accessory) {
    case 'none':
      return ''
    case 'scarf':
      return `<path d="M ${r(-g.rx * 0.8)},${r(-48 * sy)} q ${g.rx * 0.8},10 ${g.rx * 1.6},0 l -1,7 q ${r(-g.rx * 0.79)},9 ${r(-g.rx * 1.58)},0 Z" fill="#e07a5f" stroke="#b5543f" stroke-width="1.8" stroke-linejoin="round"/>`
        + `<path d="M ${r(g.rx * 0.3)},${r(-44 * sy)} l 5,12 l -9,1 Z" fill="#cf6b50" stroke="#b5543f" stroke-width="1.6" stroke-linejoin="round"/>`
    case 'bell':
      return `<path d="M ${r(-g.rx * 0.55)},${r(-52 * sy)} q ${g.rx * 0.55},6 ${g.rx * 1.1},0" fill="none" stroke="#d98e32" stroke-width="2" stroke-linecap="round"/>`
        + `<circle cx="0" cy="${r(ny + 6)}" r="4.6" fill="#f0c04a" stroke="#b8860b" stroke-width="1.6"/>`
        + `<circle cx="0" cy="${r(ny + 7.4)}" r="1.3" fill="#7a5f1d"/>`
    case 'bowtie':
      return `<polygon points="${r(-4)},${ny} ${r(-14)},${r(ny - 5)} ${r(-14)},${r(ny + 5)}" fill="#e07a5f" stroke="#b5543f" stroke-width="1.6" stroke-linejoin="round"/>`
        + `<polygon points="${r(4)},${ny} ${r(14)},${r(ny - 5)} ${r(14)},${r(ny + 5)}" fill="#e07a5f" stroke="#b5543f" stroke-width="1.6" stroke-linejoin="round"/>`
        + `<circle cx="0" cy="${ny}" r="2.6" fill="#b5543f"/>`
  }
}
```

**CP4 画廊目检**：parts 尚未组装成完整 render——继续结构测试（追加到 `tests/realStyle.spec.ts`）：

```ts
import { accessoryPart, earsPart, eyesPart, patternPart, tailPart } from '../src/client/render/real/parts.ts'

describe('real 五官与配件（A5–A8）', () => {
  const G = REAL_BODY.round
  it('四耳型 × 二物种全部产出非空描边图形', () => {
    for (const ears of ['erect', 'fold', 'droop', 'elf'] as const) {
      for (const species of ['cat', 'dog'] as const) {
        const s = earsPart(G, ears, species)
        expect(s.length).toBeGreaterThan(40)
        expect(s).toContain('stroke="var(--ln)"')
      }
    }
  })
  it('异瞳双色 / 常规眼同色', () => {
    const odd = eyesPart(G, 'odd')
    expect(odd).toContain('#c9852f')
    expect(odd).toContain('#4f9bd1')
    const amber = eyesPart(G, 'amber')
    expect(amber.match(/#c9852f/g)?.length).toBe(2)
    expect(amber).not.toContain('#4f9bd1')
  })
  it('花纹裁剪引用 uid clipPath；奶牛固有斑', () => {
    expect(patternPart(G, 'spots', 'gray', 'u1')).toContain('url(#u1-body)')
    expect(patternPart(G, 'solid', 'cow', 'u1')).toContain('var(--rd)')
    expect(patternPart(G, 'solid', 'white', 'u1')).toBe('')
  })
  it('配饰三件产出固定色；none 为空', () => {
    expect(accessoryPart(G, 'scarf')).toContain('#e07a5f')
    expect(accessoryPart(G, 'bell')).toContain('#f0c04a')
    expect(accessoryPart(G, 'bowtie')).toContain('#e07a5f')
    expect(accessoryPart(G, 'none')).toBe('')
  })
  it('四尾型非空', () => {
    for (const t of ['short', 'long', 'fluffy', 'curl'] as const) {
      expect(tailPart(G, t).length).toBeGreaterThan(30)
    }
  })
})
```

**验证**：`npm run typecheck && npx vitest run tests/realStyle.spec.ts`。

---

## 6. CP5 — 组装与注册

**`src/client/render/realSprite.ts`**（新建，整文件）：

```ts
import type { Traits } from '../../core/types.ts'
import { REAL_BODY, accessoryPart, bodyPart, bodyPath, earsPart, eyesPart, facePart, patternPart, speciesPart, tailPart } from './real/parts.ts'
import { REAL_PALETTE } from './real/palette.ts'

/**
 * 软萌手绘风 sprite 组装（A1–A5）。
 * 图层：白边+身体（含肚皮/前爪）→ 花纹（裁剪）→ 物种件 → 耳朵 → 眼 → 腮红嘴 → 配饰 → 尾巴（尾在身体后侧，故先画）。
 */
export function realSpriteMarkup(traits: Traits, uid: string): string {
  const g = REAL_BODY[traits.body]
  const p = REAL_PALETTE[traits.fur]
  return `<g class="py-sprite" style="--rb:${p.base};--rd:${p.deep};--rl:${p.light};--rw:${p.white};--ln:${p.line}">`
    + `<defs><clipPath id="${uid}-body"><path d="${bodyPath(g)}"/></clipPath></defs>`
    + tailPart(g, traits.tail)
    + bodyPart(g)
    + patternPart(g, traits.pattern, traits.fur, uid)
    + speciesPart(g, traits.species)
    + earsPart(g, traits.ears, traits.species)
    + eyesPart(g, traits.eyes)
    + facePart(g)
    + accessoryPart(g, traits.accessory)
    + `</g>`
}
```

**`src/client/render/styles.ts` 精确编辑**：

① import 区 `import { petSpriteMarkup } from './petSprite.ts'` 行后追加：

```ts
import { realSpriteMarkup } from './realSprite.ts'
```

② `GEO_STYLE` 定义块后追加：

```ts
/** 软萌手绘风：最终版猫狗美术（A 工作流产出）。 */
export const REAL_STYLE: ArtStyle = {
  id: 'real',
  labelZh: '软萌手绘',
  render: realSpriteMarkup,
  portraitBox: { x: -54, y: -112, w: 108, h: 118 },
}
```

③ 注册表改为：

```ts
export const STYLE_REGISTRY: Readonly<Partial<Record<ArtStyleId, ArtStyle>>> = {
  geo: GEO_STYLE,
  real: REAL_STYLE,
}
```

④ `STYLE_REGISTRY` 上方注释行 `/** 已注册风格表；'real'（最终版美术）为预留 id，注册前不可选。 */` 改为 `/** 已注册风格表（A12）。 */`。

**`tests/realStyle.spec.ts` 追加组装用例**：

```ts
import { realSpriteMarkup } from '../src/client/render/realSprite.ts'
import type { Traits } from '../src/core/types.ts'

describe('real 组装（A2/A3/A5）', () => {
  const T: Traits = {
    species: 'cat', body: 'round', ears: 'erect', fur: 'orange',
    pattern: 'solid', tail: 'fluffy', eyes: 'amber', accessory: 'none',
  }
  it('五变量注入 + clipPath uid + 结构', () => {
    const s = realSpriteMarkup(T, 'u9')
    for (const v of ['--rb', '--rd', '--rl', '--rw', '--ln']) expect(s).toContain(`${v}:`)
    expect(s).toContain('id="u9-body"')
    expect(s).toContain('class="py-sprite"')
    expect(s.endsWith('</g>')).toBe(true)
  })
  it('全维度组合抽样 2000：非空且 uid 隔离', () => {
    const bodies = ['small', 'round', 'large'] as const
    const ears = ['erect', 'fold', 'droop', 'elf'] as const
    const furs = ['white', 'black', 'orange', 'gray', 'latte', 'cow', 'calico', 'bluegray', 'cream', 'smokybrown'] as const
    const patterns = ['solid', 'spots', 'tabby', 'gradient', 'mittens'] as const
    const tails = ['short', 'long', 'fluffy', 'curl'] as const
    const eyes = ['amber', 'lakeblue', 'emerald', 'odd'] as const
    const accs = ['none', 'scarf', 'bell', 'bowtie'] as const
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const traits: Traits = {
        species: i % 2 === 0 ? 'cat' : 'dog',
        body: bodies[i % 3]!, ears: ears[i % 4]!, fur: furs[i % 10]!,
        pattern: patterns[i % 5]!, tail: tails[i % 4]!, eyes: eyes[i % 4]!, accessory: accs[i % 4]!,
      }
      const s = realSpriteMarkup(traits, `s${i}`)
      expect(s.length).toBeGreaterThan(120)
      expect(s).toContain(`id="s${i}-body"`)
      seen.add(s)
    }
    expect(seen.size).toBe(2000)   // 组合互异（不同 traits 产出不同 markup）
  })
  it('确定性：同 traits 同 uid 同输出', () => {
    expect(realSpriteMarkup(T, 'a1')).toBe(realSpriteMarkup(T, 'a1'))
  })
})
```

**验证**：`npm run typecheck && npm run test && npm run bundle`。浏览器：设置面板 → 风格出现「软萌手绘」→ 切换 → 舞台/头像条/档案卡全部变为新风格；调参台「立绘画廊」→ 切 real → 全矩阵渲染。**对画廊逐区块截图（物种×体型 / 耳 / 尾 / 毛色 / 花纹 / 眼 / 配饰 + 舞台 + 档案卡 + 头像条）**。

---

## 7. CP6 — 打磨轮与验收

1. 执行者自查截图，按 §8 清单逐项核对明显问题（描边断裂/五官错位/包络越界/色斑溢出裁剪）。
2. 产出 `docs/art-report.md`，附「视觉问题自查清单」：每条 = 位置（哪个区块哪个 cell）+ 现象 + 是否已修。
3. **用户看图反馈** → 执行者按 A10 允许的参数迭代（坐标/色值/缩放系数），每次迭代重新 `npm run bundle` → 画廊热更新 → 再截图。此循环可多轮。
4. 终验：`npm run typecheck && npm run test`（既有 132 + realPalette 3 + realStyle 主体/五官/组装 ≈ 12+ = 145+）全绿；geo 与 real 双风格均可用；F5 后风格选择保留；合影/明信片/图鉴在 real 风格下正常。

---

## 8. 视觉自查清单（CP6 用）

- 身体：白边完整包裹（无断口）；肚皮/前爪不越出身体路径；三体型轮廓连贯（无尖角）。
- 耳朵：四型可辨识（立/折/垂/精灵外撇）；左右镜像对称；狗耳略宽；耳内色块在耳形内。
- 尾巴：四型可辨识；不遮脸部；fluffy/curl 不越 portraitBox 右界。
- 眼睛：双眼等高对称；异瞳左右分明；高光点不吞瞳孔。
- 花纹：全部落在身体裁剪内（无溢出）；tabby 条纹在头顶弧面内；mittens 白爪与前爪重合自然。
- 物种件：狗鼻/嘴吻居中；猫胡须不穿腮红。
- 配饰：围巾绕颈部弧度贴合；铃铛/蝴蝶结居中不遮嘴。
- 舞台实景：名字牌/气泡/徽章位置正确（包络约束生效）；动作 keyframes 下形体正常（squish/flatten 不破相）；档案卡 2.4× 缩放清晰。

---

## 9. 决策树

**D1 测试失败 / D2 typecheck**：同既有规程（先查笔误；模板矛盾停下记录；禁删断言；不用 `any`）。
**D3 画廊空白/某 cell 缺失**：console 看渲染异常；检查 uid 前缀（`ga-区块-序号`）；某 cell 空 → 对应部件函数返回空串（如 solid+白毛），属正常。
**D4 切换风格后舞台未变**：`engine.restyle` 依赖 `syncPets` 新建路径用 `styleOf(this.styleId)`——已注册后自动生效；F5 强刷验证持久化选择。
**D5 气泡/名字错位**：包络越界（A2）——对照 `REAL_BODY.h` 与 geo 高度差，缩放路径 sy 系数。
**D6 合影里 real 风格颜色丢失**：确认五变量全部写在根 g 的 style 属性（内联），非外部 CSS。
**D7 路径渲染畸形**（自交/尖刺）：回到变体规则——只调控制点数值（A10），不改变点数与结构。

## 10. 禁止事项

1. 不修改 §0.3-1 列出文件；锚点编辑仅限列出的三文件四处。
2. 不改 `ArtStyle` 契约、注册表结构、geo 风格任何内容、core 任何内容。
3. 不引入位图/外部资源/新依赖——纯 SVG 路径代码。
4. 不做额外风格（只交付 `real` 一种）。
5. 包络硬约束（A2）与五变量命名（A3）不可违反。
