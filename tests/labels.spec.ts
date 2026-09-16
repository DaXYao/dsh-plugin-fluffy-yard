import { describe, expect, it } from 'vitest'
import {
  ACCESSORY_POOL, BODY_POOL, EARS_POOL, EYES_POOL, FUR_POOL,
  PATTERN_POOL, SPECIES_POOL, TAIL_POOL,
} from '../src/core/traits.ts'
import {
  ACCESSORY_ZH, BODY_ZH, EARS_ZH, EYES_ZH, FUR_ZH, PATTERN_ZH, SPECIES_ZH, TAIL_ZH, traitTags,
} from '../src/client/render/labels.ts'
import type { Traits } from '../src/core/types.ts'

describe('特征中文标签全量覆盖（M7）', () => {
  it('每个维度取值都有非空标签（accessory 无需为 none 提供标签）', () => {
    for (const v of SPECIES_POOL) expect(SPECIES_ZH[v].length, `species ${v}`).toBeGreaterThan(0)
    for (const v of BODY_POOL) expect(BODY_ZH[v].length, `body ${v}`).toBeGreaterThan(0)
    for (const v of EARS_POOL) expect(EARS_ZH[v].length, `ears ${v}`).toBeGreaterThan(0)
    for (const v of FUR_POOL) expect(FUR_ZH[v].length, `fur ${v}`).toBeGreaterThan(0)
    for (const v of PATTERN_POOL) expect(PATTERN_ZH[v].length, `pattern ${v}`).toBeGreaterThan(0)
    for (const v of TAIL_POOL) expect(TAIL_ZH[v].length, `tail ${v}`).toBeGreaterThan(0)
    for (const v of EYES_POOL) expect(EYES_ZH[v].length, `eyes ${v}`).toBeGreaterThan(0)
    for (const v of ACCESSORY_POOL) expect(ACCESSORY_ZH[v].length, `accessory ${v}`).toBeGreaterThan(0)
  })

  it('traitTags = 耳·色·尾，配饰非 none 时追加', () => {
    const base: Traits = {
      species: 'cat', body: 'small', ears: 'fold', fur: 'cow',
      pattern: 'solid', tail: 'fluffy', eyes: 'amber', accessory: 'none',
    }
    expect(traitTags(base)).toEqual(['折耳', '奶牛', '蓬松大尾'])
    expect(traitTags({ ...base, accessory: 'bell' })).toEqual(['折耳', '奶牛', '蓬松大尾', '铃铛'])
  })
})
