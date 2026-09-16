import { describe, expect, it } from 'vitest'
import { FUR_POOL } from '../src/core/traits.ts'
import { REAL_EYE, REAL_ODD, REAL_PALETTE } from '../src/client/render/real/palette.ts'

const HEX = /^#[0-9a-f]{6}$/

describe('real 调色板（A3/A7）', () => {
  it('10 毛色 × 5 色全为合法 hex', () => {
    for (const fur of FUR_POOL) {
      const p = REAL_PALETTE[fur]
      for (const color of [p.base, p.deep, p.light, p.white, p.line]) {
        expect(color, `${fur}.${color}`).toMatch(HEX)
      }
    }
  })
  it('眼色与异瞳', () => {
    expect(REAL_EYE.amber).toMatch(HEX)
    expect(REAL_ODD.left).not.toBe(REAL_ODD.right)
  })
  it('固有色斑标记', () => {
    expect(REAL_PALETTE.cow.deep).not.toBe(REAL_PALETTE.cow.base)
    expect(REAL_PALETTE.calico.deep).not.toBe(REAL_PALETTE.calico.base)
  })
})
