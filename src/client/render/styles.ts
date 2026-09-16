import type { ArtStyleId, Traits } from '../../core/types.ts'
import { petSpriteMarkup } from './petSprite.ts'
import { realSpriteMarkup } from './realSprite.ts'

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

/** 软萌手绘风：最终版猫狗美术（A 工作流产出）。 */
export const REAL_STYLE: ArtStyle = {
  id: 'real',
  labelZh: '软萌手绘',
  render: realSpriteMarkup,
  portraitBox: { x: -32, y: -66, w: 64, h: 72 },
}

/** 已注册风格表（A12）。 */
export const STYLE_REGISTRY: Readonly<Partial<Record<ArtStyleId, ArtStyle>>> = {
  geo: GEO_STYLE,
  real: REAL_STYLE,
}

/** 可供用户选择的风格 = 已注册者（设置面板数据源，M11）。 */
export function availableStyles(): readonly ArtStyle[] {
  return Object.values(STYLE_REGISTRY).filter((s): s is ArtStyle => s !== undefined)
}

/** 按 id 取风格；未注册（含预留 'real'）回退 geo（M1）。 */
export function styleOf(id: ArtStyleId): ArtStyle {
  return STYLE_REGISTRY[id] ?? GEO_STYLE
}
