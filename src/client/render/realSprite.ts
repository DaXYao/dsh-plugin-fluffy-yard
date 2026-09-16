import type { Traits } from '../../core/types.ts'
import { REAL_BODY, REAL_BASE, accessoryPart, bodyPart, bodyPath, earsPart, eyesPart, facePart, patternPart, speciesPart, tailPart } from './real/parts.ts'
import { REAL_PALETTE } from './real/palette.ts'

/**
 * 软萌手绘风 sprite 组装（A1–A5）。
 * 图层：白边+身体（含肚皮/前爪）→ 花纹（裁剪）→ 物种件 → 耳朵 → 眼 → 腮红嘴 → 配饰 → 尾巴（尾在身体后侧，故先画）。
 * 部件统一按 92 高基准形（REAL_BASE）绘制，外层按体型等比缩放（REAL_BODY.h/92）对齐 A2 geo 包络。
 */
export function realSpriteMarkup(traits: Traits, uid: string): string {
  const p = REAL_PALETTE[traits.fur]
  const k = REAL_BODY[traits.body].h / REAL_BASE.h
  return `<g class="py-sprite" style="--rb:${p.base};--rd:${p.deep};--rl:${p.light};--rw:${p.white};--ln:${p.line}">`
    + `<g transform="scale(${Math.round(k * 1000) / 1000})">`
    + `<defs><clipPath id="${uid}-body"><path d="${bodyPath(REAL_BASE)}"/></clipPath></defs>`
    + tailPart(REAL_BASE, traits.tail)
    + bodyPart(REAL_BASE)
    + patternPart(REAL_BASE, traits.pattern, traits.fur, uid)
    + speciesPart(REAL_BASE, traits.species)
    + earsPart(REAL_BASE, traits.ears, traits.species)
    + eyesPart(REAL_BASE, traits.eyes)
    + facePart(REAL_BASE)
    + accessoryPart(REAL_BASE, traits.accessory)
    + `</g></g>`
}
