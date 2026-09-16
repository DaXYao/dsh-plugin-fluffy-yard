import { rngFrom } from './rng.ts'

/** 离开满 N 天可获得明信片（H7）。 */
export const POSTCARD_AFTER_DAYS = 3

const MS_PER_DAY = 86_400_000

const TEMPLATES = [
  '在新家的院子里晒太阳，很想念你 ——{name}',
  '这边的小鱼干也不错，但还是想你 ——{name}',
  '交了新朋友！它有点像你 ——{name}',
  '今天追了一整天蝴蝶，睡得很好 ——{name}',
  '偶尔还会路过那扇窗户 ——{name}',
  '新院子有个小坡，我承包了 ——{name}',
  '听见雨声就会想起你 ——{name}',
  '长胖了一点点，别担心 ——{name}',
] as const

/** 由宠物 id 确定性推导的明信片文案（H7）。 */
export function postcardTextFor(id: string, name: string): string {
  return rngFrom(`${id}:postcard`).pick([...TEMPLATES]).replaceAll('{name}', name)
}

/** 资格：离开满 POSTCARD_AFTER_DAYS 天。 */
export function postcardEligible(leftAt: number, now: number): boolean {
  return now - leftAt >= POSTCARD_AFTER_DAYS * MS_PER_DAY
}
