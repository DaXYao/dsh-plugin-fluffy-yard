/**
 * 双产物构建：node 半边 lib/index.js + 浏览器半边 lib/client.js。
 * client 产物复刻 deepseek-harness 共享预设（packages/client/tsdown.client.ts）
 * 的关键契约：CJS + __ModuleLoader__.load 工厂包裹 + 平台模块 external。
 */
export const PET_ID = 'dsh-plugin-fluffy-yard'

/** 外壳播种的模块身份（deepseek-harness packages/client/web/src/platform.ts）。 */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

/** 判断模块是否为平台外置模块（不打包进 client 产物）。
 * @autodoc:category auxiliary
 * @autodoc:purpose 判断模块 specifier 是否为平台外置模块（react/cordis 等） */
const isPlatform = (specifier: string): boolean =>
  (PLATFORM_MODULES as readonly string[]).includes(specifier)

export default [
  {
    name: PET_ID,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    // package.json 的 main/exports 指向 ./lib/index.js；tsdown 0.22 默认输出 .mjs，显式固定为 .js。
    outExtensions: () => ({ js: '.js' }),
  },
  {
    name: `${PET_ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: isPlatform,
      alwaysBundle: (specifier: string) => !isPlatform(specifier),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PET_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
