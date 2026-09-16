import type { ArtStyleId, Pet } from '../../core/types.ts'
import { personalityOf } from '../../core/traits.ts'
import { BODY_ZH, EYES_ZH, PATTERN_ZH, PERSONALITY_ZH, SPECIES_ZH, traitTags } from './labels.ts'
import { styleOf } from './styles.ts'

export const CARD_W = 540
export const CARD_H = 720
const PORTRAIT_SCALE = 2.4
const PORTRAIT_FOOT_Y = 520

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 宠物档案卡 SVG（M7/G12）；opts.leftAt 存在时（图鉴回看）页脚附告别日期。 */
export function cardSvg(pet: Pet, artStyle: ArtStyleId | undefined, opts: { readonly leftAt?: number } = {}): string {
  const style = styleOf(artStyle ?? 'geo')
  const no = pet.id.slice(2)
  const tags = traitTags(pet.traits).join(' · ')
  const detail = [
    SPECIES_ZH[pet.traits.species], BODY_ZH[pet.traits.body],
    PATTERN_ZH[pet.traits.pattern], EYES_ZH[pet.traits.eyes],
  ].join(' · ')
  const date = new Date(pet.arrivedAt).toLocaleDateString('zh-CN')
  const personality = PERSONALITY_ZH[personalityOf(pet.passion)]
  const cycleMark = pet.cycle >= 2 ? ' ⭐二世' : ''
  const farewell = opts.leftAt === undefined ? '' : ` · 告别于 ${new Date(opts.leftAt).toLocaleDateString('zh-CN')}`
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
    + `<text x="${cx}" y="682" font-family="sans-serif" font-size="15" fill="#a89880" text-anchor="middle">相遇于 ${date}${farewell} · ${style.labelZh} · 毛茸茸小院</text>`
    + `</svg>`
}

export function cardFileName(pet: Pet): string {
  return `档案卡_№${pet.id.slice(2)}_${pet.name}.png`
}
