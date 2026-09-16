import type { Accessory, Body, Ears, Eyes, Fur, Pattern, Species, Tail, Traits } from '../../../core/types.ts'
import { REAL_EYE, REAL_ODD } from './palette.ts'

/**
 * 软萌手绘风部件（A1–A7）：正 faced 对称 chibi 坐姿。
 * 全部部件以 round 猫为基准形（REAL_BODY.round 的控制点写死），
 * 其余体型/物种按变体规则缩放/叠加（A6）。
 *
 * 变体规则（A6）：small/large 不重画路径——REAL_BODY 表给出 rx/h/headY/eyeX/earX，
 * 全部部件只读这五个参数（身体路径内部按 sx/sy 比例缩放）。
 * 物种差异只叠加 speciesPart，身形不变。
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
  small: { rx: 16.2, h: 48, headY: -28.7, eyeX: 5.8, earX: 10 },
  round: { rx: 16.8, h: 50, headY: -29.9, eyeX: 6, earX: 10.3 },
  large: { rx: 20.2, h: 60, headY: -35.9, eyeX: 7.2, earX: 12.4 },
}

/**
 * 绘制基准形（A6）：全部部件按此尺寸绘制（92 高基准），
 * realSpriteMarkup 再按 REAL_BODY.h/92 整体等比缩放对齐 A2 包络。
 * （模板原表 84/92/99 违反 A2 硬约束——见 art-report 偏差记录。）
 */
export const REAL_BASE: RealBodyGeom = { rx: 31, h: 92, headY: -55, eyeX: 11, earX: 19 }

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
      + `<ellipse cx="${r(x)}" cy="${r(ey + 1)}" rx="2.2" ry="3.4" fill="#33281f"/>`
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
        return `<path d="M ${r(-g.rx)},${r(-44 * sy)} q ${g.rx},14 ${2 * g.rx},0 L ${r(g.rx)},0 L ${r(-g.rx)},0 Z" fill="var(--rl)" opacity="0.75"/>`
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
      return `<polygon points="-4,${ny} -14,${r(ny - 5)} -14,${r(ny + 5)}" fill="#e07a5f" stroke="#b5543f" stroke-width="1.6" stroke-linejoin="round"/>`
        + `<polygon points="4,${ny} 14,${r(ny - 5)} 14,${r(ny + 5)}" fill="#e07a5f" stroke="#b5543f" stroke-width="1.6" stroke-linejoin="round"/>`
        + `<circle cx="0" cy="${ny}" r="2.6" fill="#b5543f"/>`
  }
}
