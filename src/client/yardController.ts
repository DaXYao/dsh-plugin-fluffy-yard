import { MAX_PETS, SAVE_DEBOUNCE_MS } from '../config.ts'
import { createInitialDoc, fromDoc, toDoc } from '../core/doc.ts'
import {
  dueSpawnCount, formatPetId, isSpawnPaused, maxPetsOf, renamePet, setLocked,
  spawnIntervalMs, spawnPet, type SpawnResult,
} from '../core/spawn.ts'
import { recordOpen } from '../core/stats.ts'
import { derivePet } from '../core/traits.ts'
import { evaluateAchievements, initialFlags } from '../core/achievements.ts'
import { MOOD_ZH, averageMood, clampMood, decayMood, moodBandOf, petMood, withMoodDelta } from '../core/mood.ts'
import { postcardEligible, postcardTextFor } from '../core/postcard.ts'
import type { ArtStyleId, Pet, Yard } from '../core/types.ts'
import { mountDebugPanel, type DebugHandle } from './debug.ts'
import { loadYard, saveYard } from './persist.ts'
import { downloadSvgAsPng, triggerDownload } from './pngExport.ts'
import { cardFileName, cardSvg } from './render/cardRender.ts'
import { decoratePhotoSvg } from './render/photoExport.ts'
import { styleOf } from './render/styles.ts'
import { StageEngine } from './stage/engine.ts'
import { TIER_LABEL_ZH } from './stage/tiers.ts'
import { mountAvatarBar, type AvatarBarHandle } from './ui/avatarBar.ts'
import { closeInteractMenu, openInteractMenu } from './ui/interactMenu.ts'
import {
  closeCardModal, mountPanels, openCardModal, openPostcardModal, type PanelsHandle,
} from './ui/panels.ts'
import { closeGallery, openGallery } from './ui/gallery.ts'
import { showToast } from './ui/toast.ts'

const STORAGE_KEY = 'dsh-plugin-fluffy-yard/state'
const MOOD_VISIT_GAIN = 12
const MOOD_PHOTO_GAIN = 15
const PHASE_KEY = 'dsh-plugin-fluffy-yard/phase'
type PhaseMode = 'auto' | 'day' | 'dusk' | 'night'
const PHASE_ORDER: readonly PhaseMode[] = ['auto', 'day', 'dusk', 'night']
const PHASE_ICON: Record<PhaseMode, string> = { auto: '🌓', day: '☀️', dusk: '🌆', night: '🌙' }
const PHASE_TITLE: Record<PhaseMode, string> = {
  auto: '昼夜：自动（跟随时钟）', day: '昼夜：白天（点击切换）', dusk: '昼夜：黄昏（点击切换）', night: '昼夜：夜晚（点击切换）',
}
const MOOD_EVENT_GAIN: Record<'meal' | 'drink' | 'cuddle', number> = { meal: 3, drink: 2, cuddle: 2 }
const RAIN_KEY = 'dsh-plugin-fluffy-yard/rain'

export class YardController {
  private yard: Yard | null = null
  private readonly engine: StageEngine
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private hudTimer: ReturnType<typeof setInterval> | null = null
  private debugHandle: DebugHandle | null = null
  private readonly pendingGreet = new Map<string, string>()
  private disposed = false
  private panels: PanelsHandle | null = null
  private avatarBar: AvatarBarHandle | null = null
  private pauseToasted = false
  private coldToasted = false
  private photoBusy = false
  private rainOn = false

  constructor(private readonly container: HTMLElement) {
    this.engine = new StageEngine(container, {
      onPetClick: petId => this.handlePetClick(petId),
      onPetEntered: petId => this.handlePetEntered(petId),
      onSpawnCheck: now => this.handleSpawnCheck(now),
      onTierChanged: () => this.refreshHud(),
      onHolderChanged: () => this.refreshUi(),
      onColdStart: () => {
        this.coldToastOnce()
        this.setFlag('sawCold', true)
      },
      onWitness: kind => this.setFlag(
        kind === 'challenge' ? 'sawChallenge' : kind === 'summon-aloof' ? 'summonedAloof' : 'photoSpotlight',
        true,
      ),
      onPropClick: kind => {
        if (kind === 'food') {
          this.engine.refillFood()
          showToast(this.engine.getStageEl(), '添了好吃的！')
        } else {
          showToast(this.engine.getStageEl(), '水碗是满的～')
        }
      },
      onPetEvent: (kind, petId) => this.moodBump(petId, MOOD_EVENT_GAIN[kind]),
    })
  }

  start(): void {
    const now = Date.now()
    let yard = loadYard(now)
    yard = { ...yard, stats: recordOpen(yard.stats, now) }
    // 心情：离线衰减 + 自然日首次探望全院 +12（H2）
    yard = { ...yard, pets: decayMood(yard.pets, now - (yard.lastActiveAt ?? yard.createdAt)) }
    yard = { ...yard, pets: withMoodDelta(yard.pets, MOOD_VISIT_GAIN) }
    yard = { ...yard, lastActiveAt: now }
    let offlinePetId: string | null = null
    if (dueSpawnCount(yard, now) > 0) {
      const result = spawnPet(yard, now)
      yard = result.yard
      if (result.pet !== null) offlinePetId = result.pet.id
    }
    this.yard = yard
    this.engine.start()
    this.engine.restyle(yard.settings.artStyle ?? 'geo')
    // UX-4：天气——手动偏好优先，未设置时 10% 随机雨
    const rainPref = localStorage.getItem(RAIN_KEY)
    this.rainOn = rainPref === '1' ? true : rainPref === '0' ? false : Math.random() < 0.1
    this.engine.setRain(this.rainOn)

    this.panels = mountPanels(this.container, {
      getYard: () => this.yard,
      onIntervalChange: min => this.applyInterval(min),
      onStyleChange: id => this.applyStyle(id),
      onPhoto: () => void this.takePhoto(),
      getStyle: () => styleOf(this.yard?.settings.artStyle ?? 'geo'),
      onArchiveCard: petId => this.openArchiveCard(petId),
      onPostcard: petId => this.openPostcard(petId),
      onPhaseCycle: () => this.cyclePhase(),
      onRainToggle: () => this.toggleRain(),
      onMaxPetsChange: n => this.applyMaxPets(n),
      onPanelOpen: () => this.debugHandle?.setVisible(false),
    })
    const stage = this.engine.getStageEl()
    this.avatarBar = mountAvatarBar(
      stage,
      () => styleOf(this.yard?.settings.artStyle ?? 'geo'),
      petId => this.summonPet(petId),
      petId => this.openMenuForPet(petId),
    )

    const initialPets = offlinePetId === null
      ? yard.pets
      : yard.pets.filter(p => p.id !== offlinePetId)
    this.engine.syncPets(initialPets, { initial: true })
    if (offlinePetId !== null) {
      this.pendingGreet.set(offlinePetId, '它在门口等你很久啦！')
      this.engine.syncPets(yard.pets)
    }
    this.debugHandle = mountDebugPanel(this.container, this, this.engine, { onOpen: () => this.panels?.closeAll() })
    document.addEventListener('visibilitychange', this.onVisibility)
    this.applyStoredPhase()
    this.panels?.setRainLabel(this.rainOn)
    this.hudTimer = setInterval(() => this.refreshHud(), 1000)
    this.refreshUi()
    this.checkNewPostcards()
    this.evaluate()
    this.scheduleSave()
  }

  dispose(): void {
    this.disposed = true
    this.flushSave()
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.hudTimer !== null) clearInterval(this.hudTimer)
    this.debugHandle?.dispose()
    const stage = this.engine.getStageEl()
    closeInteractMenu(stage)
    closeCardModal(stage)
    closeGallery(stage)
    this.avatarBar?.dispose()
    this.panels?.dispose()
    this.engine.dispose()
  }

  private onVisibility = (): void => {
    if (this.disposed || this.yard === null) return
    if (document.visibilityState === 'visible') {
      const now = Date.now()
      let yard = { ...this.yard, stats: recordOpen(this.yard.stats, now) }
      yard = { ...yard, pets: decayMood(yard.pets, now - (yard.lastActiveAt ?? yard.createdAt)) }
      yard = { ...yard, pets: withMoodDelta(yard.pets, MOOD_VISIT_GAIN), lastActiveAt: now }
      if (dueSpawnCount(yard, now) > 0) {
        const result = spawnPet(yard, now)
        yard = result.yard
        if (result.pet !== null) this.pendingGreet.set(result.pet.id, '它在门口等你很久啦！')
      }
      this.yard = yard
      this.engine.syncPets(yard.pets)
      this.scheduleSave()
      this.refreshUi()
      this.checkNewPostcards()
      this.evaluate()
    } else {
      this.yard = this.yard === null ? null : { ...this.yard, lastActiveAt: Date.now() }
      this.flushSave()
    }
  }

  // ---- 成就（H8/H11） ----

  /** 置目睹旗标并即时评估。 */
  private setFlag(key: 'sawChallenge' | 'sawCold' | 'summonedAloof' | 'photoSpotlight' | 'lockedOnce' | 'lockedFull', value: boolean): void {
    if (this.yard === null) return
    // initialFlags 兜底：stats.flags 为可选字段，展开后需满足完整 AchievementFlags
    const flags = { ...initialFlags(), ...this.yard.stats.flags, [key]: value }
    this.yard = { ...this.yard, stats: { ...this.yard.stats, flags } }
    this.evaluate()
  }

  private evaluate(): void {
    if (this.yard === null) return
    const newly = evaluateAchievements(this.yard)
    if (newly.length === 0) return
    this.yard = {
      ...this.yard,
      stats: {
        ...this.yard.stats,
        achievements: [...(this.yard.stats.achievements ?? []), ...newly.map(d => d.id)],
      },
    }
    for (const def of newly) showToast(this.engine.getStageEl(), `🏆 解锁成就：${def.titleZh}`)
    this.scheduleSave()
    this.refreshUi()
  }

  // ---- 明信片（H7） ----

  private checkNewPostcards(): void {
    if (this.yard === null) return
    const seen = new Set(this.yard.postcardSeen ?? [])
    const fresh = this.yard.archive.filter(e => postcardEligible(e.leftAt, Date.now()) && !seen.has(e.id))
    if (fresh.length === 0) return
    for (const e of fresh) seen.add(e.id)
    this.yard = { ...this.yard, postcardSeen: [...seen] }
    showToast(this.engine.getStageEl(), `收到 ${fresh[fresh.length - 1]!.name} 寄来的明信片 📮`)
    this.scheduleSave()
  }

  private openPostcard(petId: string): void {
    if (this.yard === null) return
    const entry = this.yard.archive.find(e => e.id === petId)
    if (entry === undefined || !postcardEligible(entry.leftAt, Date.now())) return
    const style = styleOf(this.yard.settings.artStyle ?? 'geo')
    const box = style.portraitBox
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${style.render(entry.traits, `pc-${entry.id}`)}</svg>`
    openPostcardModal(this.engine.getStageEl(), svg, postcardTextFor(entry.id, entry.name))
  }

  private handleSpawnCheck(now: number): void {
    if (this.yard === null || dueSpawnCount(this.yard, now) === 0) return
    const result = spawnPet(this.yard, now)
    if (result.pet !== null) this.pendingGreet.set(result.pet.id, `你好呀，我是${result.pet.name}！`)
    this.applyResult(result)
  }

  private applyResult(result: SpawnResult): void {
    this.yard = result.yard
    this.engine.syncPets(result.yard.pets)
    if (result.left !== null) this.engine.showBubble(result.left.id, `${result.left.name} 再见啦…`, 2600)
    this.scheduleSave()
    this.refreshUi()
    this.evaluate()
  }

  private handlePetEntered(petId: string): void {
    const greet = this.pendingGreet.get(petId)
    this.pendingGreet.delete(petId)
    this.engine.showBubble(petId, greet ?? '你好呀！')
  }

  private handlePetClick(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    this.engine.poke(petId)
    const pos0 = this.engine.getPetPos(petId)
    if (pos0 !== null) this.engine.spawnParticles(pos0.x, pos0.y + 60, 'heart', 3)
    this.engine.showBubble(petId, pet.traits.species === 'cat' ? '喵～' : '汪！', 1500)
    const pos = this.engine.getPetPos(petId)
    if (pos !== null) this.openMenu(pet, pos)
  }

  private openMenuForPet(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    const pos = this.engine.getPetPos(petId)
    const size = this.engine.getStageSize()
    this.openMenu(pet, pos ?? { x: size.w / 2, y: size.h - 90 })
  }

  private openMenu(pet: Pet, anchor: { readonly x: number; readonly y: number }): void {
    const stage = this.engine.getStageEl()
    openInteractMenu(stage, { id: pet.id, name: pet.name, locked: pet.locked }, anchor, {
      onPet: id => {
        this.engine.performAction(id, 'stretch')
        this.engine.showBubble(id, '好舒服～', 1600)
        const pos = this.engine.getPetPos(id)
        if (pos !== null) this.engine.spawnParticles(pos.x, pos.y + 60, 'heart', 4)
      },
      onCard: id => this.openCard(id),
      onToggleLock: id => this.toggleLock(id),
      onRename: (id, name) => this.rename(id, name),
      onExport: id => this.exportCard(id),
    })
  }

  /** 点名（G7）：非聚光灯档回退为打开菜单。 */
  private summonPet(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    if (this.engine.summon(petId)) {
      showToast(this.engine.getStageEl(), `点名 ${pet.name} 上台！`)
    } else {
      this.openMenuForPet(petId)
    }
  }

  private toggleLock(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    this.yard = setLocked(this.yard, petId, !pet.locked)
    const pets = this.yard.pets
    if (pets.some(p => p.locked)) this.setFlag('lockedOnce', true)
    // 五口之家：5 只及以上全部锁定（上限自定义后语义不变）
    if (pets.length >= 5 && pets.every(p => p.locked)) this.setFlag('lockedFull', true)
    this.engine.syncPets(pets)
    this.scheduleSave()
    showToast(this.engine.getStageEl(), pet.locked ? `${pet.name} 已解锁` : `${pet.name} 已锁定`)
    this.refreshUi()
  }

  private rename(petId: string, name: string): void {
    if (this.yard === null) return
    const next = renamePet(this.yard, petId, name)
    if (next === this.yard) return
    this.yard = next
    this.engine.syncPets(this.yard.pets)
    this.scheduleSave()
    this.refreshUi()
    showToast(this.engine.getStageEl(), `已改名为 ${name}`)
  }

  private openCard(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    if (pet === undefined) return
    openCardModal(this.engine.getStageEl(), cardSvg(pet, this.yard.settings.artStyle), () => this.exportCard(petId))
  }

  private exportCard(petId: string): void {
    if (this.yard === null) return
    const pet = this.yard.pets.find(p => p.id === petId)
    const stage = this.engine.getStageEl()
    if (pet === undefined) return
    downloadSvgAsPng(cardSvg(pet, this.yard.settings.artStyle), cardFileName(pet))
      .then(() => showToast(stage, '档案卡已导出'))
      .catch(err => showToast(stage, `导出失败：${String(err)}`))
  }

  private openArchiveCard(petId: string): void {
    if (this.yard === null) return
    const entry = this.yard.archive.find(e => e.id === petId)
    if (entry === undefined) return
    const petView: Pet = { ...entry, locked: false }
    const stage = this.engine.getStageEl()
    openCardModal(stage, cardSvg(petView, this.yard.settings.artStyle, { leftAt: entry.leftAt }), () => {
      downloadSvgAsPng(cardSvg(petView, this.yard?.settings.artStyle, { leftAt: entry.leftAt }), cardFileName(petView))
        .then(() => showToast(stage, '档案卡已导出'))
        .catch(err => showToast(stage, `导出失败：${String(err)}`))
    })
  }

  /** 合影（G11/G14 + H2 心情 +15）。 */
  private async takePhoto(): Promise<void> {
    if (this.yard === null || this.photoBusy) return
    if (this.yard.pets.length === 0) {
      showToast(this.engine.getStageEl(), '还没有宝贝可以合影')
      return
    }
    this.photoBusy = true
    const stage = this.engine.getStageEl()
    try {
      const shot = await this.engine.photoSession()
      if (shot === null) return
      const dateText = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')
      const visitText = `第 ${this.yard.stats.visitCount} 次探望`
      const svg = decoratePhotoSvg(shot.svg, shot.w, shot.h, { dateText, visitText })
      await downloadSvgAsPng(svg, `合影_${dateText}_第${this.yard.stats.visitCount}次探望.png`, shot.w, shot.h)
      this.yard = {
        ...this.yard,
        pets: withMoodDelta(this.yard.pets, MOOD_PHOTO_GAIN),
        stats: { ...this.yard.stats, photosTaken: this.yard.stats.photosTaken + 1 },
      }
      this.engine.syncPets(this.yard.pets)
      this.scheduleSave()
      this.refreshUi()
      showToast(stage, '合影已导出')
      this.evaluate()
    } catch (err) {
      showToast(stage, `合影失败：${String(err)}`)
    } finally {
      this.photoBusy = false
    }
  }

  private coldToastOnce(): void {
    if (this.coldToasted) return
    this.coldToasted = true
    showToast(this.engine.getStageEl(), '今天大家都有点懒得营业……')
  }

  private applyInterval(min: number): void {
    if (this.yard === null) return
    this.yard = { ...this.yard, settings: { ...this.yard.settings, spawnIntervalMin: min } }
    this.scheduleSave()
    this.refreshUi()
    showToast(this.engine.getStageEl(), `到访间隔已设为 ${min} 分钟`)
  }

  private applyStyle(id: ArtStyleId): void {
    if (this.yard === null) return
    this.yard = { ...this.yard, settings: { ...this.yard.settings, artStyle: id } }
    this.engine.restyle(id)
    this.scheduleSave()
    this.refreshUi()
    showToast(this.engine.getStageEl(), `已切换为「${styleOf(id).labelZh}」`)
  }

  /** 天气切换（UX-4）：晴/雨手动切换，偏好持久化。 */
  private toggleRain(): void {
    this.rainOn = !this.rainOn
    localStorage.setItem(RAIN_KEY, this.rainOn ? '1' : '0')
    this.engine.setRain(this.rainOn)
    this.panels?.setRainLabel(this.rainOn)
    showToast(this.engine.getStageEl(), this.rainOn ? '下雨了…' : '雨停了')
  }

  /** 在场上限（UX-3）：超出部分随自然淘汰回落。 */
  private applyMaxPets(n: number): void {
    if (this.yard === null) return
    this.yard = { ...this.yard, settings: { ...this.yard.settings, maxPets: n } }
    this.engine.syncPets(this.yard.pets)
    this.scheduleSave()
    this.refreshUi()
    showToast(this.engine.getStageEl(), `在场上限已设为 ${n} 只`)
  }

  /** 昼夜切换（F10）：循环 auto→day→dusk→night，localStorage 偏好。 */
  private cyclePhase(): void {
    const current = (localStorage.getItem(PHASE_KEY) as PhaseMode | null) ?? 'auto'
    const next = PHASE_ORDER[(PHASE_ORDER.indexOf(current) + 1) % PHASE_ORDER.length]!
    localStorage.setItem(PHASE_KEY, next)
    this.engine.setPhaseOverride(next === 'auto' ? null : next)
    this.panels?.setPhaseLabel(PHASE_ICON[next], PHASE_TITLE[next])
    const stage = this.engine.getStageEl()
    if (next === 'auto') showToast(stage, '昼夜跟随时钟')
    else showToast(stage, `切换到${next === 'day' ? '白天' : next === 'dusk' ? '黄昏' : '夜晚'}`)
  }

  private applyStoredPhase(): void {
    const mode = (localStorage.getItem(PHASE_KEY) as PhaseMode | null) ?? 'auto'
    if (mode !== 'auto') this.engine.setPhaseOverride(mode)
    this.panels?.setPhaseLabel(PHASE_ICON[mode], PHASE_TITLE[mode])
  }

  /** 单宠心情提升（F11：引擎事件 → domain）。 */
  private moodBump(petId: string, delta: number): void {
    if (this.yard === null) return
    const pets = this.yard.pets.map(p =>
      p.id === petId ? { ...p, mood: clampMood(petMood(p) + delta) } : p)
    this.yard = { ...this.yard, pets }
    this.scheduleSave()
    this.refreshHud()
  }

  // ---- debug 调参台 API ----

  forceSpawn(): void {
    if (this.yard === null) return
    const result = spawnPet(this.yard, Date.now())
    if (result.pet !== null) this.pendingGreet.set(result.pet.id, `你好呀，我是${result.pet.name}！`)
    this.applyResult(result)
  }

  timeTravel(): void {
    if (this.yard === null) return
    this.yard = { ...this.yard, lastSpawnAt: this.yard.lastSpawnAt - spawnIntervalMs(this.yard) }
    this.handleSpawnCheck(Date.now())
    this.scheduleSave()
    this.refreshHud()
  }

  loadDemoArchive(): void {
    const now = Date.now()
    const max = this.yard?.settings.maxPets ?? MAX_PETS
    const base = createInitialDoc(now)
    let yard = fromDoc({ ...base, settings: { ...base.settings, maxPets: max } })
    for (let i = 0; i < max; i++) yard = spawnPet(yard, now - (max - i) * 60_000).yard
    this.yard = yard
    this.engine.syncPets(yard.pets)
    this.scheduleSave()
    this.refreshUi()
    this.evaluate()
  }

  loadColdArchive(): void {
    const now = Date.now()
    const yard = fromDoc(createInitialDoc(now))
    const used = new Set<string>()
    const pets: Pet[] = []
    let counter = 1
    while (pets.length < MAX_PETS && counter < 500) {
      const id = formatPetId(counter)
      const derived = derivePet(id, used, 1)
      if (derived.personality === 'aloof' && !used.has(derived.comboKey)) {
        used.add(derived.comboKey)
        pets.push({
          id, name: derived.defaultName, traits: derived.traits, passion: derived.passion,
          arrivedAt: now - (MAX_PETS - pets.length) * 60_000, locked: false, cycle: 1,
        })
      }
      counter++
    }
    this.yard = { ...yard, pets, idCounter: counter, usedCombos: used, stats: { ...yard.stats, metTotal: pets.length } }
    this.engine.syncPets(pets)
    this.scheduleSave()
    this.refreshUi()
    this.evaluate()
  }

  resetArchive(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    localStorage.removeItem(STORAGE_KEY)
    location.reload()
  }

  /** 立绘画廊（美术 QA，A11）。 */
  openGallery(): void {
    openGallery(this.engine.getStageEl())
  }

  snapshotState(): void {
    if (this.yard === null) return
    const json = JSON.stringify(toDoc(this.yard), null, 2)
    triggerDownload(new Blob([json], { type: 'application/json' }), `pet-yard-state-${Date.now()}.json`)
  }

  getYard(): Yard | null {
    return this.yard
  }

  private refreshUi(): void {
    if (this.yard === null) return
    this.avatarBar?.refresh(this.yard.pets, this.engine.getHolderId())
    this.panels?.refresh()
    this.refreshHud()
    this.checkPauseToast()
  }

  private checkPauseToast(): void {
    if (this.yard === null) return
    if (isSpawnPaused(this.yard)) {
      if (!this.pauseToasted) {
        this.pauseToasted = true
        showToast(this.engine.getStageEl(), '小院已满，住满都是你锁定的宝贝')
      }
    } else {
      this.pauseToasted = false
    }
  }

  private refreshHud(): void {
    if (this.yard === null) return
    const remaining = Math.max(0, this.yard.lastSpawnAt + spawnIntervalMs(this.yard) - Date.now())
    const mm = Math.floor(remaining / 60_000)
    const ss = Math.floor((remaining % 60_000) / 1000)
    const paused = isSpawnPaused(this.yard) ? ' · 全锁定暂停中' : ''
    const avg = averageMood(this.yard.pets)
    this.engine.setHudText(
      `${TIER_LABEL_ZH[this.engine.getTier()]} · 在场 ${this.yard.pets.length}/${maxPetsOf(this.yard)} · 已相遇 ${this.yard.stats.metTotal}`
      + ` · 心情 ${Math.round(avg)}${MOOD_ZH[moodBandOf(avg)]} · 下次到访 ${mm}:${String(ss).padStart(2, '0')}${paused}`,
    )
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      if (this.yard !== null) saveYard(this.yard)
    }, SAVE_DEBOUNCE_MS)
  }

  private flushSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (this.yard !== null) saveYard(this.yard)
  }
}
