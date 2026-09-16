# P0 执行方案：工程骨架与 DSH 集成 spike（执行手册）

> 版本：v1.0 · 对应 `docs/implementation-plan.md` 的 P0 阶段
> **执行者须知**：本文档为线性执行手册。所有需要判断力的技术调研已由主代理完成并固化为模板与决策树——**按顺序执行，照抄模板，遇分支走决策树，不要自行发明结构**。

---

## 0. 任务说明

### 0.1 目标（= implementation-plan P0 验收门）

1. 在 `E:/dsh-plugin-pet` 建立符合 DSH 插件包规范的工程骨架，产出双构建产物。
2. **Spike**：验证树外插件的浏览器半边（`lib/client.js`）能被 `dsh web` 装载，面板出现在 Web UI 中。
3. 验证两条通道：localStorage 整值持久化 roundtrip；canvas → PNG 浏览器下载。
4. 搭好 vitest 并让首个 core 冒烟测试通过。
5. 产出 `docs/p0-report.md`，回答 implementation-plan §1.2 的三个待验证项。

### 0.2 与 implementation-plan 任务编号的映射

| 检查点 | 内容 | 对应任务 |
|---|---|---|
| CP0 | 前置环境安装 | — |
| CP1 | 仓库初始化 + 双产物构建 | P0-1 |
| CP2 | vitest 冒烟测试 | P0-5 |
| CP3 | 安装进 profile + host 半边装载验证 | P0-2（前半） |
| CP4 | `dsh web` + 浏览器半边装载验证 | P0-2（后半）、P0-3（观察） |
| CP5 | localStorage 持久化 + PNG 导出验证 | P0-4 |
| CP6 | HMR 可用性验证 | P0-2（附加） |
| CP7 | `shell.overlay` 探针 + 产出报告 | P0-3（探针）+ 验收 |

### 0.3 执行规则（必须遵守）

1. **工作目录**：全程在 `E:/dsh-plugin-pet` 下操作。创建文件用绝对路径。
2. **不修改** `docs/requirements.md` 与 `docs/implementation-plan.md`。所有结论写入新文件 `docs/p0-report.md`。
3. **模板文件原样创建**。唯一允许的改动：决策树（§5）明确列出的分支。任何偏离都要记入报告"偏差记录"。
4. **每个检查点先验证再前进**。验证失败 → 查 §5 决策树 → 决策树没覆盖的情况：最多尝试 2 种合理修复，仍失败则把**报错原文**记入报告，跳过该步继续能继续的部分。
5. **不引入模板之外的 npm 依赖**。
6. 长驻命令（`dsh web`、`npm run watch`）用后台任务方式运行并轮询其输出。
7. 浏览器内的视觉验证无法自动化时（§3 CP4 的观察项），把验证清单整理输出给用户确认，并把"待用户确认"如实记入报告。
8. 环境：Windows + Git Bash。路径一律用正斜杠（`E:/dsh-plugin-pet`）。Node ≥ 20（本机 v24）。

---

## 1. 背景速查（已验证事实，执行时直接引用，不需要重新调研）

以下结论来自 deepseek-harness master 分支源码与 npm registry（2026-08-28 核实）：

1. **插件包双半边**：一个 UI 插件 = 一个 npm 包。node 半边 `src/index.ts` → `lib/index.js`（host Loader 导入）；浏览器半边 `src/client/index.ts` → `lib/client.js`（webserver 经 `/plugins/<包名>/client.js` 下发）。
2. **`dsh` 键**：`package.json` 的 `dsh.client`（`{ inject: [...], platform: 'web' }`）声明浏览器半边及其依赖边；`dsh.bundle`（`{ patch: './cordis.patch.yml' }`）声明这是一个组合包，安装后自动贡献配置层。
3. **组合包安装**（官方树外路径）：`dsh plugin --profile <名> add <本地路径>` 经 pnpm 链接本包；随后 `dsh --profile <名> ...` 启动。`dsh --profile <名> --dump-config` 可查看合并后的配置层。
4. **名册行**：client 插件包与 host 插件一样是配置树里的 entry 行：`- id: <任意id>, name: <包名>`。host 侧扫描 live entry 的 `dsh.client` 声明组合浏览器启动图；**没有已构建 `./client` 产物的声明包会在激活时被拒绝**——所以必须先 `npm run bundle` 再启动。
5. **client 产物契约**（复刻自仓库共享预设 `packages/client/tsdown.client.ts`）：CJS 格式，用 banner/footer 包成工厂——`window.__ModuleLoader__.load({ id, factory: (require) => { …body… return module.exports; } })`；平台模块保持 external，由外壳播种的模块表应答。
6. **平台模块（external 清单）**，来自 `packages/client/web/src/platform.ts`：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`。**其余 `@deepseek-ai/*` 一律只允许 `import type`（会被擦除）**；跨包运行时协作只走 cordis 服务（如 `ctx.slots`）。
7. **槽位注册**（参照最小样板 `ui-trajectory`）：client 入口导出 `inject = ['slots', ...]` 与 `apply(ctx)`；用 `ctx.slots.inject('conversation.view', () => ctx.slots.register({...}, Component))` 注册。`conversation.view` 是会话区视图 tab 槽位（ui-trajectory 即注册于此）。
8. **HMR**：web 组合无条件挂载 `client-hmr` 行，按 stat 轮询监视图内全部 row 的 bundle 文件——树外包的 row 理论上同样被监视；本地跑 `tsdown --watch` 重建后应能热替换。需实测。
9. **npm 可用性**（全部已核实）：CLI `@deepseek-ai/dsh@0.1.1-rc.2`（bin 名 `dsh`）；类型包 `@deepseek-ai/cordis@^4.0.1`、`dsh-client-ui-slots` / `dsh-client-ui-conversation` / `dsh-client-ui-renderer` / `dsh-client-locale` 均有 `0.1.1-rc.2`（dist-tag `next`，与 CLI 同版本）。构建工具：仓库自身用 `tsdown@^0.22.2`（npm latest 0.22.14）、`typescript@^6`、`vitest@^4`。
10. **认证边界**：Web UI 根路径需 `?token=...`（终端会打印带 token 的 URL）；静态资源（含插件 bundle）公开。

---

## 2. CP0 — 前置环境

```bash
node --version                      # 预期 ≥ v20（本机 v24）
npm install -g pnpm
npm install -g @deepseek-ai/dsh
dsh --version                       # 预期 0.1.1-rc.2 或更新
dsh --help | head -30               # 确认子命令存在（plugin / web 等）
```

**验证**：三条版本命令都有输出。
**失败分支**：`dsh` 不是命令 → 试 `npx @deepseek-ai/dsh --version`；仍失败 → 全局 bin 目录不在 PATH，记录 `npm bin -g` 的路径并加入，或后续所有 `dsh` 前缀改用 `npx @deepseek-ai/dsh`。

---

## 3. 检查点 CP1–CP7

### CP1 — 仓库初始化与双产物构建（P0-1）

在 `E:/dsh-plugin-pet` 下创建以下文件（**内容原样照抄**）：

**`package.json`**

```json
{
  "name": "dsh-plugin-pet",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "毛茸茸小院 — DeepSeek Harness 宠物插件",
  "main": "lib/index.js",
  "exports": {
    ".": { "default": "./lib/index.js" },
    "./client": { "default": "./lib/client.js" },
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-conversation",
        "@deepseek-ai/dsh-client-ui-renderer"
      ],
      "platform": "web"
    }
  },
  "files": [
    "lib/index.js",
    "lib/client.js",
    "lib/client.js.map",
    "cordis.patch.yml"
  ],
  "scripts": {
    "bundle": "tsdown",
    "watch": "tsdown --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

**`tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "types": []
  },
  "include": ["src", "tests"]
}
```

**`tsdown.config.ts`**

```ts
/**
 * 双产物构建：node 半边 lib/index.js + 浏览器半边 lib/client.js。
 * client 产物复刻 deepseek-harness 共享预设（packages/client/tsdown.client.ts）
 * 的关键契约：CJS + __ModuleLoader__.load 工厂包裹 + 平台模块 external。
 */
export const PET_ID = 'dsh-plugin-pet'

/** 外壳播种的模块身份（deepseek-harness packages/client/web/src/platform.ts）。 */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

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
```

**`cordis.patch.yml`**（本包贡献的组合层：插入本包的插件行）

```yaml
# dsh-plugin-pet 组合层：按包名插入本包的插件行
#（profile 的 node_modules 经 pnpm link 解析到本仓库）。
- insert:
    - id: pet-yard
      name: dsh-plugin-pet
```

**`.gitignore`**

```
node_modules/
lib/
*.tsbuildinfo
package-lock.json
pnpm-lock.yaml
```

**`src/index.ts`**（host 半边，P0 无宿主逻辑）

```ts
/** Host loader entry for the browser-only pet plugin. Provides no host-side behavior. */
export function apply(): void {}
```

**`src/client/locales.ts`**

```ts
export const NS = 'pet-yard'

export const zh = {
  'view.petYard': '宠物小院',
}

export const en = {
  'view.petYard': 'Pet Yard',
}
```

**`src/client/index.ts`**（浏览器半边入口：槽位注册）

```ts
/**
 * 浏览器半边入口：向 conversation.view 槽位注册「宠物小院」占位视图。
 * P0 spike——验证树外 client 插件装载链路。
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only：'conversation.view' 的 SlotMap 行由 ui-conversation 声明，
// 必须出现在本 program 里 register 调用才能通过类型检查（构建时被擦除）。
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { NS, en, zh } from './locales.ts'
import { PetYardView } from './PetYardView.tsx'

/** 需要的服务：slot 注册表与本地化。 */
export const inject = ['slots', 'locale']

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
```

**`src/client/PetYardView.tsx`**（占位面板：含持久化与导出两个通道的验证 UI）

```tsx
import { useEffect, useState } from 'react'
import { loadDoc, saveDoc } from './persist.ts'
import { downloadSvgAsPng } from './pngExport.ts'
import type { SaveDoc } from '../core/doc.ts'

const TEST_CARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="720" viewBox="0 0 540 720">
  <rect width="540" height="720" rx="24" fill="#fdf6ec"/>
  <circle cx="270" cy="330" r="120" fill="#f5b896"/>
  <circle cx="228" cy="300" r="14" fill="#3a2e28"/>
  <circle cx="312" cy="300" r="14" fill="#3a2e28"/>
  <path d="M252 352 q18 18 36 0" stroke="#3a2e28" stroke-width="6" fill="none" stroke-linecap="round"/>
  <text x="270" y="80" font-family="sans-serif" font-size="34" fill="#6b5b4d" text-anchor="middle">毛茸茸小院</text>
  <text x="270" y="560" font-family="sans-serif" font-size="26" fill="#6b5b4d" text-anchor="middle">P0 导出通道验证</text>
  <text x="270" y="620" font-family="sans-serif" font-size="20" fill="#a89880" text-anchor="middle">dsh-plugin-pet</text>
</svg>`

const panelStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 280,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  background: '#faf6f0',
  fontFamily: 'system-ui, sans-serif',
  color: '#4a3f35',
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 10,
  border: '1px solid #d8c9b8',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
}

/** P0 占位面板：验证槽位渲染、localStorage 持久化、PNG 导出三条链路。 */
export function PetYardView(_props: unknown): React.ReactElement {
  const [doc, setDoc] = useState<SaveDoc | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDoc(loadDoc(Date.now()))
  }, [])

  if (doc === null) {
    return <div style={panelStyle}>载入中…</div>
  }

  const increment = (): void => {
    const next = { ...doc, smokeCounter: doc.smokeCounter + 1 }
    setDoc(next)
    saveDoc(next)
    setMessage(`已保存（${new Date().toLocaleTimeString()}）`)
  }

  const exportPng = (): void => {
    downloadSvgAsPng(TEST_CARD_SVG, 'dsh-plugin-pet-p0.png')
      .then(() => setMessage('PNG 已开始下载'))
      .catch(err => setMessage(`导出失败：${String(err)}`))
  }

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: 0, fontSize: 20 }}>宠物小院（P0 占位）</h2>
      <p style={{ margin: 0 }}>存档建于：{new Date(doc.createdAt).toLocaleString()}</p>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{doc.smokeCounter}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" style={buttonStyle} onClick={increment}>+1 并保存</button>
        <button type="button" style={buttonStyle} onClick={exportPng}>导出测试 PNG</button>
      </div>
      {message !== '' && <p style={{ margin: 0, fontSize: 13, color: '#8a7a66' }}>{message}</p>}
    </div>
  )
}
```

**`src/core/doc.ts`**（持久化文档模型——core 层，零 DOM）

```ts
/** 持久化文档的当前结构版本。 */
export const DOC_SCHEMA_VERSION = 1

/**
 * 整个插件持久化的单一 JSON 文档（P0 骨架；后续阶段按需求 §5 扩展为完整结构）。
 */
export interface SaveDoc {
  schemaVersion: number
  /** P0 冒烟字段：面板内计数器，验证持久化链路。 */
  smokeCounter: number
  createdAt: number
}

export function createInitialDoc(now: number): SaveDoc {
  return { schemaVersion: DOC_SCHEMA_VERSION, smokeCounter: 0, createdAt: now }
}

/**
 * 把存储上的旧版本文档迁移到当前版本。P0 只有一条版本线；
 * 未来破坏性改动 = 版本号 +1 + 在此追加 case，链路从今天建立。
 */
export function migrate(raw: unknown, now: number): SaveDoc {
  if (typeof raw !== 'object' || raw === null) return createInitialDoc(now)
  const doc = raw as Partial<SaveDoc>
  switch (doc.schemaVersion) {
    case DOC_SCHEMA_VERSION:
      return {
        schemaVersion: DOC_SCHEMA_VERSION,
        smokeCounter: typeof doc.smokeCounter === 'number' ? doc.smokeCounter : 0,
        createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : now,
      }
    default:
      return createInitialDoc(now)
  }
}
```

**`src/client/persist.ts`**

```ts
import { migrate, type SaveDoc } from '../core/doc.ts'

const STORAGE_KEY = 'dsh-plugin-pet/state'

/** 载入存档；读取失败时备份原文并回退初始档，绝不静默丢弃。 */
export function loadDoc(now: number): SaveDoc {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return migrate(null, now)
    return migrate(JSON.parse(raw), now)
  } catch (err) {
    console.error('[pet-yard] 存档读取失败，使用初始档：', err)
    if (raw !== null) {
      try {
        localStorage.setItem(`${STORAGE_KEY}.broken`, raw)
      } catch { /* 备份失败忽略 */ }
    }
    return migrate(null, now)
  }
}

export function saveDoc(doc: SaveDoc): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch (err) {
    console.error('[pet-yard] 存档写入失败：', err)
  }
}
```

**`src/client/pngExport.ts`**

```ts
/**
 * 导出通道：SVG 字符串 → 离屏 canvas 栅格化 → PNG Blob → 浏览器下载。
 * P0 验证用；P3 起扩展为完整档案卡/合影管线。
 */
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
```

**`tests/doc.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { DOC_SCHEMA_VERSION, createInitialDoc, migrate } from '../src/core/doc.ts'

describe('SaveDoc 迁移（P0 冒烟）', () => {
  const now = 1_700_000_000_000

  it('空输入生成首版初始档', () => {
    const doc = migrate(null, now)
    expect(doc).toEqual({ schemaVersion: DOC_SCHEMA_VERSION, smokeCounter: 0, createdAt: now })
  })

  it('当前版本字段往返保持', () => {
    const doc = migrate({ schemaVersion: 1, smokeCounter: 7, createdAt: 123 }, now)
    expect(doc).toEqual({ schemaVersion: 1, smokeCounter: 7, createdAt: 123 })
  })

  it('未知版本回退初始档', () => {
    const doc = migrate({ schemaVersion: 99, smokeCounter: 7, createdAt: 123 }, now)
    expect(doc.smokeCounter).toBe(0)
    expect(doc.schemaVersion).toBe(DOC_SCHEMA_VERSION)
  })

  it('createInitialDoc 生成合法档', () => {
    expect(createInitialDoc(42)).toEqual({ schemaVersion: DOC_SCHEMA_VERSION, smokeCounter: 0, createdAt: 42 })
  })
})
```

安装依赖并构建：

```bash
cd E:/dsh-plugin-pet
npm install -D typescript@^6 tsdown@^0.22 vitest@^4 \
  react@^18.2 react-dom@^18.2 @types/react@~18.3.1 @types/react-dom@~18.3.0 \
  @deepseek-ai/cordis@^4.0.1 \
  @deepseek-ai/dsh-client-ui-slots@0.1.1-rc.2 \
  @deepseek-ai/dsh-client-ui-conversation@0.1.1-rc.2 \
  @deepseek-ai/dsh-client-ui-renderer@0.1.1-rc.2 \
  @deepseek-ai/dsh-client-locale@0.1.1-rc.2
npm run typecheck
npm run bundle
```

**CP1 验证**：

```bash
ls lib/                                  # 预期：index.js  client.js  client.js.map
head -c 120 lib/client.js                # 预期开头：window.__ModuleLoader__.load({ id: "dsh-plugin-pet", factory: (require) => {
tail -c 60 lib/client.js                 # 预期结尾：return module.exports; } });
```

三条全部符合 → CP1 通过。任何一条不符 → 决策树 D1 / D2。
（可选安全点：`git init && git add -A && git commit -m "P0: scaffold"`，方便回滚；用户不希望使用 git 可跳过。）

---

### CP2 — vitest 冒烟测试（P0-5）

```bash
npm run test
```

**验证**：4 个用例全部通过。
**失败分支**：找不到 vitest → 确认 devDependencies 已写入 package.json；类型报错 → 检查 `allowImportingTsExtensions` 与 `noEmit` 是否按模板配置。

---

### CP3 — 安装进 profile，验证 host 半边（P0-2 前半）

```bash
dsh plugin --profile pets add E:/dsh-plugin-pet
dsh --profile pets --dump-config
```

**验证**：`--dump-config` 输出中能找到 `# == dsh-plugin-pet` 层，且含 `pet-yard` 行（`name: dsh-plugin-pet`）。

**失败分支**（按序尝试）：
1. pnpm 报错/找不到 → `pnpm --version` 确认；路径换 `E:\dsh-plugin-pet` 再试。
2. `dsh plugin` 子命令不存在 → `dsh --help` 查看实际子命令名（可能是 `dsh plugins` 或挂在别的命令下），照 help 调整。
3. add 成功但 dump-config 无该层 → 检查包根的 `package.json` 是否含 `dsh.bundle` 声明与 `cordis.patch.yml` 文件。

再做一个最小启动验证（host apply 是否被执行）：

```bash
dsh --profile pets --dump-config >/dev/null && echo "config OK"
```

（host 半边 `apply` 为空实现，无需额外日志验证；装载失败会在下一步 `dsh web` 的启动日志里显式暴露。）

---

### CP4 — `dsh web` 启动，验证浏览器半边（P0-2 后半 + P0-3 观察）

```bash
dsh web --profile pets
```

以后台任务运行，轮询其输出。

**终端侧验证（自动）**：
1. 输出中出现形如 `http://127.0.0.1:3080/?token=...` 的 URL（端口以实际输出为准）。
2. 启动日志无 FAILED/PENDING fiber 报错；若出现 `assertEntriesActivated` / settled 扫描报错，把原文记入报告 → 决策树 D4。

**浏览器侧验证（无法自动化时输出以下清单请用户确认）**：

1. 打开终端打印的完整 URL（含 token）。
2. 观察：**不打开任何会话**时，会话区（对话列）视图 tab 中是否出现「宠物小院」？记录 yes/no。
3. 新建/打开一个会话后，视图 tab（与「聊天」「Trajectory」等并列处）应出现「宠物小院」。
4. 点击该 tab：出现占位面板——标题「宠物小院（P0 占位）」、存档建立时间、数字 0、两个按钮。
5. DevTools Console 无红色报错；Network 面板中有一条 `dsh-plugin-pet/client.js`（可能在 `/plugins/??...` 组合 URL 里）状态 200。

同时记录 P0-3 需要的观察结论：
- tab 是否需要会话才可见（第 2 步的 yes/no）。
- 拖动浏览器窗口宽度 / 侧栏分隔条时，面板宽度是否跟随变化（这是"自由缩放"的基础）。

**失败分支** → 决策树 D4（装载失败阶梯）。

---

### CP5 — 持久化与 PNG 导出验证（P0-4）

在浏览器面板内操作：

1. 点「+1 并保存」若干次 → 数字递增，出现"已保存"提示。
2. **刷新页面**（F5），重新进入宠物小院 tab → 数字保留 = localStorage 持久化通道 ✓。同时 DevTools → Application → Local Storage 中应能看到键 `dsh-plugin-pet/state`。
3. 点「导出测试 PNG」→ 浏览器下载 `dsh-plugin-pet-p0.png`；打开图片：540×720、米色圆角卡片、一只简笔小猫脸、标题文字。= 导出通道 ✓。

（无法自动化时并入 CP4 的用户确认清单。）

---

### CP6 — HMR 可用性（P0-2 附加）

保持 `dsh web` 运行，另开后台任务：

```bash
npm run watch
```

然后修改 `src/client/PetYardView.tsx` 中的标题文字（如「宠物小院（P0 占位）」→「宠物小院（P0 占位·改）」），观察浏览器：

- **~1–2 秒内自动更新**（无需刷新）→ HMR ✓（记录：树外插件 HMR 可用）。
- 自动更新没发生但 `dsh web` 终端出现 rebuilt/重载相关日志 → 记录日志原文。
- 都没有 → F5 手动刷新：若新内容生效，记录"HMR 不可用，重建+刷新链路可用"；若刷新后仍是旧内容，记录"完全不可用"。

观察完成后把标题文字改回原样。

---

### CP7 — `shell.overlay` 探针 + 产出报告（P0-3 探针）

> 本步在 CP4/CP5 主链路通过后执行；它可能因槽位形状不符而报错，所以放在最后、且独立于主链路。

在 `src/client/index.ts` 的 `apply` 末尾**追加**：

```ts
  ctx.effect(
    () => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'pet-yard-probe',
      order: 999,
    }, PetYardOverlayProbe)),
    'pet-yard: overlay probe',
  )
```

并在文件顶部追加导入：

```ts
import { PetYardOverlayProbe } from './PetYardOverlayProbe.tsx'
```

**`src/client/PetYardOverlayProbe.tsx`**

```tsx
/** P0-3 落位探针：验证 shell.overlay 槽位可注册且全局常驻可见。 */
export function PetYardOverlayProbe(_props: unknown): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(90,70,50,0.85)',
        color: '#fff',
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none',
      }}
    >
      小院 probe
    </div>
  )
}
```

重建（`npm run bundle`）→ 刷新浏览器，记录：

- 右下角是否出现「小院 probe」胶囊（**不打开会话**时是否也在 = 常驻可见性）。
- 出现报错/fiber FAILED → 记录原文。

**探针观察完成后必须回退**：删除追加的 effect 与导入、删除 `PetYardOverlayProbe.tsx`、重新 `npm run bundle`，确认主链路（宠物小院 tab）不受影响。

最后创建 **`docs/p0-report.md`**，按 §4 模板填写。

---

## 4. 报告模板（`docs/p0-report.md` 原样填空）

```markdown
# P0 执行报告

- 日期：
- 执行环境：OS / node / pnpm / dsh 版本：

## 检查点结果

| 检查点 | 结果 | 备注 |
|---|---|---|
| CP0 前置环境 | | |
| CP1 骨架+构建 | | lib/ 产物清单 |
| CP2 vitest | | 用例数 |
| CP3 profile 安装 | | dump-config 层确认 |
| CP4 web 装载 | | 终端+浏览器两侧 |
| CP5 持久化+导出 | | |
| CP6 HMR | | |
| CP7 overlay 探针 | | |

## implementation-plan §1.2 三个待验证项的结论

1. **树外 client 半边装载**：（可用/不可用）+ 实际成功的路径（profile add / --patch / 其他）+ 关键日志摘录
2. **面板落位**：
   - conversation.view：无会话时 tab 可见？（yes/no）拖拽缩放表现：
   - shell.overlay 探针：注册成功？（yes/no）常驻可见？（yes/no）
   - **落位建议**：（一句话，含理由）
3. **HMR**：（自动热替换可用 / 重建+刷新可用 / 完全不可用）

## 通道验证

- localStorage 整值持久化：（✓/✗）+ 现象
- PNG 浏览器导出：（✓/✗）+ 文件名/尺寸

## 偏差与决策树使用记录

（每处偏离模板的地方：原因 + 所用决策树编号 + 结果）

## 遇到的报错与处置

（报错原文 + 处置 + 是否解决）

## 对 implementation-plan 的回填建议（草稿，不直接改原文件）

- §1.1 面板落位应改为：
- §1.2 待验证项应改为（已验证结论）：
- 其他修订建议：

## 遗留问题 / 待用户决策
```

---

## 5. 决策树（失败时的唯一分支来源）

**D1 · tsdown 配置不被接受**（unknown option `deps.neverBundle` 等）
→ 把 client 配置里的 `deps: { neverBundle, alwaysBundle }` 整块替换为 `external: [...PLATFORM_MODULES]`（tsdown 顶层 external 数组），其余不变。仍失败 → 降级 tsdown 到 `0.22.2`（仓库锁定版本）重试。

**D2 · 产物 client.js 缺少工厂包裹**
→ 确认 `outputOptions` 的 banner/footer/intro 三项拼写与模板一致；确认 tsdown ≥ 0.22。仍不对 → 用 node 脚本后处理：读 lib/client.js，手动拼上 banner/intro/footer 后写回（记入偏差记录）。

**D3 · TypeScript 类型摩擦**（register/Component/locale API 类型不匹配）
→ 按优先级：
1. 组件 props 报错 → 把 `PetYardView` 的参数类型改为 `never`；
2. register 第二参报错 → 改为 `PetYardView as never`（加 `// TODO(P2): spike 临时绕过，恢复类型化注册`）；
3. `ctx.locale` 相关报错 → 去掉 locale：`inject = ['slots']`、删两处 locale effect、`label: () => '宠物小院'`；
4. `ctx.slots.inject` 不存在 → 改为 `ctx.effect(() => ctx.slots.register({ ... }, PetYardView))`。
每条都记入报告。**目标是通过运行时验证，类型完美留给 P2。**

**D4 · 浏览器半边装载失败阶梯**（`dsh web` 下看不到插件 / fiber 报错）
→ 按序排查，每步记录：
1. 看终端报错关键词：
   - `dsh.client` 声明相关（拒绝没有 ./client 产物的包）→ 确认 `npm run bundle` 已跑、`lib/client.js` 存在且含工厂包裹；
   - 缺服务/FAILED fiber → 对照报错里的服务名，检查 `package.json` 的 `dsh.client.inject` 与入口 `export const inject` 是否一致覆盖（模板值：ui-renderer / ui-conversation / dsh-client-locale + `['slots', 'locale']`）。
2. 排查后仍失败 → 改用 **--patch overlay 路径**：
   ```bash
   # 新建 E:/dsh-plugin-pet/cordis.yml（--patch 用，非组合包层）：
   # - insert:
   #     - id: pet-yard
   #       name: 'E:/dsh-plugin-pet/lib/index.js'
   dsh web --profile pets --patch E:/dsh-plugin-pet/cordis.yml
   ```
   行 `name` 依次尝试 `'E:/dsh-plugin-pet/lib/index.js'` → `'E:/dsh-plugin-pet'` → `'E:/dsh-plugin-pet/src/index.ts'`。
3. 两条路径都失败 → **停止**，把两种路径的报错原文完整记入报告（此时可能需要 vendored 进 DSH 仓库的路线，属于用户决策）。

**D5 · `dsh web` 命令形态不对**
→ 依次尝试：`dsh web --profile pets` → `dsh --profile pets web` → `dsh --help` 查看实际用法后照 help 执行。

**D6 · 端口/URL 探测**
→ URL 与端口一律以 `dsh web` 终端输出为准，不要假设 3080。`curl -s -o /dev/null -w "%{http_code}" <URL根路径>` 预期 401/重定向（认证栅栏存在证明）；插件 bundle 的组合 URL 若能在日志或浏览器 Network 中找到，curl 应为 200。

---

## 6. 禁止事项

1. 不修改 `docs/requirements.md`、`docs/implementation-plan.md`、`.tmp/` 目录。
2. 不提前实现 P1+ 的内容（生成算法、场景引擎、美术素材——P0 只要占位面板）。
3. 不为绕过问题引入新的 npm 依赖或构建工具。
4. 不删除/覆盖 `docs/` 下已有文件；报告写新文件。
5. 遇到需要产品判断的情况（例如两条装载路径都失败、或面板落位两难）→ 记录并报告，不擅自定夺。
