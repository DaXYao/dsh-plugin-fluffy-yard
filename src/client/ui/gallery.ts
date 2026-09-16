import type { ArtStyleId, Body, Ears, Eyes, Fur, Pattern, Species, Tail, Traits } from '../../core/types.ts'
import { styleOf } from '../render/styles.ts'

interface Cell { readonly label: string; readonly traits: Traits }

const BASE: Traits = {
  species: 'cat', body: 'round', ears: 'erect', fur: 'orange',
  pattern: 'solid', tail: 'fluffy', eyes: 'amber', accessory: 'none',
}

function cell(label: string, patch: Partial<Traits>): Cell {
  return { label, traits: { ...BASE, ...patch } }
}

function section(title: string, cells: readonly Cell[]): string {
  const items = cells.map((c, i) => galleryItem(c, i, title)).join('')
  return `<h3>${title}</h3><div class="py-gallery-grid">${items}</div>`
}

function galleryItem(c: Cell, index: number, salt: string): string {
  const style = styleOf(currentStyle)
  const box = style.portraitBox
  return `<figure class="py-gallery-cell">`
    + `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${style.render(c.traits, `ga-${salt}-${index}`)}</svg>`
    + `<figcaption>${c.label}</figcaption></figure>`
}

let currentStyle: ArtStyleId = 'geo'

/** 立绘画廊（A11）：全维度矩阵 + 双风格对照。 */
export function openGallery(stage: HTMLElement): void {
  closeGallery(stage)
  const overlay = document.createElement('div')
  overlay.className = 'py-gallery'
  overlay.innerHTML = '<div class="py-gallery-bar">'
    + '<strong>立绘画廊</strong> '
    + '<label><input type="radio" name="py-gstyle" value="geo" checked/> 几何简笔</label> '
    + '<label><input type="radio" name="py-gstyle" value="real"/> 软萌手绘</label> '
    + '<button type="button" class="py-gallery-close">关闭</button></div>'
    + '<div class="py-gallery-body"></div>'
  stage.appendChild(overlay)

  const body = overlay.querySelector<HTMLElement>('.py-gallery-body')!
  const render = (): void => {
    const bodies: readonly Body[] = ['small', 'round', 'large']
    const ears: readonly Ears[] = ['erect', 'fold', 'droop', 'elf']
    const tails: readonly Tail[] = ['short', 'long', 'fluffy', 'curl']
    const furs: readonly Fur[] = ['white', 'black', 'orange', 'gray', 'latte', 'cow', 'calico', 'bluegray', 'cream', 'smokybrown']
    const patterns: readonly Pattern[] = ['solid', 'spots', 'tabby', 'gradient', 'mittens']
    const eyesList: readonly Eyes[] = ['amber', 'lakeblue', 'emerald', 'odd']
    const species: readonly Species[] = ['cat', 'dog']
    body.innerHTML =
      section('物种 × 体型', species.flatMap(s => bodies.map(b => cell(`${s === 'cat' ? '猫' : '狗'}·${b}`, { species: s, body: b }))))
      + section('耳型', ears.flatMap(e => species.map(s => cell(`${e}·${s}`, { ears: e, species: s }))))
      + section('尾巴', tails.flatMap(t => species.map(s => cell(`${t}·${s}`, { tail: t, species: s }))))
      + section('毛色', furs.map(f => cell(f, { fur: f })))
      + section('花纹', patterns.map(p => cell(p, { pattern: p, fur: 'gray' })))
      + section('眼色', eyesList.map(e => cell(e, { eyes: e })))
      + section('配饰', ['none', 'scarf', 'bell', 'bowtie'].map(a => cell(a, { accessory: a as Traits['accessory'] })))
  }
  render()

  overlay.addEventListener('change', event => {
    const input = event.target as HTMLInputElement
    if (input.name === 'py-gstyle' && input.checked) {
      currentStyle = input.value as ArtStyleId
      render()
    }
  })
  overlay.addEventListener('click', event => {
    if (event.target === overlay || (event.target as HTMLElement).closest('.py-gallery-close') !== null) {
      closeGallery(stage)
    }
  })
}

export function closeGallery(stage: HTMLElement): void {
  stage.querySelector('.py-gallery')?.remove()
}
