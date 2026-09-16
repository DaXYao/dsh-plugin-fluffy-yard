import type { Tier } from './tiers.ts'

/** 聚光灯决策所需的最小宠物切片（M8/G6–G9）。 */
export interface SpotlightPet {
  readonly id: string
  readonly passion: number
  readonly locked: boolean
  readonly arrivedAt: number
}

export type SpotlightEvent =
  | { readonly type: 'appoint'; readonly petId: string }
  | { readonly type: 'vacant' }
  | { readonly type: 'nap'; readonly petId: string }
  | { readonly type: 'challenge'; readonly challengerId: string; readonly previousHolderId: string }
  | { readonly type: 'excursion'; readonly petId: string }

export interface SpotlightOptions {
  readonly rotateMs: number
  readonly rotateLockedMs: number
}

const EAGER_PASSION = 60
const CALM_MIN = 20

/**
 * 聚光灯轮换状态机（纯逻辑）：只在 spotlight 档活动。
 * 持有者必须热情（点名除外——summon 可任命任意宠物，G7）；
 * 无热情者 → 冷场：淡定者占台打盹（nap）或舞台空置（vacant，各发一次）；
 * 无其他热情者时到期每第 2 次 → excursion（G8）。
 */
export class SpotlightMachine {
  private holderId: string | null = null
  private endsAt = 0
  private coldAnnounced = false
  private napperId: string | null = null
  private noChallengerExpiries = 0

  constructor(private readonly opts: SpotlightOptions) {}

  getHolder(): string | null {
    return this.holderId
  }

  getNapper(): string | null {
    return this.napperId
  }

  /** 引擎每帧调用；事件由引擎编排动画。 */
  tick(
    pets: readonly SpotlightPet[],
    tier: Tier,
    now: number,
    options: { readonly calmChallenge?: boolean } = {},
  ): readonly SpotlightEvent[] {
    if (tier !== 'spotlight') {
      this.holderId = null
      this.napperId = null
      this.coldAnnounced = false
      this.noChallengerExpiries = 0
      return []
    }
    if (this.holderId !== null && !pets.some(p => p.id === this.holderId)) this.holderId = null
    if (this.napperId !== null && !pets.some(p => p.id === this.napperId)) this.napperId = null

    if (this.holderId === null) {
      const events: SpotlightEvent[] = []
      const eager = pets.filter(p => p.passion >= EAGER_PASSION)
      if (eager.length > 0) {
        // 好戏恢复（G9）：热情者到场即上台
        const candidate = eager.slice().sort((a, b) => a.arrivedAt - b.arrivedAt)[0]!
        this.holderId = candidate.id
        this.endsAt = now + this.durationOf(candidate)
        this.napperId = null
        this.coldAnnounced = false
        this.noChallengerExpiries = 0
        return [{ type: 'appoint', petId: candidate.id }]
      }
      // 冷场：淡定者占台打盹（G9）
      const calm = pets.filter(p => p.passion >= CALM_MIN && p.passion < EAGER_PASSION)
      const napper = calm.slice().sort((a, b) => a.arrivedAt - b.arrivedAt)[0]
      if (!this.coldAnnounced) {
        this.coldAnnounced = true
        events.push({ type: 'vacant' })
      }
      if (napper !== undefined && this.napperId !== napper.id) {
        this.napperId = napper.id
        events.push({ type: 'nap', petId: napper.id })
      }
      return events
    }

    if (now < this.endsAt) return []
    const holder = pets.find(p => p.id === this.holderId) ?? null
    // 加演（H5）：全院高心情时挑战者池扩至淡定者；高冷永不参与
    const minPassion = options.calmChallenge === true ? CALM_MIN : EAGER_PASSION
    const challengers = pets.filter(p => p.passion >= minPassion && p.id !== this.holderId)
    if (challengers.length === 0) {
      this.noChallengerExpiries++
      // holder 理论不可为 null（holderId 已在场校验）；类型兜底回退基准时长
      this.endsAt = now + (holder !== null ? this.durationOf(holder) : this.opts.rotateMs)
      if (this.noChallengerExpiries % 2 === 0) {
        return [{ type: 'excursion', petId: this.holderId }]
      }
      return []
    }
    const challenger = challengers[Math.floor(Math.random() * challengers.length)]!
    return [this.replaceHolder(challenger, now)]
  }

  /** 点名（G7）：任意宠物立即上台顶替现任；非聚光灯档返回空。 */
  summon(petId: string, pets: readonly SpotlightPet[], tier: Tier, now: number): readonly SpotlightEvent[] {
    if (tier !== 'spotlight') return []
    const pet = pets.find(p => p.id === petId)
    if (pet === undefined) return []
    if (petId === this.holderId) return []
    this.napperId = null
    this.coldAnnounced = false
    return [this.replaceHolder(pet, now)]
  }

  private replaceHolder(next: SpotlightPet, now: number): SpotlightEvent {
    const previousHolderId = this.holderId
    this.holderId = next.id
    this.endsAt = now + this.durationOf(next)
    this.noChallengerExpiries = 0
    return { type: 'challenge', challengerId: next.id, previousHolderId: previousHolderId ?? next.id }
  }

  private durationOf(pet: SpotlightPet): number {
    return pet.locked ? this.opts.rotateLockedMs : this.opts.rotateMs
  }
}
