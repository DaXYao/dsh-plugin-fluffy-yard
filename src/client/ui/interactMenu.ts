export interface MenuPetInfo {
  readonly id: string
  readonly name: string
  readonly locked: boolean
}

export interface InteractMenuHandlers {
  readonly onPet: (petId: string) => void
  readonly onCard: (petId: string) => void
  readonly onToggleLock: (petId: string) => void
  readonly onRename: (petId: string, name: string) => void
  readonly onExport: (petId: string) => void
}

export interface MenuAnchor {
  readonly x: number
  readonly y: number
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 互动菜单（M4）：锚点为舞台坐标，菜单置于锚点上方并钳制不出界；
 * 同一时刻至多一个；空白点击 / Esc 关闭。
 */
export function openInteractMenu(
  stage: HTMLElement,
  pet: MenuPetInfo,
  anchor: MenuAnchor,
  handlers: InteractMenuHandlers,
): void {
  closeInteractMenu(stage)
  const menu = document.createElement('div')
  menu.className = 'py-menu'
  const btn = (act: string, label: string): string =>
    `<button type="button" data-act="${act}">${label}</button>`
  menu.innerHTML = [
    btn('pet', '摸一摸'),
    btn('card', '看档案'),
    btn('lock', pet.locked ? '解锁' : '锁定'),
    btn('rename', '重命名'),
    btn('export', '导出档案卡'),
  ].join('')

  menu.style.visibility = 'hidden'
  stage.appendChild(menu)
  const rect = stage.getBoundingClientRect()
  const mw = menu.offsetWidth || 128
  const mh = menu.offsetHeight || 190
  const left = Math.max(4, Math.min(anchor.x - mw / 2, rect.width - mw - 4))
  const top = Math.max(4, Math.min(anchor.y - mh - 8, rect.height - mh - 4))
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
  menu.style.visibility = ''

  const onDocClick = (event: MouseEvent): void => {
    if (event.target instanceof Node && menu.contains(event.target)) return
    close()
  }
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close()
  }
  const close = (): void => {
    closeInteractMenu(stage)
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onKey)
  }
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onKey)

  menu.addEventListener('click', event => {
    if (menu.dataset.renaming === '1') return
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    const act = button.dataset.act
    if (act === 'rename') {
      showRenameRow(stage, menu, pet, handlers)
      return
    }
    close()
    if (act === 'pet') handlers.onPet(pet.id)
    else if (act === 'card') handlers.onCard(pet.id)
    else if (act === 'lock') handlers.onToggleLock(pet.id)
    else if (act === 'export') handlers.onExport(pet.id)
  })
}

/** 重命名行：输入 + 确定/取消；置 renaming 标记屏蔽主监听器，确定时空名忽略。 */
function showRenameRow(
  stage: HTMLElement,
  menu: HTMLElement,
  pet: MenuPetInfo,
  handlers: InteractMenuHandlers,
): void {
  menu.dataset.renaming = '1'
  menu.innerHTML = `<input type="text" maxlength="12" placeholder="新名字" value="${esc(pet.name)}"/>`
    + `<button type="button" data-act="confirm">确定</button>`
    + `<button type="button" data-act="cancel">取消</button>`
  const input = menu.querySelector<HTMLInputElement>('input')
  input?.focus()
  input?.select()

  const confirm = (): void => {
    const name = input?.value.trim() ?? ''
    closeInteractMenu(stage)
    if (name !== '') handlers.onRename(pet.id, name)
  }
  menu.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button')
    if (button === null) return
    if (button.dataset.act === 'confirm') confirm()
    else closeInteractMenu(stage)
  })
  menu.addEventListener('keydown', event => {
    if (event.key === 'Enter') confirm()
  })
}

export function closeInteractMenu(stage: HTMLElement): void {
  stage.querySelector('.py-menu')?.remove()
}
