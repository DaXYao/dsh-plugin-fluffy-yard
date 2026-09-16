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
