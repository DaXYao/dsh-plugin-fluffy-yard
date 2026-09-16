# P0 执行报告

- 日期：2026-08-28（浏览器内会话时间戳显示 2026-08-29 00:26，为本地时区跨零点所致）
- 执行环境：Windows 10.0.22631 / node v24.19.0 / npm 11.17.0 / pnpm 11.24.0 / dsh 0.1.1-rc.2 / tsdown 0.22.14 / typescript ^6 / vitest 4.1.11

## 检查点结果

| 检查点 | 结果 | 备注 |
|---|---|---|
| CP0 前置环境 | ✅ | dsh CLI 全局安装成功（首次安装后全局目录曾消失，重装后稳定，见报错记录 #1） |
| CP1 骨架+构建 | ✅ | lib/ 产物：`index.js`（0.16 kB）、`client.js`（7.70 kB）、`client.js.map`；head/tail 验证工厂包裹契约满足（`window.__ModuleLoader__.load({ id: "dsh-plugin-pet", factory: (require) => {` … `return module.exports; } });`，格式与模板略有空白差异，语义一致） |
| CP2 vitest | ✅ | 4/4 用例通过（doc.spec.ts，595ms） |
| CP3 profile 安装 | ✅ | `dsh plugin --profile pets add E:/dsh-plugin-pet` 成功（pnpm link）；`--dump-config` 第 504 行出现 `# == dsh-plugin-pet` 层，含 `- id: pet-yard, name: dsh-plugin-pet` |
| CP4 web 装载 | ✅ | 终端侧：URL 打印 `http://127.0.0.1:3080`，全程无 FAILED/PENDING fiber 报错；浏览器侧：页面实际请求 `/plugins/dsh-plugin-pet/client.js?rev=054a5f423e50`（200），模块工厂执行，会话视图 tab 条出现「宠物小院」，点击后面板完整渲染（标题/存档时间/计数 0/两个按钮） |
| CP5 持久化+导出 | ✅ | 计数器点击递增且出现「已保存」；F5 后计数保留（3），localStorage 键 `dsh-plugin-pet/state` 内容 `{"schemaVersion":1,"smokeCounter":3,"createdAt":1787934417649}`；「导出测试 PNG」触发浏览器 download 事件 + 面板提示「PNG 已开始下载」，同管线页内取 blob 验证为合法 PNG（image/png，~10.5 KB）；540×720 文件落盘位置未在自动化环境确认（见遗留 #1） |
| CP6 HMR | ✅ | **自动热替换可用**：`npm run watch` 下改动源码 → tsdown 重建（~10ms）→ 页面 1–2 秒内自动更新，无需刷新，且组件状态保留（计数 3 未丢）；标题回退同样热替换生效 |
| CP7 overlay 探针 | ✅ | `shell.overlay` 槽位注册成功；「小院 probe」胶囊右下角渲染，**常驻可见**（会话打开态与无会话草稿态均在）；观察后已完全回退（effect/导入/文件删除+重建），主链路（宠物小院 tab）不受影响 |

## implementation-plan §1.2 三个待验证项的结论

1. **树外 client 半边装载**：**可用**。成功路径 = `dsh plugin --profile pets add <本地路径>`（pnpm link）+ **profile 的 `dsh.profile.bundles` 需含 `@deepseek-ai/dsh-web-app`**，然后 `dsh --profile pets` 启动（`dsh web --profile pets` 命令形态不存在，见偏差 #4）。关键证据：页面 resource 记录含 `http://127.0.0.1:3080/plugins/dsh-plugin-pet/client.js?rev=054a5f423e50`；`__ModuleLoader__.mode === "live"`；slot 注册生效（tab 出现）。dsh 终端日志零报错。
2. **面板落位**：
   - conversation.view：无会话时 **tab 不可见**（该状态下整个视图 tab 条不渲染，连内置「对话」「轨迹」也没有；tab 条只在存在打开的会话时出现）；有会话时「宠物小院」与「对话」「轨迹」并列出现（order: 20，排在内置 tab 之后）。拖拽缩放表现：面板 `width: 100%`，视口 1280→900 变化时宽度跟随会话区容器（截图验证），是"自由缩放"的合格基础。
   - shell.overlay 探针：注册成功？（**yes**）常驻可见？（**yes**，会话态与草稿态都渲染，`position: fixed` 右下角，`pointerEvents: none` 不挡交互）
   - **落位建议**：主面板落 `conversation.view`（tab 形态、随会话区缩放，符合"会话区视图"定位）；常驻悬浮小组件（如后续的桌面宠物入口）可落 `shell.overlay`。
3. **HMR**：**自动热替换可用**。补充：即使 tsdown watch 未运行，只要重新执行 `npm run bundle`，页面内的 client-hmr（stat 轮询 bundle 文件）也会在数秒内自动热替换（CP7 探针阶段实测）——热替换的触发源是 bundle 文件变化，与构建方式无关。

## 通道验证

- localStorage 整值持久化：**✓**。点击「+1 并保存」→ 面板出现「已保存（时间）」；F5 刷新后重进宠物小院 tab 计数保留；DevTools 等价验证：页内 `localStorage.getItem('dsh-plugin-pet/state')` 返回完整 JSON（schemaVersion/smokeCounter/createdAt 与写入一致）。
- PNG 浏览器导出：**✓**（自动化环境内）。点击「导出测试 PNG」→ `download` 事件触发、面板提示「PNG 已开始下载」；同一 canvas→toBlob 管线页内取样得到合法 PNG Blob（image/png）。下载文件由内嵌自动化浏览器托管，未在用户磁盘定位到 `dsh-plugin-pet-p0.png`（见遗留 #1）。

## 偏差与决策树使用记录

1. **CP0**：首次 `npm install -g @deepseek-ai/dsh` 完成且 `dsh --version` 正常后，全局包目录一度整体消失（`MODULE_NOT_FOUND: .../lib/bin.js`）。处置：重新 `npm install -g` 后稳定（疑似此前被手动中断的后台安装留下半写状态）。未用决策树。
2. **CP1·类型（决策树 D3 变体）**：模板 `src/client/index.ts` 首次 typecheck 报 `Property 'locale' does not exist on type 'Context'`。根因：`ctx.locale` 的模块增强在 `@deepseek-ai/dsh-client-locale/client` 子路径，模板缺少该 type-only 导入；且类型化 `register/bind` 要求 ns 在 `LocaleNamespaceMap` 中声明。修复：补 `import type {} from '@deepseek-ai/dsh-client-locale/client'`；在 `src/client/locales.ts` 增加 `declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'pet-yard': 'view.petYard' } }`。此后 register/bind 走全类型化路径，无任何 `as never` 降级。
3. **CP1·产物名（决策树 D1 变体）**：tsdown 0.22.14 对 node 半边默认输出 `index.mjs`，与 package.json `main/exports` 指向的 `./lib/index.js` 不符。修复：node 配置加 `outExtensions: () => ({ js: '.js' })`。client 产物名由 `entryFileNames: 'client.js'` 正常。
4. **CP4（决策树 D5）**：`dsh web --profile pets` → `error: unknown option '--profile'`；`dsh --profile pets web` → `error: web takes none of parent --profile...`。按 D5 查 `dsh --help`：`web` 是内置 web profile 的别名。实际解法：自定义 profile 要获得 Web UI，需在其 `package.json` 的 `dsh.profile.bundles` 中加入 `@deepseek-ai/dsh-web-app`（编辑 `C:/Users/PC/.dsh/profiles/pets/package.json`，置于本包之前），然后 `dsh --profile pets` 启动。**这是对"官方树外路径"的重要修正**：`dsh plugin --profile X add` 创建的裸 profile 只含 `dsh-base`，不含 Web UI。
5. **CP4·认证边界**：`dsh web` 终端打印的 URL **不含** `?token=`；`curl http://127.0.0.1:3080/` 直接 200（背景速查第 10 条"根路径需 token"在本机组合下未复现；静态插件 bundle 公开 200 与速查一致）。未阻塞，记录待复查。
6. **CP4·会话准备（验证环境操作，非产品代码）**：Web UI 的「添加工作区」走原生目录选择器，自动化不可达；为建立真实会话，直接按 `dsh-workspace` 的持久化 schema 预置了一个工作区（`C:/Users/PC/.dsh/storages/workspace.json`，path=`E:\dsh-plugin-pet`），并发送了一条最小消息「你好」物化会话（消耗一次 DeepSeek-V4-Flash 调用，1 轮/222 tok）。
7. **CP7·类型（决策树 D3 变体）**：`shell.overlay` 首次 typecheck 报不在 SlotMap。根因：该槽位行由 `@deepseek-ai/dsh-client-ui-layout`（AppFrame）声明，模板缺 type-only 导入。修复：补 `import type {} from '@deepseek-ai/dsh-client-ui-layout/client'`。运行时一次通过。
8. **浏览器自动化细节**（非偏差，记录工具事实）：该 Web UI 的 tab/按钮元素对 Playwright role 引擎不可点击（pointer probe 无点击点），改走 dom_cua 节点/坐标路径完成全部交互；页面内状态读取用 evaluate。

## 遇到的报错与处置

1. `Cannot find module '.../@deepseek-ai/dsh/lib/bin.js'`（全局包目录消失）→ 重装全局包，解决。
2. `error: unknown option '--profile'` / `error: web takes none of parent --profile...` → 见偏差 #4，解决。
3. `listen EADDRINUSE ... 127.0.0.1:3080`（TaskStop 停掉包装 shell 后 node 子进程存活）→ `netstat` 找 PID `taskkill //F`，解决。
4. `TS2339: Property 'locale' does not exist on type 'Context'` → 见偏差 #2，解决。
5. `TS2769: Type '"shell.overlay"' is not assignable to SlotMap name 联合` → 见偏差 #7，解决。
6. 一次瞬时 `'tsc' 不是内部或外部命令`（node_modules 刚装完后首次运行出现，数秒后自愈；疑似杀软/索引器瞬时锁）→ 重试即恢复。

## 对 implementation-plan 的回填建议（草稿，不直接改原文件）

- §1.1 面板落位应改为：主面板落 `conversation.view`（需存在打开的会话，tab 条才渲染；面板宽度跟随会话区，支持自由缩放）；常驻悬浮件（宠物入口/状态胶囊）落 `shell.overlay`（additive 列表槽，无会话时也渲染）。
- §1.2 待验证项应改为（已验证结论）：树外 client 半边装载可用（profile add + bundles 含 dsh-web-app）；conversation.view 无会话不可见/有会话可见、宽度跟随；shell.overlay 注册且常驻；HMR 自动热替换可用（bundle 文件级触发，与构建方式无关）。
- 其他修订建议：
  - 命令形态修正：`dsh web --profile X` 不存在；树外插件的 Web 验证路径应为「`dsh plugin --profile X add <路径>` → 在 profile 的 `dsh.profile.bundles` 加 `@deepseek-ai/dsh-web-app` → `dsh --profile X`」。
  - 模板补丁：`src/client/index.ts` 需补 `@deepseek-ai/dsh-client-locale/client` 与 `@deepseek-ai/dsh-client-ui-layout/client` 两个 type-only 导入；`src/client/locales.ts` 需声明 `LocaleNamespaceMap['pet-yard']`；tsdown node 配置需 `outExtensions` 固定 `.js`。
  - 背景速查第 10 条（token 栅栏）与本机实测不符（根路径直接 200），建议复查认证边界或在文档标注适用条件。

## 遗留问题 / 待用户决策

1. **PNG 落盘确认**：自动化内嵌浏览器托管了下载（事件+面板提示+blob 三证），但 `dsh-plugin-pet-p0.png` 未在磁盘定位到。建议用户在自己的浏览器打开 `http://127.0.0.1:3080`，进宠物小院 tab 点一次「导出测试 PNG」，肉眼确认 540×720 米色卡片与简笔小猫脸。
2. **视觉缺陷（P1 修）**：占位面板两个按钮的文字在 DSH 深色主题下不可见（按钮渲染为空白圆角矩形，DOM 标签存在且可点击）——按钮未显式设 `color`，疑似被主题样式覆盖，P1 样式规范化时一并处理。
3. **验证后残留**：为验证预置的工作区（`ws-pet-yard` → `E:\dsh-plugin-pet`）与一条「你好」会话留在了用户 DSH home；如不需要可手动删除。`dsh --profile pets` 服务当前仍在后台运行（端口 3080），方便用户直接打开验证，不需要时可结束进程。
4. **git 安全点未做**：计划中的可选 `git init` 提交跳过（当前目录非 git 仓库，用户未要求）。
