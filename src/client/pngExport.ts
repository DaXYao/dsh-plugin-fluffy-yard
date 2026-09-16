/**
 * 导出通道：SVG 字符串 → 离屏 canvas 栅格化 → PNG Blob → 浏览器下载。
 * P0 验证用；P3 起扩展为完整档案卡/合影管线。
 * @autodoc:purpose SVG 字符串栅格化为 PNG 并触发浏览器下载 */
export async function downloadSvgAsPng(
  svg: string,
  fileName: string,
  width = 540,
  height = 720,
): Promise<void> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG 图片加载失败'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx2d = canvas.getContext('2d')
    if (ctx2d === null) throw new Error('canvas 2d 上下文不可用')
    ctx2d.drawImage(img, 0, 0, width, height)
    const pngBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (pngBlob === null) throw new Error('canvas.toBlob 返回空')
    triggerDownload(pngBlob, fileName)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 触发浏览器下载：Blob 包装为 <a download> 并点击。
 * @autodoc:purpose 用 <a download> 触发浏览器下载 Blob */
export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
