import type { StageEngine } from './stage/engine.ts'
import type { YardController } from './yardController.ts'

const DEBUG_KEY = 'dsh-plugin-fluffy-yard/debug'
const W_MIN = 80
const W_MAX = 1400
const H_MIN = 80
const H_MAX = 800

export interface DebugHandle {
  readonly dispose: () => void
  /** 显隐调参台（面板互斥，UX-2）。 */
  readonly setVisible: (visible: boolean) => void
}

export interface DebugHooks {
  /** 调参台展开时通知（关闭右上浮层面板）。 */
  readonly onOpen?: () => void
}

function sizeRow(k: 'w' | 'h', label: string, min: number, max: number): string {
  return `<label class="py-debug-row">${label} `
    + `<input data-k="${k}" data-t="range" type="range" min="${min}" max="${max}" step="10"/>`
    + `<input data-k="${k}" data-t="num" type="number" min="${min}" max="${max}" step="10" placeholder="自动" title="范围 ${min}–${max}"/></label>`
}

/**
 * debug 调参台（M3/V13/UX-1/UX-2）：小齿轮或 ?debug=1 唤出，可见性存 localStorage。
 * 面板与齿轮挂在容器层（不随舞台缩小被裁剪，任何尺寸都能恢复）；
 * 宽/高 = 滑条 + 数值输入双向同步 + 舞台右下角拖角手柄；数值回车/失焦应用并钳制。
 */
export function mountDebugPanel(
  container: HTMLElement,
  controller: YardController,
  engine: StageEngine,
  hooks: DebugHooks = {},
): DebugHandle {
  const stage = container.querySelector<HTMLElement>('.py-stage')
  if (stage === null) return { dispose: () => {}, setVisible: () => {} }

  const panel = document.createElement('div')
  panel.className = 'py-debug'
  panel.innerHTML = [
    '<div class="py-debug-title">小院调参台 <button class="py-debug-close" type="button">×</button></div>',
    '<div class="py-debug-row"><button data-act="spawn" type="button">立即到访</button><button data-act="travel" type="button">快进一个间隔</button></div>',
    '<div class="py-debug-row"><button data-act="demo" type="button">演示存档</button><button data-act="cold" type="button">冷场存档</button></div>',
    '<div class="py-debug-row"><button data-act="snapshot" type="button">状态快照</button><button data-act="reset" type="button">重置存档</button></div>',
    '<div class="py-debug-row"><button data-act="follow" type="button">恢复跟随面板</button><button data-act="gallery" type="button">立绘画廊</button></div>',
    '<div class="py-debug-row py-debug-hint">范围：宽 80–1400 · 高 80–800 · 拖舞台右下角可调</div>',
    sizeRow('w', '宽', W_MIN, W_MAX),
    sizeRow('h', '高', H_MIN, H_MAX),
  ].join('')

  const gear = document.createElement('button')
  gear.type = 'button'
  gear.className = 'py-debug-gear'
  gear.textContent = '🛠'

  // UX-1：拖角手柄（挂在舞台右下角，拖动实时改宽高并同步滑条/数值框）
  const handle = document.createElement('div')
  handle.className = 'py-stage-resize'
  handle.title = '拖动调整舞台大小（宽 80–1400 · 高 80–800）'
  handle.addEventListener('pointerdown', event => {
    event.preventDefault()
    try { handle.setPointerCapture(event.pointerId) } catch { /* 合成事件/指针未激活时可忽略 */ }
    const startW = engine.getStageSize().w
    const startH = engine.getStageSize().h
    const startX = event.clientX
    const startY = event.clientY
    handle.setPointerCapture(event.pointerId)
    const move = (e: PointerEvent): void => {
      setVal('w', startW + (e.clientX - startX))
      setVal('h', startH + (e.clientY - startY))
    }
    const up = (): void => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
  })

  const applyVisible = (visible: boolean): void => {
    panel.style.display = visible ? '' : 'none'
    localStorage.setItem(DEBUG_KEY, visible ? '1' : '0')
    if (visible) hooks.onOpen?.()
  }

  let debugW: number | null = null
  let debugH: number | null = null
  const applySize = (): void => engine.setDebugSize(debugW, debugH)

  /** 统一写入某轴尺寸并同步滑条/数值框（v=null 即跟随面板；写入值钳制到范围）。 */
  const setVal = (k: 'w' | 'h', v: number | null): void => {
    const min = k === 'w' ? W_MIN : H_MIN
    const max = k === 'w' ? W_MAX : H_MAX
    const fallback = k === 'w' ? 600 : 360
    const clamped = v === null ? null : Math.min(max, Math.max(min, Math.round(v)))
    if (k === 'w') debugW = clamped
    else debugH = clamped
    for (const input of panel.querySelectorAll<HTMLInputElement>(`input[data-k="${k}"]`)) {
      if (input.dataset.t === 'range') input.value = String(clamped ?? fallback)
      else input.value = clamped === null ? '' : String(clamped)
    }
    applySize()
  }

  gear.addEventListener('click', () => applyVisible(panel.style.display === 'none'))
  panel.querySelector('.py-debug-close')?.addEventListener('click', () => applyVisible(false))

  panel.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    switch (button.dataset.act) {
      case 'spawn': controller.forceSpawn(); break
      case 'travel': controller.timeTravel(); break
      case 'demo': controller.loadDemoArchive(); break
      case 'cold': controller.loadColdArchive(); break
      case 'snapshot': controller.snapshotState(); break
      case 'reset': controller.resetArchive(); break
      case 'gallery': controller.openGallery(); break
      case 'follow': {
        setVal('w', null)
        setVal('h', null)
        break
      }
    }
  })

  for (const input of panel.querySelectorAll<HTMLInputElement>('input[data-k]')) {
    if (input.dataset.t === 'range') {
      input.addEventListener('input', () => setVal(input.dataset.k as 'w' | 'h', Number(input.value)))
    } else {
      const apply = (): void => {
        const raw = input.value.trim()
        if (raw === '') return
        const value = Number(raw)
        if (Number.isFinite(value)) setVal(input.dataset.k as 'w' | 'h', value)
      }
      input.addEventListener('change', apply)
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') apply()
      })
    }
  }

  // 初始：跟随面板（滑条给默认显示值，数值框空白「自动」）
  setVal('w', null)
  setVal('h', null)

  const urlDebug = new URLSearchParams(location.search).get('debug') === '1'
  applyVisible(urlDebug || localStorage.getItem(DEBUG_KEY) === '1')
  // UX-1：面板与齿轮挂容器层——不随舞台缩小被裁剪；手柄挂舞台右下角
  container.append(panel, gear)
  stage.append(handle)
  return {
    dispose: (): void => {
      panel.remove()
      gear.remove()
      handle.remove()
    },
    setVisible: (visible: boolean): void => applyVisible(visible),
  }
}
