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
