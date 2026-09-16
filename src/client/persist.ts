import { fromDoc, migrate, toDoc } from '../core/doc.ts'
import type { Yard } from '../core/types.ts'

const STORAGE_KEY = 'dsh-plugin-fluffy-yard/state'

/** 载入院子状态；读取失败时备份原文并回退初始档，绝不静默丢弃。
 * @autodoc:purpose 从 localStorage 载入院子状态，失败时备份并回退初始档 */
export function loadYard(now: number): Yard {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return fromDoc(migrate(null, now))
    return fromDoc(migrate(JSON.parse(raw), now))
  } catch (err) {
    console.error('[pet-yard] 存档读取失败，使用初始档：', err)
    if (raw !== null) {
      try {
        localStorage.setItem(`${STORAGE_KEY}.broken`, raw)
      } catch { /* 备份失败忽略 */ }
    }
    return fromDoc(migrate(null, now))
  }
}

/** 序列化院子状态写入 localStorage。
 * @autodoc:purpose 序列化院子状态并写入 localStorage */
export function saveYard(yard: Yard): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toDoc(yard)))
  } catch (err) {
    console.error('[pet-yard] 存档写入失败：', err)
  }
}
