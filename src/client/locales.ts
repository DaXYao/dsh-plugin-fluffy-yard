// 命名空间行：类型化 register/bind 要求 ns 在 LocaleNamespaceMap 里
//（dsh-client-locale 只声明了它自带的命名空间，本包命名空间由本包声明）。
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'pet-yard': 'view.petYard'
  }
}

export const NS = 'pet-yard'

export const zh = {
  'view.petYard': '宠物小院',
}

export const en = {
  'view.petYard': 'Pet Yard',
}
