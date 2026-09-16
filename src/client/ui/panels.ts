import type { ArtStyleId, Yard } from '../../core/types.ts'
import { SPAWN_INTERVAL_MAX_MIN, SPAWN_INTERVAL_MIN_MIN } from '../../config.ts'
import { ACHIEVEMENTS } from '../../core/achievements.ts'
import { postcardEligible } from '../../core/postcard.ts'
import { availableStyles, type ArtStyle } from '../render/styles.ts'

export interface PanelsOptions {
  readonly getYard: () => Yard | null
  readonly onIntervalChange: (min: number) => void
  readonly onStyleChange: (id: ArtStyleId) => void
  readonly onPhoto: () => void
  readonly getStyle: () => ArtStyle
  /** 图鉴条目回看档案卡。 */
  readonly onArchiveCard: (petId: string) => void
  /** 查看明信片（📮）。 */
  readonly onPostcard: (petId: string) => void
  /** 昼夜切换按钮（F10）。 */
  readonly onPhaseCycle: () => void
  /** 天气切换按钮（P6+ UX-4）。 */
  readonly onRainToggle: () => void
  /** 在场上限（P6+ UX-3）。 */
  readonly onMaxPetsChange: (n: number) => void
  /** 浮层面板展开时通知（与调参台互斥，UX-2）。 */
  readonly onPanelOpen?: () => void
}

export interface PanelsHandle {
  readonly openStats: () => void
  readonly openSettings: () => void
  readonly refresh: () => void
  readonly setPhaseLabel: (label: string, title: string) => void
  readonly setRainLabel: (on: boolean) => void
  /** 关闭当前浮层面板（面板互斥，UX-2）。 */
  readonly closeAll: () => void
  readonly dispose: () => void
}

/** 右上工具条（📊 📖 📷 ⚙️）+ 统计/图鉴/设置浮层。 */
export function mountPanels(stage: HTMLElement, opts: PanelsOptions): PanelsHandle {
  const toolbar = document.createElement('div')
  toolbar.className = 'py-toolbar'
  toolbar.innerHTML = '<button type="button" data-panel="stats" title="探望统计">📊</button>'
    + '<button type="button" data-panel="archive" title="图鉴">📖</button>'
    + '<button type="button" data-act="photo" title="合影">📷</button>'
    + '<button type="button" data-panel="achv" title="成就">🏆</button>'
    + '<button type="button" data-act="phase" title="昼夜：自动">🌓</button>'
    + '<button type="button" data-act="rain" title="天气：晴（点击下雨）">🌤️</button>'
    + '<button type="button" data-panel="settings" title="设置">⚙️</button>'
  stage.appendChild(toolbar)

  const panel = document.createElement('div')
  panel.className = 'py-panel'
  panel.style.display = 'none'
  stage.appendChild(panel)

  let opened: 'stats' | 'settings' | 'archive' | 'achv' | null = null
  const close = (): void => {
    opened = null
    panel.style.display = 'none'
  }
  const row = (label: string, value: string | number): string =>
    `<div class="row"><span>${label}</span><span>${value}</span></div>`

  const renderStats = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const log = yard.stats.visitLog.slice(-10).reverse()
      .map(ts => `<div class="log">${new Date(ts).toLocaleString()}</div>`).join('')
    panel.innerHTML = '<h3>探望记录</h3>'
      + '<button type="button" class="py-close" data-close>×</button>'
      + row('总探望次数', yard.stats.visitCount)
      + row('连续探望天数', yard.stats.streak)
      + row('历史最长纪录', yard.stats.longestStreak)
      + row('累计打开次数', yard.stats.openCount)
      + row('相遇总数', yard.stats.metTotal)
      + row('合影次数', yard.stats.photosTaken)
      + `<h3>最近探望</h3>${log === '' ? '<div class="log">还没有记录</div>' : log}`
  }

  const renderArchive = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const style = opts.getStyle()
    const box = style.portraitBox
    const now = Date.now()
    const rows = yard.archive.slice().reverse().map(e => {
      const met = new Date(e.arrivedAt).toLocaleDateString('zh-CN')
      const left = new Date(e.leftAt).toLocaleDateString('zh-CN')
      const cycle = e.cycle >= 2 ? ' ⭐' : ''
      const pc = postcardEligible(e.leftAt, now)
      return `<button type="button" class="row arch-row" data-arch="${e.id}" data-pc="${pc ? '1' : '0'}" style="width:100%;text-align:left">`
        + `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="30" height="32">${style.render(e.traits, `ar-${e.id}`)}</svg>`
        + `<span>${e.name}${cycle}</span><span class="log">№${e.id.slice(2)} · ${met} → ${left}</span>${pc ? '<span title="有明信片">📮</span>' : ''}</button>`
    }).join('')
    panel.innerHTML = '<h3>图鉴</h3>'
      + '<button type="button" class="py-close" data-close>×</button>'
      + (rows === '' ? '<div class="log">还没有告别的宝贝</div>' : rows)
  }

  const renderAchv = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const unlocked = new Set(yard.stats.achievements ?? [])
    const rows = ACHIEVEMENTS.map(def => unlocked.has(def.id)
      ? `<div class="achv-row py-achv-done"><span>🏆 ${def.titleZh}</span><span class="log">${def.descZh}</span></div>`
      : `<div class="achv-row py-achv-todo"><span>◻ ${def.titleZh}</span><span class="log">${def.descZh}</span></div>`).join('')
    panel.innerHTML = '<h3>成就</h3>'
      + '<button type="button" class="py-close" data-close>×</button>'
      + rows
  }

  const renderSettings = (): void => {
    const yard = opts.getYard()
    if (yard === null) return
    const radios = availableStyles().map(s =>
      `<label class="row"><input type="radio" name="py-style" value="${s.id}"`
      +`${s.id === yard.settings.artStyle ? ' checked' : ''}/> ${s.labelZh}</label>`).join('')
    const intervalSec = Math.round(yard.settings.spawnIntervalMin * 60)
    panel.innerHTML = '<h3>设置</h3>'
      + '<button type="button" class="py-close" data-close>×</button>'
      + `<div class="row"><span>到访间隔（秒）</span>`
      + `<input type="number" min="${SPAWN_INTERVAL_MIN_MIN * 60}" max="${SPAWN_INTERVAL_MAX_MIN * 60}" step="30"`
      + ` value="${intervalSec}" data-interval/></div>`
      + `<div class="row"><span>在场上限（只）</span>`
      + `<input type="number" min="1" max="10" step="1" value="${yard.settings.maxPets ?? 5}" data-maxpets/></div>`
      + '<div class="row"><button type="button" data-apply-interval>应用间隔</button>'
      + '<button type="button" data-apply-maxpets>应用上限</button></div>'
      + `<h3>美术风格</h3>${radios}<div class="log">新风格随版本加入</div>`
  }

  toolbar.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    if (button.dataset.act === 'photo') {
      opts.onPhoto()
      return
    }
    if (button.dataset.act === 'phase') {
      opts.onPhaseCycle()
      return
    }
    if (button.dataset.act === 'rain') {
      opts.onRainToggle()
      return
    }
    const which = button.dataset.panel as 'stats' | 'settings' | 'archive' | 'achv'
    if (opened === which) {
      close()
      return
    }
    opened = which
    opts.onPanelOpen?.()
    if (which === 'stats') renderStats()
    else if (which === 'archive') renderArchive()
    else if (which === 'achv') renderAchv()
    else renderSettings()
    panel.style.display = ''
  })

  panel.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    if (button.hasAttribute('data-close')) {
      close()
      return
    }
    if (button.hasAttribute('data-apply-interval')) {
      const input = panel.querySelector<HTMLInputElement>('[data-interval]')
      if (input === null) return
      const raw = Number(input.value)
      if (!Number.isFinite(raw)) return
      const clampedSec = Math.min(SPAWN_INTERVAL_MAX_MIN * 60, Math.max(SPAWN_INTERVAL_MIN_MIN * 60, Math.round(raw)))
      opts.onIntervalChange(clampedSec / 60)
      renderSettings()
      return
    }
    if (button.hasAttribute('data-apply-maxpets')) {
      const input = panel.querySelector<HTMLInputElement>('[data-maxpets]')
      if (input === null) return
      const raw = Number(input.value)
      if (!Number.isFinite(raw)) return
      opts.onMaxPetsChange(Math.min(10, Math.max(1, Math.round(raw))))
      return
    }
    const arch = button.dataset.arch
    if (arch !== undefined) {
      if (button.dataset.pc === '1') opts.onPostcard(arch)
      else opts.onArchiveCard(arch)
    }
  })

  panel.addEventListener('change', event => {
    const input = event.target as HTMLInputElement
    if (input.type === 'radio' && input.name === 'py-style' && input.checked) {
      opts.onStyleChange(input.value as ArtStyleId)
    }
  })

  return {
    openStats: () => {
      opened = 'stats'
      renderStats()
      panel.style.display = ''
    },
    openSettings: () => {
      opened = 'settings'
      renderSettings()
      panel.style.display = ''
    },
    refresh: () => {
      if (opened === 'stats') renderStats()
      else if (opened === 'settings') renderSettings()
      else if (opened === 'archive') renderArchive()
      else if (opened === 'achv') renderAchv()
    },
    setPhaseLabel: (label: string, title: string) => {
      const btn = toolbar.querySelector<HTMLButtonElement>('[data-act="phase"]')
      if (btn !== null) {
        btn.textContent = label
        btn.title = title
      }
    },
    setRainLabel: (on: boolean) => {
      const btn = toolbar.querySelector<HTMLButtonElement>('[data-act="rain"]')
      if (btn !== null) {
        btn.textContent = on ? '🌧️' : '🌤️'
        btn.title = on ? '天气：雨天（点击转晴）' : '天气：晴（点击下雨）'
      }
    },
    closeAll: () => {
      opened = null
      panel.style.display = 'none'
    },
    dispose: () => {
      toolbar.remove()
      panel.remove()
    },
  }
}

export function openCardModal(stage: HTMLElement, svg: string, onExport: () => void): void {
  closeCardModal(stage)
  const modal = document.createElement('div')
  modal.className = 'py-card-modal'
  modal.innerHTML = `<div class="inner">${svg}`
    + '<div class="acts"><button type="button" data-act="export">导出 PNG</button>'
    + '<button type="button" data-act="close">关闭</button></div></div>'
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeCardModal(stage)
      return
    }
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    if (button.dataset.act === 'export') onExport()
    else closeCardModal(stage)
  })
  stage.appendChild(modal)
}

export function closeCardModal(stage: HTMLElement): void {
  stage.querySelector('.py-card-modal')?.remove()
}

/** 明信片弹窗（H7）。 */
export function openPostcardModal(
  stage: HTMLElement,
  svg: string,
  text: string,
): void {
  stage.querySelector('.py-postcard')?.remove()
  const modal = document.createElement('div')
  modal.className = 'py-postcard'
  modal.innerHTML = `<div class="inner">${svg}<div class="text">${text}</div>`
    + '<button type="button">收下了</button></div>'
  modal.addEventListener('click', event => {
    if (event.target === modal || (event.target as HTMLElement).closest('button') !== null) {
      modal.remove()
    }
  })
  stage.appendChild(modal)
}
