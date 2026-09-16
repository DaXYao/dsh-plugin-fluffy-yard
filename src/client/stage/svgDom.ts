const SVG_NS = 'http://www.w3.org/2000/svg'

/** 创建 SVG 元素并设置属性（attrs 值会被 String() 化）。 */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value))
  return el
}
