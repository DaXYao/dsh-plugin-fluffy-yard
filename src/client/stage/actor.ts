import type { Pet } from '../../core/types.ts'
import { personalityOf } from '../../core/traits.ts'
import { WALK_SPEED } from '../../config.ts'
import { petSpriteMarkup } from '../render/petSprite.ts'
import { bodyGeom } from '../render/parts.ts'
import { ACTION_DURATION, pickAction, type ActionName } from './actions.ts'
import type { DayPhase } from '../dayNight.ts'
import { svgEl } from './svgDom.ts'

export interface ActorContext {
  readonly width: number
  readonly groundY: number
  readonly flatten: boolean
  readonly dayPhase: DayPhase
}

type ActorState = 'entering' | 'active' | 'exiting'

const MARGIN = 70

/**
 * 单只宠物的舞台呈现（V2/V4/V9）：位置层 CSS translate、朝向层 scaleX、
 * 动作层 keyframes；每帧只写 transform 与 class。
 * P3 新增：directed 移动标记（引擎编排的移动不被 poke 打断，M5）、
 * 公共动作/徽章/立绘接口（争宠编排与风格切换，M1/M8）。
 */
export class PetActor {
  readonly root: SVGGElement
  pet: Pet

  private readonly facingEl: SVGGElement
  private readonly actionEl: SVGGElement
  private readonly nameEl: SVGTextElement
  private readonly badgeEl: SVGTextElement
  private readonly bubbleAnchor: SVGGElement
  private readonly bubbleEl: SVGGElement
  private readonly bubbleRect: SVGRectElement
  private readonly bubbleText: SVGTextElement

  private x: number
  private targetX: number
  private directed = false
  private pinnedAction: ActionName | null = null
  private facing: 1 | -1 = 1
  private state: ActorState
  private action: ActionName = 'idle'
  private actionTimer = 0
  private bubbleTimer = 0
  private exitPhase = 0
  private exitTimer = 0
  private done = false
  private wasFlatten = false
  private lastWidth = 0
  private lastDayPhase: DayPhase = 'day'

  constructor(pet: Pet, startX: number, initialFadeIn: boolean) {
    this.pet = pet
    this.x = startX
    this.targetX = startX
    this.state = initialFadeIn ? 'active' : 'entering'
    this.root = svgEl('g', { class: 'py-pet', 'data-id': pet.id })
    if (initialFadeIn) {
      this.root.style.opacity = '0'
      requestAnimationFrame(() => { this.root.style.opacity = '1' })
    }
    // 注意 V3：气泡双层——外层属性 transform 定位，内层 CSS 动画
    this.root.innerHTML = [
      '<g class="py-facing"><g class="py-action py-idle"></g></g>',
      '<text class="py-name" y="16"></text>',
      '<g class="py-bubble-anchor"><g class="py-bubble">',
      '<rect class="py-bubble-bg" x="0" y="0" width="0" height="0" rx="8"/>',
      '<text class="py-bubble-text" x="0" y="0"></text>',
      '</g></g>',
      '<text class="py-zzz" x="22" y="-76">Z z z</text>',
      '<text class="py-badge" x="-30" y="-64" style="display:none"></text>',
    ].join('')
    this.facingEl = this.root.querySelector<SVGGElement>('.py-facing')!
    this.actionEl = this.root.querySelector<SVGGElement>('.py-action')!
    this.nameEl = this.root.querySelector<SVGTextElement>('.py-name')!
    this.bubbleAnchor = this.root.querySelector<SVGGElement>('.py-bubble-anchor')!
    this.bubbleEl = this.root.querySelector<SVGGElement>('.py-bubble')!
    this.bubbleRect = this.root.querySelector<SVGRectElement>('.py-bubble-bg')!
    this.bubbleText = this.root.querySelector<SVGTextElement>('.py-bubble-text')!
    this.badgeEl = this.root.querySelector<SVGTextElement>('.py-badge')!
    this.actionEl.innerHTML = petSpriteMarkup(pet.traits, pet.id)
    this.nameEl.textContent = pet.name
    if (initialFadeIn) this.scheduleNext()
  }

  /** 引擎移动指令；directed=true 表示编排移动（poke 不打断，M5）。 */
  setTarget(x: number, directed = false): void {
    this.targetX = x
    this.directed = directed
  }

  isExiting(): boolean {
    return this.state === 'exiting'
  }

  /** 引擎指令：固定形态（sit/squish/sleep 等，G5）；null 恢复自由调度。 */
  setPinned(action: ActionName | null): void {
    this.pinnedAction = action
  }

  isDone(): boolean {
    return this.done
  }

  atTarget(): boolean {
    return Math.abs(this.targetX - this.x) <= 2
  }

  getX(): number {
    return this.x
  }

  /** 引擎指令：跳一下。自由游走中的宠物会先停下再跳（P2 遗留 #1，M5）。 */
  poke(): void {
    if (this.state !== 'active' || this.action === 'flatten') return
    if (this.action === 'walk' && !this.directed) this.targetX = this.x
    this.playAction('jump')
  }

  /** 引擎指令：播放指定动作（争宠编排用，M8）。 */
  performAction(name: ActionName): void {
    if (this.state !== 'exiting') this.playAction(name)
  }

  /** 徽章由引擎统一刷新：'' 无 / '🔒' 锁定 / '👑' 锁定且聚光灯持有（M6/M8）。 */
  setBadge(text: string): void {
    this.badgeEl.textContent = text
    this.badgeEl.style.display = text === '' ? 'none' : ''
  }

  /** 更换立绘（美术风格切换，M1/M11）。 */
  setSpriteMarkup(markup: string): void {
    this.actionEl.innerHTML = markup
  }

  updatePet(pet: Pet): void {
    this.pet = pet
    this.nameEl.textContent = pet.name
  }

  /** 开始离场（V9）：挥手 1.6s → 走向最近边缘 ≤4s → 渐隐 0.7s → done。 */
  beginExit(): void {
    if (this.state === 'exiting') return
    this.state = 'exiting'
    this.exitPhase = 1
    this.exitTimer = 1600
    this.playAction('wave')
    this.bubbleEl.classList.remove('show')
    this.bubbleTimer = 0
  }

  showBubble(text: string, ms = 3000): void {
    this.bubbleText.textContent = text
    this.bubbleEl.classList.add('show')
    this.bubbleTimer = ms
    const box = this.bubbleText.getBBox()
    const w = box.width + 22
    const h = 28
    const top = -(2 * bodyGeom(this.pet.traits.body).ry) - 14
    this.bubbleRect.setAttribute('x', String(-w / 2))
    this.bubbleRect.setAttribute('y', String(-h))
    this.bubbleRect.setAttribute('width', String(w))
    this.bubbleRect.setAttribute('height', String(h))
    this.bubbleText.setAttribute('y', String(-h + 18))
    this.bubbleAnchor.setAttribute('transform', `translate(0, ${top})`)
  }

  update(dt: number, ctx: ActorContext): void {
    this.lastWidth = ctx.width
    this.lastDayPhase = ctx.dayPhase

    // 出场时间线
    if (this.state === 'exiting') {
      this.exitTimer -= dt
      if (this.exitPhase === 1 && this.exitTimer <= 0) {
        this.exitPhase = 2
        this.exitTimer = 4000
        this.targetX = this.x < ctx.width / 2 ? -MARGIN : ctx.width + MARGIN
      } else if (this.exitPhase === 2 && (Math.abs(this.targetX - this.x) <= 3 || this.exitTimer <= 0)) {
        this.exitPhase = 3
        this.exitTimer = 700
        this.root.style.opacity = '0'
      } else if (this.exitPhase === 3 && this.exitTimer <= 0) {
        this.done = true
      }
    }

    // 矮窗躺平覆盖（最高优先级形态；V10）
    if (ctx.flatten) {
      this.wasFlatten = true
      if (this.action !== 'flatten') this.playAction('flatten')
    } else if (this.wasFlatten) {
      this.wasFlatten = false
      if (this.state === 'active') this.scheduleNext()
    }

    // 移动（walking 动画由移动自动触发）
    const dx = this.targetX - this.x
    if (Math.abs(dx) > 2) {
      const step = Math.min(Math.abs(dx), (WALK_SPEED * dt) / 1000)
      this.x += Math.sign(dx) * step
      this.setFacing(dx > 0 ? 1 : -1)
      if (this.action !== 'walk' && this.action !== 'flatten') this.playAction('walk')
    } else if (this.action === 'walk') {
      if (this.state === 'entering') {
        this.state = 'active'
        this.scheduleNext()
      } else if (this.state === 'active') {
        this.scheduleNext()
      }
    }

    // 动作计时（仅活跃态；walk 由移动驱动）
    if (this.state === 'active' && this.action !== 'walk' && !ctx.flatten && this.actionTimer > 0) {
      this.actionTimer -= dt
      if (this.actionTimer <= 0) this.scheduleNext()
    }

    // 气泡计时
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt
      if (this.bubbleTimer <= 0) this.bubbleEl.classList.remove('show')
    }

    this.root.style.transform = `translate(${this.x}px, ${ctx.groundY}px)`
  }

  private playAction(name: ActionName): void {
    this.action = name
    this.actionEl.setAttribute('class', `py-action py-${name}`)
    const [min, max] = ACTION_DURATION[name]
    this.actionTimer = min === max ? min : min + Math.random() * (max - min)
    this.root.classList.toggle('is-sleeping', name === 'sleep')
  }

  /** 挑下一个日常动作；walk = 在当前槽位附近游走（自由移动，M5）。 */
  private scheduleNext(): void {
    if (this.pinnedAction !== null) {
      this.playAction(this.pinnedAction)
      return
    }
    const next = pickAction(
      personalityOf(this.pet.passion),
      this.pet.mood ?? 60,
      this.lastDayPhase === 'night',
    )
    if (next === 'walk') {
      // 舞台宽度未知（首帧前）时退化为待机，避免游走目标被钳到边缘
      if (this.lastWidth <= 2 * MARGIN) {
        this.playAction('idle')
        return
      }
      const direction = Math.random() < 0.5 ? -1 : 1
      const distance = 30 + Math.random() * 70
      const maxX = Math.max(MARGIN, this.lastWidth - MARGIN)
      this.targetX = Math.min(Math.max(this.targetX + direction * distance, MARGIN), maxX)
      this.directed = false
    } else {
      this.playAction(next)
    }
  }

  private setFacing(dir: 1 | -1): void {
    if (this.facing === dir) return
    this.facing = dir
    this.facingEl.style.transform = dir === 1 ? '' : 'scaleX(-1)'
  }
}
