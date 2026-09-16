import type { Accessory, Body, Ears, Eyes, Pattern, Species, Tail } from '../../core/types.ts'
import { EYE_PALETTE, ODD_EYES } from './palette.ts'

/**
 * 占位素材：几何图形部件（implementation-plan §3.4 的“形状与颜色分离”）。
 * 局部坐标系：脚底中心为原点，身体占 x∈[-45,45]、y∈[-95,0]（V1）。
 * fill 一律用 CSS 变量，由 petSprite 注入（V5）。
 */

/** 体型几何：身体椭圆的 rx/ry。 */
export interface BodyGeom {
  readonly rx: number
  readonly ry: number
}

export function bodyGeom(body: Body): BodyGeom {
  switch (body) {
    case 'small': return { rx: 22, ry: 24 }
    case 'round': return { rx: 28, ry: 25 }
    case 'large': return { rx: 31, ry: 30 }
  }
}

const r = (n: number): number => Math.round(n * 10) / 10

export function bodyPart(geom: BodyGeom): string {
  const { rx, ry } = geom
  return `<ellipse cx="0" cy="${-ry}" rx="${rx}" ry="${ry}" fill="var(--fur-base)"/>`
    + `<ellipse cx="0" cy="${r(-ry * 0.45)}" rx="${r(rx * 0.7)}" ry="${r(ry * 0.45)}" fill="var(--fur-light)" opacity="0.45"/>`
}

export function tailPart(geom: BodyGeom, tail: Tail): string {
  const { rx, ry } = geom
  const ax = r(rx * 0.85)
  const ay = r(-ry * 0.55)
  switch (tail) {
    case 'short':
      return `<path d="M ${ax},${ay} q 11 -5 13 -15" stroke="var(--fur-base)" stroke-width="7" fill="none" stroke-linecap="round"/>`
    case 'long':
      return `<path d="M ${ax},${ay} q 20 -3 25 -28" stroke="var(--fur-base)" stroke-width="8" fill="none" stroke-linecap="round"/>`
    case 'fluffy':
      return `<ellipse cx="${r(ax + 9)}" cy="${r(ay - 10)}" rx="11" ry="16" fill="var(--fur-base)"/>`
        + `<ellipse cx="${r(ax + 4)}" cy="${r(ay - 2)}" rx="7" ry="10" fill="var(--fur-base)"/>`
    case 'curl':
      return `<path d="M ${ax},${ay} q 15 -1 17 -14 q 1 -11 -9 -10" stroke="var(--fur-base)" stroke-width="7" fill="none" stroke-linecap="round"/>`
  }
}

export function earsPart(geom: BodyGeom, ears: Ears): string {
  const { rx, ry } = geom
  const ey = r(-(2 * ry - 3))
  const lx = r(-rx * 0.55)
  const rxx = r(rx * 0.55)
  switch (ears) {
    case 'erect':
      return `<polygon points="${r(lx - 7)},${r(ey + 3)} ${r(lx + 7)},${r(ey + 3)} ${lx},${r(ey - 14)}" fill="var(--fur-base)"/>`
        + `<polygon points="${r(rxx - 7)},${r(ey + 3)} ${r(rxx + 7)},${r(ey + 3)} ${rxx},${r(ey - 14)}" fill="var(--fur-base)"/>`
    case 'fold':
      return `<polygon points="${r(lx - 6)},${r(ey - 1)} ${r(lx + 6)},${r(ey - 1)} ${lx},${r(ey + 10)}" fill="var(--fur-base)"/>`
        + `<polygon points="${r(rxx - 6)},${r(ey - 1)} ${r(rxx + 6)},${r(ey - 1)} ${rxx},${r(ey + 10)}" fill="var(--fur-base)"/>`
    case 'droop':
      return `<ellipse cx="${lx}" cy="${r(ey + 9)}" rx="5.5" ry="11" fill="var(--fur-base)"/>`
        + `<ellipse cx="${rxx}" cy="${r(ey + 9)}" rx="5.5" ry="11" fill="var(--fur-base)"/>`
    case 'elf':
      return `<polygon points="${r(lx - 5)},${r(ey + 3)} ${r(lx + 5)},${r(ey + 3)} ${r(lx - 9)},${r(ey - 15)}" fill="var(--fur-base)"/>`
        + `<polygon points="${r(rxx - 5)},${r(ey + 3)} ${r(rxx + 5)},${r(ey + 3)} ${r(rxx + 9)},${r(ey - 15)}" fill="var(--fur-base)"/>`
  }
}

export function eyesPart(geom: BodyGeom, eyes: Eyes): string {
  const { rx, ry } = geom
  const ex = r(rx * 0.38)
  const ey = r(-ry * 1.45)
  const left = eyes === 'odd' ? ODD_EYES.left : EYE_PALETTE[eyes]
  const right = eyes === 'odd' ? ODD_EYES.right : EYE_PALETTE[eyes]
  return `<circle cx="${r(-ex)}" cy="${ey}" r="4.5" fill="${left}"/>`
    + `<circle cx="${ex}" cy="${ey}" r="4.5" fill="${right}"/>`
}

/** 物种差异：狗有口鼻部（占位级）。 */
export function speciesPart(geom: BodyGeom, species: Species): string {
  if (species !== 'dog') return ''
  const { rx, ry } = geom
  const cy = r(-ry * 0.72)
  return `<ellipse cx="0" cy="${cy}" rx="${r(rx * 0.42)}" ry="${r(ry * 0.22)}" fill="var(--fur-light)"/>`
    + `<circle cx="0" cy="${r(cy - ry * 0.1)}" r="2.5" fill="#3a332e"/>`
}

export function patternPart(geom: BodyGeom, pattern: Pattern, uid: string): string {
  const { rx, ry } = geom
  const clip = `clip-path="url(#${uid}-body)"`
  switch (pattern) {
    case 'solid':
      return ''
    case 'spots':
      return `<g ${clip}>`
        + `<circle cx="${r(-rx * 0.4)}" cy="${r(-ry * 1.3)}" r="6" fill="var(--fur-dark)"/>`
        + `<circle cx="${r(rx * 0.35)}" cy="${r(-ry * 0.9)}" r="5" fill="var(--fur-dark)"/>`
        + `<circle cx="0" cy="${r(-ry * 0.42)}" r="7" fill="var(--fur-dark)"/></g>`
    case 'tabby':
      return `<g ${clip}><path d="M ${-11},${r(-2 * ry + 5)} v 13 M 0,${r(-2 * ry + 2)} v 15 M 11,${r(-2 * ry + 5)} v 13" stroke="var(--fur-dark)" stroke-width="5" stroke-linecap="round" fill="none"/></g>`
    case 'gradient':
      return `<g ${clip}><rect x="${r(-rx)}" y="${r(-2 * ry)}" width="${r(rx * 2)}" height="${r(ry)}" fill="var(--fur-light)" opacity="0.5"/></g>`
    case 'mittens':
      return `<g ${clip}>`
        + `<ellipse cx="${r(-rx * 0.45)}" cy="-5" rx="6.5" ry="5" fill="var(--fur-light)"/>`
        + `<ellipse cx="${r(rx * 0.45)}" cy="-5" rx="6.5" ry="5" fill="var(--fur-light)"/>`
        + `<ellipse cx="0" cy="${r(-ry * 0.95)}" rx="${r(rx * 0.5)}" ry="${r(ry * 0.32)}" fill="var(--fur-light)" opacity="0.85"/></g>`
  }
}

export function accessoryPart(geom: BodyGeom, accessory: Accessory): string {
  const { rx, ry } = geom
  switch (accessory) {
    case 'none':
      return ''
    case 'scarf':
      return `<rect x="${r(-rx * 0.92)}" y="${r(-ry * 1.18)}" width="${r(rx * 1.84)}" height="9" rx="4.5" fill="#d96a5a" transform="rotate(-3)"/>`
    case 'bell':
      return `<circle cx="0" cy="${r(-ry * 0.98)}" r="5" fill="#e8b93c" stroke="#b98f2a" stroke-width="1"/>`
        + `<circle cx="0" cy="${r(-ry * 0.98)}" r="1.6" fill="#7a5f1d"/>`
    case 'bowtie':
      return `<polygon points="-4,${r(-ry * 1.02)} -15,${r(-ry * 1.02 - 6)} -15,${r(-ry * 1.02 + 6)}" fill="#d96a5a"/>`
        + `<polygon points="4,${r(-ry * 1.02)} 15,${r(-ry * 1.02 - 6)} 15,${r(-ry * 1.02 + 6)}" fill="#d96a5a"/>`
        + `<circle cx="0" cy="${r(-ry * 1.02)}" r="2.6" fill="#b5544a"/>`
  }
}
