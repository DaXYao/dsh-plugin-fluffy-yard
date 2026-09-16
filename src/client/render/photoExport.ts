/** 快照内嵌 CSS：独立 SVG 失去页面样式，必需类内嵌（G11）。 */
const PHOTO_CSS = `
.py-sky { fill: #dcecf5; } .py-grass { fill: #c4e0b8; }
.py-name { font-size: 11px; fill: #5a4f44; text-anchor: middle; paint-order: stroke; stroke: rgba(255,255,255,0.8); stroke-width: 3px; }
.py-badge { font-size: 13px; text-anchor: middle; }
`

export interface PhotoWatermark {
  readonly dateText: string
  readonly visitText: string
}

/** 序列化舞台 SVG（裸快照，无任何装饰；装饰由 controller 一次性完成，G11）。 */
export function serializeStageSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  return new XMLSerializer().serializeToString(clone)
}

/**
 * 装饰合影快照（纯字符串操作，可单测）：去除气泡/ZZZ、注入必需 CSS、
 * 设定画布尺寸、追加右下角水印（G11/G14）。
 */
export function decoratePhotoSvg(
  svgText: string,
  w: number,
  h: number,
  mark: PhotoWatermark,
): string {
  let text = svgText
  text = text.replace(/<g class="py-bubble-anchor"[\s\S]*?<\/g><\/g>/g, '')
  text = text.replace(/<text class="py-zzz"[\s\S]*?<\/text>/g, '')
  const style = `<style>${PHOTO_CSS}</style>`
  const mw = 26 + Math.max(mark.dateText.length, mark.visitText.length) * 8.5
  const watermark = `<g>`
    + `<rect x="${Math.round(w - mw - 14)}" y="${h - 52}" width="${Math.round(mw)}" height="40" rx="10" fill="rgba(74,63,53,0.82)"/>`
    + `<text x="${Math.round(w - mw / 2 - 14)}" y="${h - 34}" font-family="sans-serif" font-size="13" fill="#fff" text-anchor="middle">${mark.visitText}</text>`
    + `<text x="${Math.round(w - mw / 2 - 14)}" y="${h - 19}" font-family="sans-serif" font-size="11" fill="rgba(255,255,255,0.85)" text-anchor="middle">${mark.dateText}</text>`
    + `</g>`
  return text
    .replace(/<svg([^>]*?)>/, (_m, attrs: string) =>
      `<svg${attrs} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${style}`)
    .replace(/<\/svg>\s*$/, `${watermark}</svg>`)
}
