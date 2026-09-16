import { BOWLS_MIN_W, FURNITURE_MIN_W } from '../../config.ts'

/** 场景家具（F1–F3）：布局为纯函数（可测），markup 用阶段 CSS 变量（不依赖具体配色）。 */

export interface PropLayout {
  readonly showFurniture: boolean
  readonly showBowls: boolean
  readonly windowX: number
  readonly sofaX: number
  readonly tableX: number
  readonly foodX: number
  readonly waterX: number
}

/** 比例布局 + 窄舞台降级（F2，阈值在 config.ts）。 */
export function propLayout(width: number): PropLayout {
  return {
    showFurniture: width >= FURNITURE_MIN_W,
    showBowls: width >= BOWLS_MIN_W,
    windowX: Math.round(width * 0.3),
    sofaX: Math.round(width * 0.16),
    tableX: Math.round(width * 0.84),
    foodX: Math.round(width * 0.6),
    waterX: Math.round(width * 0.68),
  }
}

const L = 'var(--py-propline)'
const P = 'var(--py-prop)'
const P2 = 'var(--py-prop2)'

/** 后墙 + 窗户（全宽，底部对齐草地顶）。 */
export function wallMarkup(width: number, groundY: number, windowX: number): string {
  const top = groundY - 86
  return `<g class="py-prop">`
    + `<rect x="0" y="${top}" width="${width}" height="86" fill="var(--py-wall)"/>`
    + `<rect x="0" y="${top}" width="${width}" height="6" fill="var(--py-wall2)"/>`
    + `<g transform="translate(${windowX - 32}, ${top + 10})">`
    + `<rect x="0" y="0" width="64" height="50" rx="6" fill="${P}" stroke="${L}" stroke-width="2"/>`
    + `<rect x="6" y="6" width="52" height="38" rx="3" fill="var(--py-glass)"/>`
    + `<path d="M32,6 v38 M6,25 h52" stroke="${L}" stroke-width="2"/>`
    + `<rect x="-5" y="50" width="74" height="5" rx="2.5" fill="${P2}" stroke="${L}" stroke-width="1.4"/>`
    + `<circle cx="16" cy="-3" r="4" fill="#8fae7a"/><circle cx="22" cy="-5" r="3" fill="#a3c08c"/>`
    + `</g></g>`
}

/** 沙发（宠物 spot = sofaX）。 */
export function sofaMarkup(x: number, groundY: number): string {
  return `<g class="py-prop" transform="translate(${x}, ${groundY})">`
    + `<rect x="-55" y="-30" width="110" height="30" rx="9" fill="${P}" stroke="${L}" stroke-width="2.4"/>`
    + `<rect x="-55" y="-58" width="110" height="30" rx="11" fill="${P}" stroke="${L}" stroke-width="2.4"/>`
    + `<rect x="-58" y="-44" width="12" height="30" rx="6" fill="${P2}" stroke="${L}" stroke-width="2"/>`
    + `<rect x="46" y="-44" width="12" height="30" rx="6" fill="${P2}" stroke="${L}" stroke-width="2"/>`
    + `<path d="M-30,-30 v14 M0,-30 v14 M30,-30 v14" stroke="${P2}" stroke-width="3" stroke-linecap="round"/>`
    + `</g>`
}

/** 小圆桌（宠物 spot = tableX）。 */
export function tableMarkup(x: number, groundY: number): string {
  return `<g class="py-prop" transform="translate(${x}, ${groundY})">`
    + `<rect x="-3.5" y="-42" width="7" height="42" rx="3" fill="${P2}" stroke="${L}" stroke-width="1.8"/>`
    + `<ellipse cx="0" cy="-44" rx="34" ry="9" fill="${P}" stroke="${L}" stroke-width="2.4"/>`
    + `<ellipse cx="-12" cy="-49" rx="6" ry="3" fill="${P2}" stroke="${L}" stroke-width="1.4"/>`
    + `<path d="M-12,-52 q1,-6 5,-7" stroke="${L}" stroke-width="1.6" fill="none"/>`
    + `</g>`
}

/** 盆（food = 有食物才画食物点；water = 水面）。data-prop 供点击委托。 */
export function bowlMarkup(kind: 'food' | 'water', x: number, groundY: number, hasFood: boolean): string {
  const content = kind === 'water'
    ? `<ellipse cx="0" cy="-6" rx="10" ry="3.2" fill="#a8cfe8" opacity="0.92"/>`
    : hasFood
      ? `<circle cx="-4" cy="-6" r="2.4" fill="#b07a3f"/><circle cx="1" cy="-7" r="2.6" fill="#c98d4e"/><circle cx="5" cy="-5.5" r="2.2" fill="#a5713a"/>`
      : ''
  return `<g class="py-prop py-prop-bowl" data-prop="${kind}" transform="translate(${x}, ${groundY})">`
    + `<ellipse cx="0" cy="-4" rx="15" ry="6.5" fill="${P}" stroke="${L}" stroke-width="2.2"/>`
    + `<ellipse cx="0" cy="-6" rx="11.5" ry="4.2" fill="${P2}"/>`
    + content
    + `</g>`
}
