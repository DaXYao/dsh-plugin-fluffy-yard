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
