import {
  BALL_BATS, CHASE_MS, CUDDLE_MS, DRINK_GAP_MS, FLATTEN_H, FOOD_MAX_SERVINGS, FOOD_REFILL_ADD,
  IA_GAP_MS, MEAL_GAP_MS, PHOTO_SETTLE_MS, PHOTO_TIMEOUT_MS,
  ROTATE_LOCKED_MS, ROTATE_MS, SPAWN_CHECK_MS, STROLL_GAP_MS,
} from '../../config.ts'
import { personalityOf } from '../../core/traits.ts'
import type { ArtStyleId, Pet } from '../../core/types.ts'
import { PHASE_COLORS, phaseOf, type DayPhase } from '../dayNight.ts'
import { averageMood } from '../../core/mood.ts'
import { serializeStageSvg } from '../render/photoExport.ts'
import { styleOf } from '../render/styles.ts'
import { ensureStageStyles, type ActionName } from './actions.ts'
import { PetActor, type ActorContext } from './actor.ts'
import { lineupFor } from './lineup.ts'
import { PARTICLE_MARKUP, type ParticleKind } from './particles.ts'
import { bowlMarkup, propLayout, sofaMarkup, tableMarkup, wallMarkup, type PropLayout } from './props.ts'
import { SpotlightMachine, type SpotlightEvent } from './spotlight.ts'
import { svgEl } from './svgDom.ts'
import { computeTier, slotsFor, type Tier } from './tiers.ts'

export interface EngineOptions {
  readonly onPetClick?: (petId: string) => void
  readonly onPetEntered?: (petId: string) => void
  readonly onSpawnCheck?: (now: number) => void
  readonly onTierChanged?: (tier: Tier, prev: Tier) => void
  readonly onHolderChanged?: (petId: string | null) => void
  readonly onColdStart?: () => void
  readonly onWitness?: (kind: 'challenge' | 'cold' | 'summon-aloof' | 'photo-spotlight') => void
  /** 家具点击（F6：食盆添食 / 水碗提示）。 */
  readonly onPropClick?: (kind: 'food' | 'water') => void
  /** 宠物生活事件（F11：controller 做心情提升）。 */
  readonly onPetEvent?: (kind: 'meal' | 'drink' | 'cuddle', petId: string) => void
}

const MARGIN = 70
const EDGE_X = 22
const EDGE_GAP = 30
const TINY_EDGE_X = 16
const HUDDLE_GAP = 34
const TIER_RANK: Record<Tier, number> = { tiny: 0, spotlight: 1, narrow: 2, crowded: 3, roomy: 4 }

/** 行程时长与粒子（F4/F5）。 */
type TripKind = 'meal' | 'drink' | 'sit' | 'wander'
interface Trip { kind: TripKind; startedAt: number; arrived: boolean; until: number; lastParticle: number }

interface Interaction {
  readonly type: 'cuddle' | 'chase' | 'ball'
  readonly aId: string
  readonly bId: string
  phase: 'approach' | 'run' | 'bat' | 'end'
  until: number
  stepAcc: number
  bats: number
  ballX: number
  chaserIsA: boolean
}

const TRIP_MS: Record<TripKind, number> = { meal: 3200, drink: 2800, sit: 4000, wander: 0 }
const rand = (range: readonly [number, number]): number => range[0] + Math.random() * (range[1] - range[0])

/** 三段家具配色（F3/F14）。 */
const PROP_COLORS: Record<DayPhase, Record<string, string>> = {
  day: { '--py-wall': '#e8dcc8', '--py-wall2': '#d9c9ae', '--py-prop': '#e8b98a', '--py-prop2': '#d9a877', '--py-propline': '#8a6f4d', '--py-glass': '#cfe8f5' },
  dusk: { '--py-wall': '#ecd9c0', '--py-wall2': '#dcbfa0', '--py-prop': '#e0a878', '--py-prop2': '#cf9666', '--py-propline': '#7c5c38', '--py-glass': '#f5cfa8' },
  night: { '--py-wall': '#5d6478', '--py-wall2': '#4c5265', '--py-prop': '#8a7f8f', '--py-prop2': '#776c7d', '--py-propline': '#3a3f4e', '--py-glass': '#2e3a52' },
}

export class StageEngine {
  private readonly stageDiv: HTMLDivElement
  private readonly svg: SVGSVGElement
  private readonly grass: SVGRectElement
  private readonly hud: HTMLDivElement
  private readonly propsLayer: SVGGElement
  private readonly particlesLayer: SVGGElement
  private layout: PropLayout = propLayout(0)
  private foodServings = 3
  private actors: PetActor[] = []
  private raf = 0
  private lastT = 0
  private w = 0
  private h = 0
  private groundY = 0
  private tier: Tier = 'roomy'
  private flatten = false
  private sizeDirty = true
  private checkAcc = 0
  private ro: ResizeObserver | null = null
  private readonly spotlight = new SpotlightMachine({ rotateMs: ROTATE_MS, rotateLockedMs: ROTATE_LOCKED_MS })
  private styleId: ArtStyleId = 'geo'
  private readonly overflowIds = new Set<string>()
  private readonly dashNext = new Map<string, number>()
  private readonly dashing = new Set<string>()
  private readonly strutPending = new Set<string>()
  private excursionReturnAt = 0
  private excursionActorId: string | null = null
  private yawnNextAt = 0
  private photoActive = false
  private dayPhase: DayPhase = 'day'
  private phaseOverride: DayPhase | null = null
  private phaseCheckAt = 0
  private reactionTimer: ReturnType<typeof setTimeout> | null = null
  private rainEl: HTMLDivElement | null = null
  // P6：吃喝/溜达/互动（F4–F8）
  private readonly nextMealAt = new Map<string, number>()
  private readonly nextDrinkAt = new Map<string, number>()
  private readonly nextStrollAt = new Map<string, number>()
  private readonly trips = new Map<string, Trip>()
  private ia: Interaction | null = null
  private iaNextAt = 0
  private ballEl: SVGCircleElement | null = null

  constructor(container: HTMLElement, private readonly opts: EngineOptions = {}) {
    ensureStageStyles()
    this.stageDiv = document.createElement('div')
    this.stageDiv.className = 'py-stage'
    this.svg = svgEl('svg')
    const sky = svgEl('rect', { class: 'py-sky', x: 0, y: 0, width: '100%', height: '100%' })
    this.grass = svgEl('rect', { class: 'py-grass', x: 0, width: '100%' })
    this.propsLayer = svgEl('g', { class: 'py-props' })
    this.particlesLayer = svgEl('g', { class: 'py-particles' })
    this.svg.append(sky, this.grass, this.propsLayer, this.particlesLayer)
    this.hud = document.createElement('div')
    this.hud.className = 'py-hud'
    this.stageDiv.append(this.svg, this.hud)
    this.propsLayer.addEventListener('click', event => {
      const hit = (event.target as Element).closest('[data-prop]')
      if (hit !== null) this.opts.onPropClick?.(hit.getAttribute('data-prop') as 'food' | 'water')
    })
    this.applyPhase(phaseOf(Date.now()))
    container.appendChild(this.stageDiv)
  }

  start(): void {
    this.ro = new ResizeObserver(() => { this.sizeDirty = true })
    this.ro.observe(this.stageDiv)
    this.relayout()
    this.lastT = performance.now()
    const loop = (t: number): void => {
      const dt = Math.min(100, Math.max(0, t - this.lastT))
      this.lastT = t
      if (this.sizeDirty) {
        this.sizeDirty = false
        this.relayout()
      }
      this.phaseCheckAt += dt
      if (this.phaseCheckAt >= 30_000) {
        this.phaseCheckAt = 0
        if (this.phaseOverride === null) {
          const phase = phaseOf(Date.now())
          if (phase !== this.dayPhase) this.applyPhase(phase)
        }
      }
      const ctx: ActorContext = { width: this.w, groundY: this.groundY, flatten: this.flatten, dayPhase: this.dayPhase }
      if (!this.photoActive) {
        for (const actor of this.actors) actor.update(dt, ctx)
      }
      this.actors = this.actors.filter(actor => {
        if (!actor.isDone()) return true
        actor.root.remove()
        return false
      })
      if (!this.photoActive) {
        this.runSpotlight()
        this.updateStrut()
        this.updateDash()
        this.updateExcursion()
        this.updateYawnWave()
        const now = Date.now()
        this.updateTrips(now)
        this.updateInteractions(now, dt)
      }
      this.checkAcc += dt
      if (this.checkAcc >= SPAWN_CHECK_MS) {
        this.checkAcc = 0
        this.opts.onSpawnCheck?.(Date.now())
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    if (this.reactionTimer !== null) clearTimeout(this.reactionTimer)
    this.ro?.disconnect()
    this.stageDiv.remove()
    this.actors = []
  }

  getTier(): Tier {
    return this.tier
  }

  getStageEl(): HTMLElement {
    return this.stageDiv
  }

  getStageSize(): { readonly w: number; readonly h: number } {
    return { w: this.w, h: this.h }
  }

  getHolderId(): string | null {
    return this.spotlight.getHolder()
  }

  getPetPos(petId: string): { readonly x: number; readonly y: number } | null {
    const actor = this.actors.find(a => a.pet.id === petId)
    if (actor === undefined || actor.isExiting()) return null
    return { x: actor.getX(), y: this.groundY - 105 }
  }

  setHudText(text: string): void {
    this.hud.textContent = text
  }

  showBubble(petId: string, text: string, ms?: number): void {
    this.actors.find(actor => actor.pet.id === petId)?.showBubble(text, ms)
  }

  poke(petId: string): void {
    this.actors.find(actor => actor.pet.id === petId)?.poke()
  }

  performAction(petId: string, name: ActionName): void {
    this.actors.find(actor => actor.pet.id === petId)?.performAction(name)
  }

  restyle(styleId: ArtStyleId): void {
    this.styleId = styleId
    const style = styleOf(styleId)
    for (const actor of this.actors) actor.setSpriteMarkup(style.render(actor.pet.traits, actor.pet.id))
  }

  setDebugSize(w: number | null, h: number | null): void {
    this.stageDiv.style.width = w === null ? '100%' : `${w}px`
    this.stageDiv.style.height = h === null ? '100%' : `${h}px`
  }

  /** 昼夜手动覆盖（F10）：null = 回到时钟自动。 */
  setPhaseOverride(phase: DayPhase | null): void {
    this.phaseOverride = phase
    this.applyPhase(phase ?? phaseOf(Date.now()))
  }

  /** 添食（F6）：份数钳制 + 闪光。 */
  refillFood(): void {
    this.foodServings = Math.min(FOOD_MAX_SERVINGS, this.foodServings + FOOD_REFILL_ADD)
    this.renderProps()
    this.spawnParticles(this.layout.foodX, this.groundY - 20, 'sparkle', 6)
  }

  /** 粒子（F9）：外层属性定位，内层 CSS 动画。 */
  spawnParticles(x: number, y: number, kind: ParticleKind, count: number): void {
    for (let i = 0; i < count; i++) {
      const dx = Math.round(Math.random() * 36 - 18)
      const pd = Math.round(900 + Math.random() * 500)
      const jitter = Math.round(Math.random() * 14 - 7)
      const wrap = svgEl('g', { transform: `translate(${x + jitter},${y})` })
      wrap.innerHTML = `<g class="py-particle" style="--dx:${dx}px;--pd:${pd}ms">${PARTICLE_MARKUP[kind]}</g>`
      this.particlesLayer.appendChild(wrap)
      const inner = wrap.firstElementChild as SVGElement
      inner.addEventListener('animationend', () => wrap.remove())
      window.setTimeout(() => wrap.remove(), pd + 700)
    }
  }

  summon(petId: string): boolean {
    if (this.tier !== 'spotlight') return false
    const pets = this.actors.filter(a => !a.isExiting()).map(a => a.pet)
    const events = this.spotlight.summon(petId, pets, this.tier, Date.now())
    if (events.length === 0) return false
    const summoned = pets.find(p => p.id === petId)
    if (summoned !== undefined && personalityOf(summoned.passion) === 'aloof') {
      this.opts.onWitness?.('summon-aloof')
    }
    const before = this.spotlight.getHolder()
    for (const ev of events) this.applySpotlightEvent(ev)
    if (this.spotlight.getHolder() !== before) {
      this.refreshBadges()
      this.opts.onHolderChanged?.(this.spotlight.getHolder())
    }
    return true
  }

  async photoSession(): Promise<{ readonly svg: string; readonly w: number; readonly h: number } | null> {
    const active = this.actors.filter(a => !a.isExiting())
    if (this.photoActive || active.length === 0) return null
    this.photoActive = true
    this.abortTripsAndInteraction('photo')
    const sorted = active.slice().sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    const cx = this.w / 2
    sorted.forEach((actor, index) => {
      actor.setPinned(null)
      actor.setTarget(cx + (index - (sorted.length - 1) / 2) * HUDDLE_GAP, true)
    })
    const deadline = Date.now() + PHOTO_TIMEOUT_MS
    await new Promise<void>(resolve => {
      const poll = window.setInterval(() => {
        const allArrived = this.actors
          .filter(a => !a.isExiting())
          .every(a => a.atTarget())
        if (allArrived || Date.now() >= deadline) {
          window.clearInterval(poll)
          window.setTimeout(resolve, PHOTO_SETTLE_MS)
        }
      }, 100)
    })
    if (this.tier === 'spotlight') this.opts.onWitness?.('photo-spotlight')
    this.particlesLayer.innerHTML = ''   // F13：粒子与球不入镜
    const svg = serializeStageSvg(this.svg)
    this.photoActive = false
    this.assignSlots()
    return { svg, w: Math.round(this.w), h: Math.round(this.h) }
  }

  syncPets(pets: readonly Pet[], options: { initial?: boolean } = {}): void {
    const ids = new Set(pets.map(p => p.id))
    for (const actor of this.actors) {
      if (!ids.has(actor.pet.id)) actor.beginExit()
    }
    pets.forEach((pet, index) => {
      const existing = this.actors.find(actor => actor.pet.id === pet.id)
      if (existing !== undefined) {
        existing.updatePet(pet)
        return
      }
      const slot = this.slotX(index, pets.length)
      const startX = options.initial === true
        ? slot
        : (Math.random() < 0.5 ? -MARGIN : this.w + MARGIN)
      const actor = new PetActor(pet, startX, options.initial === true)
      actor.setSpriteMarkup(styleOf(this.styleId).render(pet.traits, pet.id))
      actor.root.addEventListener('click', () => this.opts.onPetClick?.(pet.id))
      actor.setTarget(slot, true)
      this.actors.push(actor)
      // F1：粒子层永居顶层
      this.svg.insertBefore(actor.root, this.particlesLayer)
      // F5：为新宠物排生活计时
      const now = Date.now()
      this.nextMealAt.set(pet.id, now + rand(MEAL_GAP_MS))
      this.nextDrinkAt.set(pet.id, now + rand(DRINK_GAP_MS))
      this.nextStrollAt.set(pet.id, now + rand(STROLL_GAP_MS))
      if (options.initial !== true) this.opts.onPetEntered?.(pet.id)
    })
    this.assignSlots()
    this.evalTier()
    this.refreshBadges()
  }

  private slotX(index: number, count: number): number {
    const usable = Math.max(0, this.w - 2 * MARGIN)
    return MARGIN + (index + 0.5) * usable / Math.max(1, count)
  }

  private edgeTargets(count: number, edgeX: number): number[] {
    const pos: number[] = []
    let li = 0
    let ri = 0
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) pos.push(edgeX + (li++) * EDGE_GAP)
      else pos.push(this.w - edgeX - (ri++) * EDGE_GAP)
    }
    return pos
  }

  private assignSlots(): void {
    const active = this.actors.filter(actor => !actor.isExiting())
    const sorted = [...active].sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    const slots = slotsFor(this.w)
    this.overflowIds.clear()

    if (this.tier === 'tiny') {
      const edges = this.edgeTargets(Math.max(0, sorted.length - 1), TINY_EDGE_X)
      sorted.forEach((actor, index) => {
        if (index === 0) {
          actor.setTarget(this.w / 2, true)
          actor.setPinned('squish')
        } else {
          actor.setTarget(edges[index - 1] ?? TINY_EDGE_X, true)
          actor.setPinned('sit')
        }
      })
      return
    }

    if (this.tier === 'spotlight') {
      const holderId = this.spotlight.getHolder()
      const napperId = this.spotlight.getNapper()
      const onStage = holderId ?? napperId
      const edges = this.edgeTargets(Math.max(0, sorted.length - (onStage === null ? 0 : 1)), EDGE_X)
      let edgeIndex = 0
      for (const actor of sorted) {
        if (actor.pet.id === holderId) {
          actor.setTarget(this.w / 2, true)
          actor.setPinned(null)
        } else if (holderId === null && actor.pet.id === napperId) {
          actor.setTarget(this.w / 2, true)
          actor.setPinned('sleep')
        } else {
          actor.setTarget(edges[edgeIndex++] ?? EDGE_X, true)
          actor.setPinned('sit')
          this.overflowIds.add(actor.pet.id)
        }
      }
      return
    }

    if (slots === 0 || slots >= sorted.length) {
      sorted.forEach((actor, index) => {
        actor.setTarget(this.slotX(index, sorted.length), true)
        actor.setPinned(null)
      })
      return
    }

    const lineup = lineupFor(this.tier, sorted.map(a => a.pet), slots)
    const idSet = new Set(lineup.slotIds)
    const edges = this.edgeTargets(lineup.overflowIds.length, EDGE_X)
    const overflowIndex = new Map(lineup.overflowIds.map((id, i) => [id, i] as const))
    sorted.forEach((actor, index) => {
      const id = actor.pet.id
      if (idSet.has(id)) {
        const slotIndex = lineup.slotIds.indexOf(id)
        actor.setTarget(this.slotX(slotIndex >= 0 ? slotIndex : index, slots), true)
        actor.setPinned(null)
        return
      }
      this.overflowIds.add(id)
      actor.setTarget(edges[overflowIndex.get(id) ?? 0] ?? EDGE_X, true)
      const nonEager = personalityOf(actor.pet.passion) !== 'eager'
      actor.setPinned(this.tier === 'crowded' && nonEager ? 'sit' : null)
    })
  }

  private relayout(): void {
    const rect = this.stageDiv.getBoundingClientRect()
    this.w = Math.max(0, rect.width)
    this.h = Math.max(0, rect.height)
    this.groundY = Math.round(this.h - Math.max(26, this.h * 0.12))
    this.grass.setAttribute('y', String(this.groundY - 8))
    this.grass.setAttribute('height', String(Math.max(0, this.h - this.groundY + 8)))
    this.renderProps()
    this.assignSlots()
    this.evalTier()
  }

  /** 家具渲染（F1–F3/F6）：布局随宽度，配色走 CSS 变量。 */
  private renderProps(): void {
    this.layout = propLayout(this.w)
    if (!this.layout.showBowls) {
      this.propsLayer.innerHTML = ''
      return
    }
    let markup = ''
    if (this.layout.showFurniture) {
      markup += wallMarkup(this.w, this.groundY, this.layout.windowX)
      markup += sofaMarkup(this.layout.sofaX, this.groundY)
      markup += tableMarkup(this.layout.tableX, this.groundY)
    }
    markup += bowlMarkup('food', this.layout.foodX, this.groundY, this.foodServings > 0)
    markup += bowlMarkup('water', this.layout.waterX, this.groundY, true)
    this.propsLayer.innerHTML = markup
  }

  private evalTier(): void {
    const activeCount = this.actors.filter(actor => !actor.isExiting()).length
    const next = computeTier(this.w, activeCount)
    if (next !== this.tier) {
      const prev = this.tier
      this.tier = next
      console.info(`[pet-yard] tier: ${prev} → ${next}`)
      this.opts.onTierChanged?.(next, prev)
      this.tierReaction(next, prev)
      if (TIER_RANK[next] <= TIER_RANK.narrow) this.abortTripsAndInteraction('tier')
      if (this.reactionTimer !== null) clearTimeout(this.reactionTimer)
      this.reactionTimer = setTimeout(() => {
        this.reactionTimer = null
        this.assignSlots()
      }, 600)
    }
    const flatten = this.h > 0 && this.h < FLATTEN_H
    if (flatten !== this.flatten) {
      this.flatten = flatten
      console.info(`[pet-yard] flatten: ${flatten ? 'on' : 'off'}`)
    }
  }

  private tierReaction(next: Tier, prev: Tier): void {
    const shrinking = TIER_RANK[next] < TIER_RANK[prev]
    for (const actor of this.actors) {
      if (actor.isExiting()) continue
      const p = personalityOf(actor.pet.passion)
      if (shrinking) {
        if (p === 'eager') {
          actor.poke()
          actor.showBubble('！', 1200)
        } else if (p === 'calm') {
          actor.performAction('tilt')
        } else {
          actor.performAction('twitch')
        }
      } else if (p === 'eager') {
        actor.performAction('spin')
      }
    }
  }

  private applyPhase(phase: DayPhase): void {
    this.dayPhase = phase
    const colors = PHASE_COLORS[phase]
    this.svg.querySelectorAll<SVGRectElement>('.py-sky').forEach(el => { el.style.fill = colors.sky })
    this.svg.querySelectorAll<SVGRectElement>('.py-grass').forEach(el => { el.style.fill = colors.grass })
    for (const [key, value] of Object.entries(PROP_COLORS[phase])) {
      this.stageDiv.style.setProperty(key, value)
    }
  }

  setRain(on: boolean): void {
    if (on && this.rainEl === null) {
      this.rainEl = document.createElement('div')
      this.rainEl.className = 'py-rain'
      this.stageDiv.appendChild(this.rainEl)
    } else if (!on && this.rainEl !== null) {
      this.rainEl.remove()
      this.rainEl = null
    }
  }

  // ---- 聚光灯（P4/P5 原样） ----

  private runSpotlight(): void {
    const pets = this.actors.filter(a => !a.isExiting()).map(a => a.pet)
    const calmChallenge = averageMood(pets) >= 80
    const before = this.spotlight.getHolder()
    for (const ev of this.spotlight.tick(pets, this.tier, Date.now(), { calmChallenge })) {
      this.applySpotlightEvent(ev)
    }
    const after = this.spotlight.getHolder()
    if (before !== after) {
      this.refreshBadges()
      this.opts.onHolderChanged?.(after)
    }
  }

  private applySpotlightEvent(ev: SpotlightEvent): void {
    if (ev.type === 'appoint') {
      console.info(`[pet-yard] spotlight: ${ev.petId} 上台`)
      this.assignSlots()
    } else if (ev.type === 'vacant') {
      console.info('[pet-yard] spotlight: 冷场——今天大家都有点懒得营业……')
      this.opts.onColdStart?.()
      this.opts.onWitness?.('cold')
      this.assignSlots()
    } else if (ev.type === 'nap') {
      console.info(`[pet-yard] spotlight: ${ev.petId} 占着舞台打盹`)
      this.assignSlots()
    } else if (ev.type === 'excursion') {
      const actor = this.actors.find(a => a.pet.id === ev.petId)
      if (actor !== undefined && !actor.isExiting()) {
        console.info(`[pet-yard] spotlight: ${ev.petId} 下台溜达一圈`)
        actor.setPinned(null)
        actor.setTarget(Math.max(MARGIN, Math.min(this.w - MARGIN, this.w / 4 + Math.random() * this.w / 2)), true)
        this.excursionActorId = ev.petId
        this.excursionReturnAt = Date.now() + 2600
      }
    } else {
      const prev = this.actors.find(a => a.pet.id === ev.previousHolderId)
      const next = this.actors.find(a => a.pet.id === ev.challengerId)
      if (prev !== undefined && !prev.isExiting()) {
        if (personalityOf(prev.pet.passion) === 'eager') {
          prev.performAction('roll')
          prev.showBubble('哇！', 1600)
        } else {
          prev.performAction('tilt')
        }
      }
      if (next !== undefined && !next.isExiting()) {
        next.setTarget(this.w / 2, true)
        if (personalityOf(next.pet.passion) === 'aloof') next.showBubble('……', 2200)
        if (personalityOf(next.pet.passion) === 'eager') this.strutPending.add(ev.challengerId)
      }
      this.opts.onWitness?.('challenge')
      console.info(`[pet-yard] spotlight: ${ev.challengerId} 上台（顶替 ${ev.previousHolderId}）`)
      this.assignSlots()
    }
  }

  private updateStrut(): void {
    if (this.strutPending.size === 0) return
    if (this.tier !== 'spotlight') {
      this.strutPending.clear()
      return
    }
    for (const id of [...this.strutPending]) {
      const actor = this.actors.find(a => a.pet.id === id)
      if (actor === undefined || actor.isExiting()) {
        this.strutPending.delete(id)
        continue
      }
      if (actor.atTarget()) {
        this.strutPending.delete(id)
        actor.performAction('jump')
        actor.showBubble('看我！', 1800)
      }
    }
  }

  private updateExcursion(): void {
    if (this.excursionActorId === null || this.excursionReturnAt === 0) return
    if (Date.now() < this.excursionReturnAt) return
    const id = this.excursionActorId
    this.excursionActorId = null
    this.excursionReturnAt = 0
    if (this.spotlight.getHolder() !== id) return
    const actor = this.actors.find(a => a.pet.id === id)
    if (actor === undefined || actor.isExiting()) return
    actor.setTarget(this.w / 2, true)
    this.strutPending.add(id)
  }

  private updateYawnWave(): void {
    const cold = this.tier === 'spotlight' && this.spotlight.getHolder() === null
    const now = Date.now()
    if (!cold) {
      this.yawnNextAt = now + 4000
      return
    }
    if (now < this.yawnNextAt) return
    this.yawnNextAt = now + 8000 + Math.random() * 6000
    const sorted = this.actors.filter(a => !a.isExiting()).sort((a, b) => a.pet.arrivedAt - b.pet.arrivedAt)
    sorted.forEach((actor, index) => {
      window.setTimeout(() => {
        if (!actor.isExiting() && !actor.isDone()) actor.performAction('yawn')
      }, index * 900)
    })
  }

  private updateDash(): void {
    if (this.tier !== 'crowded' && this.tier !== 'narrow') {
      this.dashing.clear()
      return
    }
    const now = Date.now()
    for (const actor of this.actors) {
      if (actor.isExiting()) continue
      const id = actor.pet.id
      if (!this.overflowIds.has(id)) continue
      if (personalityOf(actor.pet.passion) !== 'eager') continue
      if (this.dashing.has(id)) {
        if (actor.atTarget()) {
          this.dashing.delete(id)
          this.dashNext.set(id, now + 4000 + Math.random() * 5000)
          this.assignSlots()
        }
        continue
      }
      let next = this.dashNext.get(id)
      if (next === undefined) {
        next = now + 2000 + Math.random() * 3000
        this.dashNext.set(id, next)
      }
      if (now >= next) {
        this.dashing.add(id)
        actor.setPinned(null)
        actor.setTarget(60 + Math.random() * Math.max(60, this.w - 120), true)
        actor.showBubble('让我进去！', 1500)
      }
    }
  }

  private refreshBadges(): void {
    const holderId = this.spotlight.getHolder()
    for (const actor of this.actors) {
      if (actor.isExiting()) {
        actor.setBadge('')
        continue
      }
      const isHolder = actor.pet.id === holderId
      actor.setBadge(actor.pet.locked ? (isHolder ? '👑' : '🔒') : '')
    }
  }

  // ---- P6：吃喝 / 溜达 / 互动（F4–F8） ----

  private isFreeActor(actor: PetActor): boolean {
    const id = actor.pet.id
    return !actor.isExiting()
      && !this.overflowIds.has(id)
      && !this.trips.has(id)
      && !this.isInInteraction(id)
      && !this.dashing.has(id)
      && !this.strutPending.has(id)
  }

  private isInInteraction(id: string): boolean {
    return this.ia !== null && (this.ia.aId === id || this.ia.bId === id)
  }

  private actorOf(id: string): PetActor | undefined {
    return this.actors.find(a => a.pet.id === id)
  }

  private updateTrips(now: number): void {
    if (this.tier !== 'roomy' && this.tier !== 'crowded') {
      this.abortTripsAndInteraction('tier')
      return
    }
    // 发起（F5：餐需有食物；sit 需有家具，否则退化为 wander）
    for (const actor of this.actors) {
      if (!this.isFreeActor(actor)) continue
      const id = actor.pet.id
      if (this.nextMealAt.get(id) !== undefined && now >= (this.nextMealAt.get(id) ?? 0) && this.foodServings > 0 && this.layout.showBowls) {
        this.beginTrip(actor, 'meal', now)
        continue
      }
      if (this.nextDrinkAt.get(id) !== undefined && now >= (this.nextDrinkAt.get(id) ?? 0) && this.layout.showBowls) {
        this.beginTrip(actor, 'drink', now)
        continue
      }
      if (this.nextStrollAt.get(id) !== undefined && now >= (this.nextStrollAt.get(id) ?? 0)) {
        this.beginTrip(actor, Math.random() < 0.55 && this.layout.showFurniture ? 'sit' : 'wander', now)
      }
    }
    // 推进
    for (const [id, trip] of [...this.trips]) {
      const actor = this.actorOf(id)
      if (actor === undefined || actor.isExiting()) {
        this.endTrip(id, now)
        continue
      }
      if (!trip.arrived) {
        if (actor.atTarget()) {
          trip.arrived = true
          trip.until = now + TRIP_MS[trip.kind]
          trip.lastParticle = now
          if (trip.kind === 'meal') {
            this.foodServings--
            this.renderProps()
            actor.setPinned('eat')
            this.opts.onPetEvent?.('meal', id)
          } else if (trip.kind === 'drink') {
            actor.setPinned('drink')
            this.opts.onPetEvent?.('drink', id)
          } else if (trip.kind === 'sit') {
            actor.setPinned('sit')
          } else {
            this.endTrip(id, now)
          }
        }
        continue
      }
      if (trip.kind === 'meal' || trip.kind === 'drink') {
        if (now - trip.lastParticle >= 800) {
          trip.lastParticle = now
          const spotX = trip.kind === 'meal' ? this.layout.foodX : this.layout.waterX
          this.spawnParticles(spotX, this.groundY - 18, trip.kind === 'meal' ? 'crumb' : 'drop', 1)
        }
      }
      if (now >= trip.until) this.endTrip(id, now)
    }
  }

  private beginTrip(actor: PetActor, kind: TripKind, now: number): void {
    const id = actor.pet.id
    let targetX: number
    if (kind === 'meal') targetX = this.layout.foodX
    else if (kind === 'drink') targetX = this.layout.waterX
    else if (kind === 'sit') targetX = Math.random() < 0.6 ? this.layout.sofaX : this.layout.tableX
    else targetX = MARGIN + Math.random() * Math.max(0, this.w - 2 * MARGIN)
    actor.setPinned(null)
    actor.setTarget(targetX, true)
    this.trips.set(id, { kind, startedAt: now, arrived: false, until: 0, lastParticle: 0 })
    if (kind === 'meal') this.nextMealAt.delete(id)
    else if (kind === 'drink') this.nextDrinkAt.delete(id)
    else this.nextStrollAt.delete(id)
  }

  private endTrip(id: string, now: number): void {
    const trip = this.trips.get(id)
    this.trips.delete(id)
    const actor = this.actorOf(id)
    if (actor !== undefined && !actor.isExiting()) actor.setPinned(null)
    if (trip?.kind === 'meal') this.nextMealAt.set(id, now + rand(MEAL_GAP_MS))
    else if (trip?.kind === 'drink') this.nextDrinkAt.set(id, now + rand(DRINK_GAP_MS))
    else this.nextStrollAt.set(id, now + rand(STROLL_GAP_MS))
    this.assignSlots()
  }

  /** 中止全部行程与互动（档位跌落/合影；F4/F13）。 */
  private abortTripsAndInteraction(_reason: 'tier' | 'photo'): void {
    const now = Date.now()
    for (const id of [...this.trips.keys()]) this.endTrip(id, now)
    this.cleanupInteraction()
  }

  private updateInteractions(now: number, dt: number): void {
    if (this.ia !== null) {
      this.advanceInteraction(now, dt)
      return
    }
    if (this.tier !== 'roomy' && this.tier !== 'crowded') {
      this.iaNextAt = now + 8000
      return
    }
    if (now < this.iaNextAt) return
    const free = this.actors.filter(a => this.isFreeActor(a))
    if (free.length < 2) {
      this.iaNextAt = now + 6000
      return
    }
    this.iaNextAt = now + rand(IA_GAP_MS)
    const a = free[Math.floor(Math.random() * free.length)]!
    const rest = free.filter(x => x !== a)
    const b = rest[Math.floor(Math.random() * rest.length)]!
    const type = (['cuddle', 'chase', 'ball'] as const)[Math.floor(Math.random() * 3)]!
    this.ia = { type, aId: a.pet.id, bId: b.pet.id, phase: 'approach', until: 0, stepAcc: 0, bats: 0, ballX: 0, chaserIsA: true }
    a.setPinned(null)
    b.setPinned(null)
    if (type === 'cuddle') {
      a.setTarget(b.getX() - 30, true)
    } else if (type === 'chase') {
      this.ia.phase = 'run'
      this.ia.until = now + CHASE_MS
      a.showBubble('等等我！', 1800)
      b.showBubble('嘿嘿！', 1800)
      b.setTarget(MARGIN + Math.random() * Math.max(0, this.w - 2 * MARGIN), true)
      a.setTarget(b.getX(), true)
    } else {
      this.ia.phase = 'bat'
      this.ia.ballX = Math.max(MARGIN, Math.min(this.w - MARGIN, (a.getX() + b.getX()) / 2))
      this.ia.chaserIsA = true
      this.spawnBall()
      this.retargetChaser()
    }
    console.info(`[pet-yard] interaction: ${type}（${a.pet.id} & ${b.pet.id}）`)
  }

  private advanceInteraction(now: number, dt: number): void {
    const ia = this.ia!
    const a = this.actorOf(ia.aId)
    const b = this.actorOf(ia.bId)
    if (a === undefined || b === undefined || a.isExiting() || b.isExiting()) {
      this.cleanupInteraction()
      return
    }
    if (ia.phase === 'approach') {
      if (a.atTarget()) {
        ia.phase = 'end'
        ia.until = now + CUDDLE_MS
        a.performAction('stretch')
        b.performAction('stretch')
        this.spawnParticles((a.getX() + b.getX()) / 2, this.groundY - 72, 'heart', 3)
        a.showBubble('贴贴～', 1600)
        b.showBubble('呼噜呼噜…', 1600)
      }
      return
    }
    if (ia.phase === 'run') {
      ia.stepAcc += dt
      if (ia.stepAcc >= 1100) {
        ia.stepAcc = 0
        b.setTarget(MARGIN + Math.random() * Math.max(0, this.w - 2 * MARGIN), true)
      }
      a.setTarget(b.getX(), true)
      if (now >= ia.until) {
        ia.phase = 'end'
        ia.until = now + 1000
        a.performAction('jump')
        b.performAction('jump')
      }
      return
    }
    if (ia.phase === 'bat') {
      const chaser = ia.chaserIsA ? a : b
      if (chaser.atTarget()) {
        ia.bats++
        if (ia.bats >= BALL_BATS) {
          ia.phase = 'end'
          ia.until = now + 1200
          this.fadeBall()
          a.performAction('jump')
          b.performAction('jump')
          a.showBubble('好玩！', 1600)
          return
        }
        ia.chaserIsA = !ia.chaserIsA
        this.moveBall()
        this.retargetChaser()
      }
      return
    }
    if (now >= ia.until) {
      const wasCuddle = ia.type === 'cuddle'
      const cuddleId = ia.aId
      this.cleanupInteraction()
      if (wasCuddle) this.opts.onPetEvent?.('cuddle', cuddleId)
      this.assignSlots()
    }
  }

  private retargetChaser(): void {
    const ia = this.ia
    if (ia === null) return
    const chaser = this.actorOf(ia.chaserIsA ? ia.aId : ia.bId)
    chaser?.setTarget(ia.ballX, true)
  }

  private moveBall(): void {
    const ia = this.ia
    if (ia === null || this.ballEl === null) return
    ia.ballX = MARGIN + Math.random() * Math.max(0, this.w - 2 * MARGIN)
    this.ballEl.style.transform = `translate(${ia.ballX}px, ${this.groundY - 7}px)`
  }

  private spawnBall(): void {
    const ia = this.ia
    if (ia === null) return
    this.ballEl = svgEl('circle', { class: 'py-ball', r: 6, fill: '#e8964f', stroke: '#8a5526', 'stroke-width': 1.5 })
    this.ballEl.style.transform = `translate(${ia.ballX}px, ${this.groundY - 7}px)`
    this.particlesLayer.appendChild(this.ballEl)
  }

  private fadeBall(): void {
    if (this.ballEl === null) return
    this.ballEl.classList.add('py-ball-out')
    const ball = this.ballEl
    this.ballEl = null
    window.setTimeout(() => ball.remove(), 700)
  }

  private cleanupInteraction(): void {
    this.ia = null
    if (this.ballEl !== null) this.fadeBall()
  }
}
