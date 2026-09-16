import type { Personality } from '../../core/types.ts'

export type ActionName =
  | 'idle' | 'walk' | 'jump' | 'roll' | 'sit' | 'sleep' | 'wave' | 'flatten'
  | 'spin' | 'tail' | 'stretch' | 'lick' | 'tilt' | 'squish' | 'yawn' | 'twitch'
  | 'eat' | 'drink'

/** 可被日常调度选中的动作（wave/flatten 由引擎指令触发，不参与随机）。 */
export type ScheduledAction =
  | 'idle' | 'walk' | 'jump' | 'roll' | 'sit' | 'sleep'
  | 'spin' | 'tail' | 'stretch' | 'lick' | 'tilt'

/** 动作时长（ms，[min, max]；walk 由移动驱动，时长无效）。 */
export const ACTION_DURATION: Record<ActionName, readonly [number, number]> = {
  idle: [1600, 3200],
  walk: [0, 0],
  jump: [900, 900],
  roll: [1100, 1100],
  sit: [4000, 8000],
  sleep: [8000, 14000],
  wave: [1600, 1600],
  flatten: [600, 600],
  spin: [1000, 1000],
  tail: [1400, 1400],
  stretch: [1600, 1600],
  lick: [1200, 1200],
  tilt: [900, 900],
  squish: [2200, 2200],
  yawn: [1200, 1200],
  twitch: [500, 500],
  eat: [1600, 1600],
  drink: [700, 700],
}

/** 日常动作的性格权重（需求 §3.7：热情者更爱蹦跳转圈，高冷更常舔毛打盹）。 */
export const ACTION_WEIGHTS: Record<ScheduledAction, Record<Personality, number>> = {
  idle: { eager: 2, calm: 3, aloof: 3 },
  walk: { eager: 4, calm: 3, aloof: 2 },
  jump: { eager: 4, calm: 2, aloof: 1 },
  roll: { eager: 3, calm: 2, aloof: 1 },
  sit: { eager: 1, calm: 3, aloof: 3 },
  sleep: { eager: 1, calm: 2, aloof: 4 },
  spin: { eager: 3, calm: 1, aloof: 1 },
  tail: { eager: 3, calm: 1, aloof: 0 },
  stretch: { eager: 2, calm: 2, aloof: 2 },
  lick: { eager: 1, calm: 2, aloof: 3 },
  tilt: { eager: 2, calm: 2, aloof: 1 },
}

/** 卖萌类动作（心情加权的对象，H3）。 */
const CUTE_ACTIONS = new Set<ScheduledAction>(['jump', 'roll', 'spin', 'tail', 'stretch', 'lick', 'tilt'])

/** 按性格 × 心情 × 昼夜加权随机挑日常动作（视觉随机，Math.random，非领域推导）。 */
export function pickAction(personality: Personality, mood = 60, night = false): ScheduledAction {
  const entries = Object.keys(ACTION_WEIGHTS) as ScheduledAction[]
  const weights = entries.map(key => {
    let weight = ACTION_WEIGHTS[key][personality]
    if (mood >= 80) weight *= key === 'sleep' ? 0.5 : CUTE_ACTIONS.has(key) ? 1.6 : 1
    else if (mood < 40) weight *= key === 'sleep' ? 2 : CUTE_ACTIONS.has(key) ? 0.6 : 1
    if (night && key === 'sleep') weight *= 1.5
    return weight
  })
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = Math.random() * total
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return entries[i]!
  }
  return 'idle'
}

/** 场景样式，幂等注入单个 style 标签（V6，对齐 DSH 的 data-plugin 约定）。 */
export function ensureStageStyles(): void {
  if (document.querySelector('style[data-plugin="dsh-plugin-fluffy-yard"]') !== null) return
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-plugin-fluffy-yard'
  style.textContent = STAGE_CSS
  document.head.appendChild(style)
}

const STAGE_CSS = `
.py-stage { position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none; background: #dcecf5; font-family: system-ui, sans-serif; }
.py-stage > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.py-sky { fill: #dcecf5; }
.py-grass { fill: #c4e0b8; }
.py-pet { cursor: pointer; transition: opacity 0.6s ease; }
.py-name { font-size: 11px; fill: #5a4f44; text-anchor: middle; paint-order: stroke; stroke: rgba(255,255,255,0.8); stroke-width: 3px; }
.py-badge { font-size: 13px; text-anchor: middle; }
.py-zzz { font-size: 12px; font-weight: 600; fill: #7a8fa8; display: none; }
.py-pet.is-sleeping .py-zzz { display: block; animation: py-zzz 2.4s linear infinite; }
.py-bubble { opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease; transform: translateY(4px); pointer-events: none; }
.py-bubble.show { opacity: 1; transform: translateY(0); }
.py-bubble-bg { fill: #fffdf8; stroke: #d8c9b8; stroke-width: 1; }
.py-bubble-text { font-size: 12px; fill: #4a3f35; text-anchor: middle; }
.py-action { transform-box: fill-box; transform-origin: 50% 100%; }
.py-idle { animation: py-idle 2.6s ease-in-out infinite; }
.py-walk { animation: py-walk 0.4s ease-in-out infinite; }
.py-jump { animation: py-jump 0.9s ease-in-out; }
.py-roll { animation: py-roll 1.1s ease-in-out; }
.py-sit { animation: py-sit 0.35s ease-out forwards; }
.py-sleep { animation: py-sleep 3s ease-in-out infinite; }
.py-wave { animation: py-wave 0.8s ease-in-out 2; }
.py-flatten { animation: py-flatten 0.4s ease-out forwards; }
.py-spin { animation: py-spin 1s linear; }
.py-tail { animation: py-tail 0.35s ease-in-out 4; }
.py-stretch { animation: py-stretch 1.6s ease-in-out; }
.py-lick { animation: py-lick 1.2s ease-in-out; }
.py-tilt { animation: py-tilt 0.9s ease-in-out; }
.py-squish { animation: py-squish 1.1s ease-in-out infinite; }
.py-yawn { animation: py-yawn 1.2s ease-in-out; }
.py-twitch { animation: py-twitch 0.5s ease-in-out; }
@keyframes py-idle { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.97); } }
@keyframes py-walk { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes py-jump { 0%, 100% { transform: translateY(0); } 35% { transform: translateY(-34px); } 45% { transform: translateY(-28px); } 60% { transform: translateY(-38px); } }
@keyframes py-roll { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
@keyframes py-sit { from { transform: scaleY(1); } to { transform: scaleY(0.86) translateY(4px); } }
@keyframes py-sleep { 0%, 100% { transform: scaleY(0.9); } 50% { transform: scaleY(0.85); } }
@keyframes py-wave { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
@keyframes py-flatten { from { transform: scale(1, 1); } to { transform: scale(1.5, 0.3); } }
@keyframes py-spin { to { transform: rotate(360deg); } }
@keyframes py-tail { 0%, 100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }
@keyframes py-stretch { 0%, 100% { transform: scale(1, 1); } 45% { transform: scale(1.16, 0.82); } }
@keyframes py-lick { 0%, 100% { transform: translateY(0) rotate(0deg); } 40% { transform: translateY(3px) rotate(-6deg); } 70% { transform: translateY(1px) rotate(4deg); } }
@keyframes py-tilt { 0%, 100% { transform: rotate(0deg); } 45% { transform: rotate(-14deg); } }
@keyframes py-squish { 0%, 100% { transform: scale(1.35, 0.55); } 50% { transform: scale(1.22, 0.63); } }
@keyframes py-yawn { 0%, 100% { transform: scale(1); } 45% { transform: scale(1.06, 0.9) translateY(2px); } }
@keyframes py-twitch { 0%, 100% { transform: rotate(0deg); } 30% { transform: rotate(3deg); } 60% { transform: rotate(-3deg); } }
@keyframes py-zzz { 0% { opacity: 0; transform: translate(0, 0); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(10px, -20px); } }
.py-hud { position: absolute; top: 8px; left: 10px; padding: 3px 10px; border-radius: 999px; background: rgba(255,253,248,0.85); border: 1px solid #d8c9b8; color: #6b5b4d; font-size: 12px; pointer-events: none; z-index: 5; }
.py-toolbar { position: absolute; top: 8px; right: 8px; z-index: 8; display: flex; gap: 6px; }
.py-toolbar button { width: 28px; height: 28px; border-radius: 8px; border: 1px solid #c9b8a5; background: rgba(255,253,248,0.9); cursor: pointer; font-size: 14px; }
.py-toolbar button:hover { background: #fff; }
.py-panel { position: absolute; top: 44px; right: 8px; z-index: 9; width: 264px; max-height: 72%; overflow: auto; background: #fffdf8; border: 1px solid #d8c9b8; border-radius: 12px; padding: 12px; font-size: 13px; color: #4a3f35; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.py-panel h3 { margin: 8px 0 6px; font-size: 14px; }
.py-panel h3:first-of-type { margin-top: 0; }
.py-panel .row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; gap: 6px; }
.py-panel .log { color: #8a7a66; font-size: 12px; padding: 1px 0; }
.py-panel button { font-size: 13px; padding: 3px 10px; border-radius: 7px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-panel input[type='number'] { width: 72px; padding: 2px 4px; border: 1px solid #c9b8a5; border-radius: 6px; font-size: 13px; }
.py-panel label.row { cursor: pointer; }
.py-panel .arch-row { display: flex; align-items: center; gap: 8px; border: 1px solid #e5d9c9; border-radius: 8px; background: #fff; padding: 4px 6px; margin: 3px 0; cursor: pointer; }
.py-close { position: absolute; top: 6px; right: 8px; border: none; background: none; cursor: pointer; font-size: 14px; color: #8a7a66; }
.py-avatarbar { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 7; display: flex; gap: 8px; }
.py-avatar { position: relative; width: 44px; height: 44px; border-radius: 50%; border: 2px solid #d8c9b8; background: #fffdf8; cursor: pointer; padding: 0; overflow: hidden; }
.py-avatar:hover { border-color: #e8964f; }
.py-avatar.holder-ring { border-color: #e8b93c; }
.py-avatar svg { width: 100%; height: 100%; display: block; }
.py-avatar .mark { position: absolute; right: -1px; top: -3px; font-size: 13px; }
.py-avatar-more { position: absolute; right: -2px; bottom: -2px; width: 17px; height: 17px; border-radius: 50%; border: 1px solid #c9b8a5; background: #fffdf8; font-size: 10px; line-height: 1; cursor: pointer; padding: 0; color: #6b5b4d; }
.py-menu { position: absolute; z-index: 20; background: #fffdf8; border: 1px solid #d8c9b8; border-radius: 10px; padding: 6px; display: flex; flex-direction: column; gap: 4px; min-width: 122px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
.py-menu button { border: 1px solid #e5d9c9; background: #fff; border-radius: 7px; padding: 5px 10px; font-size: 13px; cursor: pointer; color: #4a3f35; text-align: left; }
.py-menu button:hover { background: #f7efe3; }
.py-menu input { font-size: 13px; padding: 4px 6px; border: 1px solid #c9b8a5; border-radius: 6px; width: 110px; }
.py-toast { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); z-index: 30; background: rgba(74,63,53,0.92); color: #fff; border-radius: 999px; padding: 5px 14px; font-size: 12px; pointer-events: none; white-space: nowrap; animation: py-toast-in 0.25s ease; }
@keyframes py-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(-6px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
.py-card-modal { position: absolute; inset: 0; z-index: 40; background: rgba(58,46,38,0.35); display: flex; align-items: center; justify-content: center; }
.py-card-modal .inner { background: #fffdf8; border-radius: 14px; padding: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.25); text-align: center; }
.py-card-modal svg { width: min(378px, 80vw); height: auto; border-radius: 10px; display: block; margin: 0 auto; }
.py-card-modal .acts { margin-top: 8px; display: flex; gap: 8px; justify-content: center; }
.py-card-modal button { font-size: 13px; padding: 5px 14px; border-radius: 8px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-debug { position: absolute; top: 8px; right: 78px; z-index: 10; background: #fffdf8; border: 1px solid #d8c9b8; border-radius: 10px; padding: 8px; font-size: 12px; color: #4a3f35; display: flex; flex-direction: column; gap: 6px; max-width: 250px; }
.py-debug-title { font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
.py-debug-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.py-debug button { font-size: 12px; padding: 3px 8px; border-radius: 6px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-debug input[type='range'] { width: 80px; }
.py-debug input[type='number'] { width: 52px; }
.py-debug-gear { position: absolute; left: 8px; bottom: 8px; z-index: 10; width: 26px; height: 26px; border-radius: 50%; border: 1px solid #c9b8a5; background: rgba(255,253,248,0.9); cursor: pointer; font-size: 13px; }
.py-rain { position: absolute; inset: 0; z-index: 4; pointer-events: none; background: repeating-linear-gradient(75deg, transparent 0 14px, rgba(160,190,220,0.35) 14px 15px, transparent 15px 26px); animation: py-rain 0.5s linear infinite; }
@keyframes py-rain { from { background-position: 0 0; } to { background-position: -60px 120px; } }
.py-postcard { position: absolute; inset: 0; z-index: 45; background: rgba(58,46,38,0.35); display: flex; align-items: center; justify-content: center; }
.py-postcard .inner { background: #fffdf8; border-radius: 14px; padding: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.25); text-align: center; max-width: 320px; }
.py-postcard svg { width: 120px; height: 132px; display: block; margin: 0 auto; }
.py-postcard .text { font-size: 14px; color: #4a3f35; margin: 10px 0; line-height: 1.6; }
.py-postcard button { font-size: 13px; padding: 5px 14px; border-radius: 8px; border: 1px solid #c9b8a5; background: #fff; color: #4a3f35; cursor: pointer; }
.py-achv-done { color: #4a3f35; }
.py-achv-todo { color: #b8a894; }
.py-panel .achv-row { display: flex; justify-content: space-between; padding: 3px 0; }
.py-gallery { position: absolute; inset: 0; z-index: 50; background: rgba(250,246,240,0.97); overflow: auto; padding: 12px; font-size: 13px; color: #4a3f35; }
.py-gallery-bar { position: sticky; top: 0; background: #fffdf8; border-bottom: 1px solid #e5d9c9; padding: 6px 8px; display: flex; gap: 14px; align-items: center; z-index: 1; }
.py-gallery-bar button { border: 1px solid #c9b8a5; background: #fff; border-radius: 7px; padding: 3px 10px; cursor: pointer; color: #4a3f35; }
.py-gallery h3 { margin: 14px 0 6px; }
.py-gallery-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.py-gallery-cell { margin: 0; width: 96px; text-align: center; }
.py-gallery-cell svg { width: 96px; height: 104px; background: #fff; border: 1px solid #eee2d2; border-radius: 8px; }
.py-gallery-cell figcaption { font-size: 11px; color: #8a7a66; margin-top: 2px; }
.py-eat { animation: py-eat 1.6s ease-in-out infinite; }
.py-drink { animation: py-drink 0.7s ease-in-out infinite; }
@keyframes py-eat { 0%, 100% { transform: translateY(0) rotate(0deg); } 40%, 60% { transform: translateY(4px) rotate(10deg); } }
@keyframes py-drink { 0%, 100% { transform: translateY(0) rotate(0deg); } 45% { transform: translateY(3px) rotate(4deg); } }
.py-particle { pointer-events: none; animation: py-float var(--pd, 1100ms) ease-out forwards; }
@keyframes py-float { from { opacity: 1; transform: translate(0, 0) scale(1); } to { opacity: 0; transform: translate(var(--dx, 0px), -46px) scale(0.5); } }
.py-ball { transition: transform 0.55s ease; }
.py-ball-out { transition: opacity 0.6s ease; opacity: 0; }
.py-prop-bowl { cursor: pointer; }
.py-stage-resize { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize; z-index: 12; background: linear-gradient(135deg, transparent 0 52%, rgba(138,111,77,0.55) 52%); border-bottom-right-radius: 6px; touch-action: none; }
.py-debug-hint { color: #a89880; font-size: 11px; }
`
