/** 顶部 toast（M10/M11）：同一时刻至多一条。 */
export function showToast(stage: HTMLElement, text: string, ms = 2500): void {
  for (const el of stage.querySelectorAll('.py-toast')) el.remove()
  const toast = document.createElement('div')
  toast.className = 'py-toast'
  toast.textContent = text
  stage.appendChild(toast)
  window.setTimeout(() => toast.remove(), ms)
}
