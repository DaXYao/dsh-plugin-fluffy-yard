/**
 * 带种子的随机数（implementation-plan §3.3）。
 * id → xfnv1a 哈希 → mulberry32 流；同 id 必产生同一流（§L3 可复现性的基座）。
 */

/** xfnv1a 变体：字符串 → 32 位无符号种子。
 * @autodoc:purpose 字符串（宠物 id）散列为 32 位无符号随机种子 */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  // 末尾雪花化一拍，让短串也散开
  h = (h + (h << 15)) >>> 0
  h ^= h >>> 13
  h = (h + (h << 2)) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

/** mulberry32：种子 → [0, 1) 均匀随机流。
 * @autodoc:purpose 由种子创建 mulberry32 均匀随机数生成器 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  /** [0, 1)。 */
  next(): number
  /** [0, maxExclusive) 均匀整数。 */
  int(maxExclusive: number): number
  /** 非空数组均匀选取。 */
  pick<T>(items: readonly T[]): T
  /** 以概率 p 命中。 */
  chance(p: number): boolean
}

/** 由底层随机函数组装 Rng 接口。
 * @autodoc:purpose 把底层 [0,1) 随机函数包装为 int/pick/chance 便捷接口 */
export function createRng(rand: () => number): Rng {
  return {
    next: rand,
    int: maxExclusive => Math.floor(rand() * maxExclusive),
    pick: items => items[Math.floor(rand() * items.length)],
    chance: p => rand() < p,
  }
}

/** 由任意字符串种子创建随机流（宠物 id 即种子）。
 * @autodoc:purpose 由字符串种子创建可复现的随机流（宠物 id 即种子） */
export function rngFrom(seedStr: string): Rng {
  return createRng(mulberry32(hashSeed(seedStr)))
}
