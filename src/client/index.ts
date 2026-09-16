/**
 * 浏览器半边入口：向 conversation.view 槽位注册「宠物小院」占位视图。
 * P0 spike——验证树外 client 插件装载链路。
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only：'conversation.view' 的 SlotMap 行由 ui-conversation 声明，
// 必须出现在本 program 里 register 调用才能通过类型检查（构建时被擦除）。
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { NS, en, zh } from './locales.ts'
import { PetYardView } from './PetYardView.tsx'

/** 需要的服务：slot 注册表与本地化。 */
export const inject = ['slots', 'locale']

/**
 * 插件装配：注册本地化词典并向 conversation.view 注入「宠物小院」视图。
 * @autodoc:category business
 * @autodoc:purpose 浏览器半边入口：注册「宠物小院」conversation.view 槽位视图 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'pet-yard: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.effect(
    () => ctx.slots.inject('conversation.view', () => ctx.slots.register({
      name: 'conversation.view',
      id: 'pet-yard',
      order: 20,
      label: () => t('view.petYard'),
    }, PetYardView)),
    'pet-yard: conversation view',
  )
}
