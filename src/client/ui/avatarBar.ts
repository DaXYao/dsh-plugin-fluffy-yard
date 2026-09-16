import type { Pet } from '../../core/types.ts'
import type { ArtStyle } from '../render/styles.ts'

export interface AvatarBarHandle {
  readonly refresh: (pets: readonly Pet[], holderId: string | null) => void
  readonly dispose: () => void
}

/**
 * 底部头像条：点头像 = 点名上台（controller 决定非聚光灯档的回退），
 * 点 ⋯ = 打开该宠物互动菜单（需求 §3.7 交互保障）。
 */
export function mountAvatarBar(
  stage: HTMLElement,
  getStyle: () => ArtStyle,
  onSummon: (petId: string) => void,
  onMenu: (petId: string) => void,
): AvatarBarHandle {
  const bar = document.createElement('div')
  bar.className = 'py-avatarbar'
  stage.appendChild(bar)
  return {
    refresh(pets, holderId) {
      bar.innerHTML = ''
      for (const pet of pets) {
        const style = getStyle()
        const box = style.portraitBox
        const wrap = document.createElement('div')
        wrap.style.position = 'relative'
        const button = document.createElement('button')
        button.type = 'button'
        button.className = pet.id === holderId ? 'py-avatar holder-ring' : 'py-avatar'
        button.title = `${pet.name}（点头像上台）`
        const mark = pet.locked ? (pet.id === holderId ? '👑' : '🔒') : ''
        button.innerHTML = `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}">`
          + `${style.render(pet.traits, `av-${pet.id}`)}</svg>`
          + `<span class="mark">${mark}</span>`
        button.addEventListener('click', () => onSummon(pet.id))
        const more = document.createElement('button')
        more.type = 'button'
        more.className = 'py-avatar-more'
        more.textContent = '⋯'
        more.title = `${pet.name} 的互动菜单`
        more.addEventListener('click', event => {
          event.stopPropagation()
          onMenu(pet.id)
        })
        wrap.append(button, more)
        bar.appendChild(wrap)
      }
    },
    dispose() {
      bar.remove()
    },
  }
}
