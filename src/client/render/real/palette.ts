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
