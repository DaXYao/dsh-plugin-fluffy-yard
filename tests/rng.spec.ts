import { describe, expect, it } from 'vitest'
import { createRng, hashSeed, mulberry32, rngFrom } from '../src/core/rng.ts'

describe('mulberry32 可复现性', () => {
  it('同种子两次调用的前 100 项序列逐项相等', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 100 }, () => a())
    const seqB = Array.from({ length: 100 }, () => b())
    expect(seqB).toEqual(seqA)
  })

  it('不同种子（0–9）首值至少 9 个互不相同（散列质量）', () => {
    const firsts = Array.from({ length: 10 }, (_, seed) => mulberry32(seed)())
    expect(new Set(firsts).size).toBeGreaterThanOrEqual(9)
  })
})

describe('hashSeed', () => {
  it('同一输入两次结果相等，且落在 [0, 2^32)', () => {
    const a = hashSeed('p_000001')
    const b = hashSeed('p_000001')
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(2 ** 32)
  })
})

describe('createRng 派生操作', () => {
  it('int(5) 连续 1000 次全部 ∈ [0, 5)', () => {
    const rng = createRng(mulberry32(7))
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(5)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(5)
    }
  })

  it('pick 5 元素池 1000 次每个元素至少出现一次', () => {
    const rng = createRng(mulberry32(8))
    const pool = ['a', 'b', 'c', 'd', 'e'] as const
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(rng.pick(pool))
    for (const item of pool) expect(seen.has(item)).toBe(true)
  })

  it('chance(0) 恒 false；chance(1) 恒 true', () => {
    const rng = createRng(mulberry32(9))
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false)
      expect(rng.chance(1)).toBe(true)
    }
  })
})

describe('rngFrom 字符串种子', () => {
  it("rngFrom('p_000042') 两次创建的流前 10 项逐项相等", () => {
    const a = rngFrom('p_000042')
    const b = rngFrom('p_000042')
    expect(Array.from({ length: 10 }, () => b.next())).toEqual(Array.from({ length: 10 }, () => a.next()))
  })
})
