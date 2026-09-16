import { describe, expect, it } from 'vitest'
import { PARTICLE_MARKUP } from '../src/client/stage/particles.ts'
import { ACTION_DURATION } from '../src/client/stage/actions.ts'

describe('粒子与吃喝动作（F9/F12）', () => {
  it('四式粒子 markup 非空且带填充色', () => {
    for (const [kind, markup] of Object.entries(PARTICLE_MARKUP)) {
      expect(markup.length, kind).toBeGreaterThan(20)
      expect(markup).toContain('fill=')
    }
    expect(PARTICLE_MARKUP.heart).toContain('#ef7d9d')
    expect(PARTICLE_MARKUP.crumb).toContain('#b07a3f')
    expect(PARTICLE_MARKUP.drop).toContain('#7fb7e0')
    expect(PARTICLE_MARKUP.sparkle).toContain('#f5d76e')
  })
  it('eat/drink 已注册时长（引擎指令动作）', () => {
    expect(ACTION_DURATION.eat).toEqual([1600, 1600])
    expect(ACTION_DURATION.drink).toEqual([700, 700])
  })
})
