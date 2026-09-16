import type { Rng } from './rng.ts'
import type { Species } from './types.ts'

/**
 * 自动起名器（需求 §4.1）：音节前缀+后缀拼接，猫狗各有风格池。
 * 名字允许重复（唯一性只约束特征组合）；池内容冻结不改（§L3）。
 */
export const CAT_PREFIX = [
  '汤', '年', '布', '团', '雪', '奶', '麻', '豆', '橘', '糯',
  '芝', '椰', '杏', '芋', '糖', '云', '雾', '抹', '小', '圆',
] as const

export const CAT_SUFFIX = [
  '圆', '糕', '丁', '团', '球', '糖', '薯', '包', '子', '茸',
  '蓉', '泥', '卷', '露', '咪', '花', '瓜', '苏', '苔', '豆',
] as const

export const DOG_PREFIX = [
  '闪', '憨', '煤', '大', '旺', '来', '皮', '铁', '豆', '胖',
  '奔', '灰', '蹦', '雷', '风', '黑', '黄', '奥', '麒', '哮',
] as const

export const DOG_SUFFIX = [
  '电', '憨', '壮', '财', '福', '蛋', '虎', '跑', '哥', '崽',
  '神', '侠', '王', '拳', '铃', '追', '旋', '摸', '鱼', '尾',
] as const

/** 猫名全集（测试用）：前缀×后缀。
 * @autodoc:purpose 枚举全部可能猫名（测试用） */
export function allCatNames(): readonly string[] {
  return CAT_PREFIX.flatMap(p => CAT_SUFFIX.map(s => p + s))
}

/** 狗名全集（测试用）。
 * @autodoc:purpose 枚举全部可能狗名（测试用） */
export function allDogNames(): readonly string[] {
  return DOG_PREFIX.flatMap(p => DOG_SUFFIX.map(s => p + s))
}

/** 按物种用 rng 拼一个默认名字（猫狗各有风格池）。
 * @autodoc:purpose 用随机数按物种风格池拼接默认名字 */
export function makeDefaultName(rng: Rng, species: Species): string {
  return species === 'cat'
    ? rng.pick(CAT_PREFIX) + rng.pick(CAT_SUFFIX)
    : rng.pick(DOG_PREFIX) + rng.pick(DOG_SUFFIX)
}
