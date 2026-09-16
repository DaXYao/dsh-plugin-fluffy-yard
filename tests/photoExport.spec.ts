import { describe, expect, it } from 'vitest'
import { decoratePhotoSvg } from '../src/client/render/photoExport.ts'

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg"><rect class="py-sky"/><g class="py-pet"><g class="py-facing"><g class="py-action py-idle"><g class="py-sprite"></g></g></g><text class="py-name">汤圆</text><g class="py-bubble-anchor"><g class="py-bubble"><rect class="py-bubble-bg"/><text class="py-bubble-text">喵</text></g></g><text class="py-zzz">Z z z</text></g></svg>`

describe('合影快照装饰（G11）', () => {
  it('去除气泡与 ZZZ、注入样式与尺寸', () => {
    const out = decoratePhotoSvg(SAMPLE, 800, 400, { dateText: '2026-8-30', visitText: '第 37 次探望' })
    expect(out).not.toContain('py-bubble')
    expect(out).not.toContain('py-zzz')
    expect(out).toContain('<style>')
    expect(out).toContain('width="800"')
    expect(out).toContain('viewBox="0 0 800 400"')
    expect(out).toContain('py-sprite')
    expect(out).toContain('汤圆')
  })
  it('水印含日期与第 N 次探望', () => {
    const out = decoratePhotoSvg(SAMPLE, 800, 400, { dateText: '2026-8-30', visitText: '第 37 次探望' })
    expect(out).toContain('第 37 次探望')
    expect(out).toContain('2026-8-30')
  })
})
