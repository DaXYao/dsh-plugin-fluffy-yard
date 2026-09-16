# 兼容性核查结论与 GitHub 发布方案

> 版本：v1.1 · 核查日期 2026-09-16（首次 2026-09-01）· 对应 `docs/implementation-plan.md` v1.8
> 背景：项目自 P0 起锁定 `@deepseek-ai/dsh@0.1.1-rc.2`（2026-08-21 发布）构建。本文记录对 dsh 上游（npm + GitHub master）的兼容性核查结论，并据此给出 GitHub 发布方案。
> 09-16 复核要点：npm latest 已前移至 **0.1.5-rc.1**（09-10），六项契约面复核**仍全部未破坏**——上传/发布无兼容性障碍。

---

## 1. 兼容性核查结论：**无破坏性更新，项目仍是合法插件**

### 1.1 版本态势（2026-09-16 复核）

| 渠道 | 版本 | 发布时间 | 说明 |
|---|---|---|---|
| npm `latest` | **0.1.5-rc.1** | 2026-09-10 | 较 09-01 核查时（0.1.1-rc.2）**已前移**，发布冒烟以此为准 |
| npm `next` | 0.1.5-rc.2 | 2026-09-10 | 同日追加 rc |
| npm `alpha` | 0.1.6-alpha.1 | 2026-09-15 | 前沿通道 |

08-21 以来完整发布序列：0.1.2-alpha.2…alpha.5 → 0.1.2-rc.1 → 0.1.3-alpha.2 → 0.1.5-alpha.1/2 → 0.1.5-rc.1/2 → 0.1.6-alpha.1（跳过 0.1.4，**至今无 stable**）。

类型包（locale / ui-conversation / ui-renderer / ui-slots / ui-layout）与 dsh 同步发布至 0.1.6-alpha.1（`next` = 0.1.5-rc.2；其 `latest` dist-tag 停在 0.0.x，与本项目无关）。`@deepseek-ai/cordis` latest 仍为 4.0.2（声明 `^4.0.1`，兼容）；README 安装步骤依赖的 `dsh-web-app` / `dsh-base` 仍在正常发布。

**semver 锁定分析**：`^0.1.1-rc.2` 依旧只匹配 0.1.1 段的预发布——上述新版本全部位于 0.1.2+ 的不同小版本段且均为预发布，无一落入范围，devDependencies 安装继续确定性地解析到 0.1.1-rc.2。

### 1.2 契约面逐项核查（master 分支，复核至 2026-09-15 最新提交）

对插件生存所系的六个契约面逐一比对当前 master 内容（09-16 复核）：

| # | 契约面 | 我们依赖的形态 | master 现状（2026-09-16） | 结论 |
|---|---|---|---|---|
| 1 | **client 产物工厂包裹**（`tsdown.client.ts` banner/footer/intro 三段式） | `window.__ModuleLoader__.load({ id, factory: (require) => {` / `return module.exports; } });` / `var module = …` | 第 577–579 行与本项目 `tsdown.config.ts:52-54` **逐字节一致**；期间被 sidebar terminals（9/9）/ workspace（9/7）特性触碰，契约行未动 | ✅ 未破坏 |
| 2 | **平台模块表**（`platform.ts` `PLATFORM_MODULES`） | react / react/jsx-runtime / react-dom / react-dom/client / cordis / dsh-client-store / dsh-client-ui-slots / dsh-client-ui-primitives | **纯增量**：9/7 "assemble Sidebar domains" 新增 `@deepseek-ai/dsh-client-ui-dockkit`；本项目 8 项 external 仍为其严格子集 | ✅ 未破坏 |
| 3 | **slot 注册 API**（`ui-slots`：`register(options, component)` + `ctx.slots.inject` + SlotMap 声明合并） | P0 起调研冻结的形态 | README 于 9/8–9/9 被文档重构瘦身（5935B → 3319B，语义未动）；源码核查：双参 `register` 返回 dispose、`{ id: string; order?: number; label?: SlotLabel }` 入口字段、SlotMap / LocaleNamespaceMap 声明合并全部健在 | ✅ 未破坏 |
| 4 | **`conversation.view` 槽位** | 我方注册的宿主槽位 | `ui-conversation/src/client/apply.ts:286` 仍声明 `'conversation.view': { kind: 'list', scope: 'session' }`；entries/subscribe 用法不变（期间触碰为 Auto review / composer / 面板导航重构，与槽位无关） | ✅ 未破坏 |
| 5 | **`dsh.client` manifest schema**（`modules/src/node/manifest.ts`） | package.json 的 `dsh.client.{inject, platform}` | 09-01 复核后**零提交**（累计自 P0 起未变） | ✅ 未破坏 |
| 6 | **插件装载/安装命令**（`dsh plugin --profile X add <路径>`、profile bundles、`--patch` overlay；`docs/user/develop/basic/`） | P0 验证的完整路径 | 教程 index.zh.md **零改动**（累计自 08-21 起）；`dsh plugin` 子命令仍在 | ✅ 未破坏 |

补充观察（09-16）：master 自 08-21 累计 200+ 提交（其中 9/1–9/15 新增 100+），集中在 sidebar terminals / workspace 本地应用 / Auto review / 会话导航修复 / 文档重构——仍全为宿主内部演进；web-app 名册（cordis.patch.yml）行格式不变。locale 服务的 `register(ns, dicts)` / `bind(ns)` 在 master 源码（`locale/src/client/index.ts:370/429`）签名未变。

### 1.3 风险与跟进

- **上游至今无 stable，且 latest 已前移至 0.1.5-rc.1**——本次复核（09-16）即"latest 前移后的复查"，六项全部通过。此后**任何一次 latest 前移**（0.1.6+ 进入 latest，或首个 stable）在发布/发版日按 **附录 A** 复查（15 分钟）。
- 类型面漂移量化（0.1.1-rc.2 → 0.1.5-rc.2 的 d.ts diff 行数）：locale 147 / ui-conversation 2065 / renderer 29 / ui-slots 328 / ui-layout 312——均为宿主内部重构与注释改写，对我们全部 type-only。
- 我们的 bundle 唯一的**值级**外部依赖是 react 家族（其余 `@deepseek-ai/*` 全部 type-only，构建时擦除）——即使未来类型包大改，也只影响编译期，运行时面极窄。这是本项目结构上的抗破坏优势。
- `dsh.client.inject` 声明的三个服务包（locale / ui-conversation / ui-renderer）包名至 0.1.6-alpha.1 未变。

---

## 2. 发布方案总览

依据 §1 结论走 **GitHub 发布** 路线。角色划分：

- **R1–R2（本地，可自动化执行）**：仓库加固、版本化、tarball 产物、安装文档。
- **R3（远端，需用户账号操作）**：建仓、推送、发 Release。
- **发布门槛**：R2 末尾的双版本 smoke（§6）。

当前 git 状态：main 分支、历史完整（P0→P6 + UX 轮）、工作树干净、**无远端**——直接在其上继续。

---

## 3. R1 — 仓库加固（本地）

### R1-1 LICENSE（新建，MIT）

```
MIT License

Copyright (c) 2026 <你的名字或 ID>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> 说明：本项目为自研实现（P0 时对 dsh 共享预设的**契约思路**做了复刻而非代码复制——tsdown 配置为本项目独立编写；DSH 本体是 BSD-3-Clause/MIT 的开源项目，插件以 MIT 发布无冲突）。`<你的名字或 ID>` 由用户填写。

### R1-2 README.md（新建于仓库根；大纲 + 关键正文模板）

```markdown
# 毛茸茸小院 · dsh-plugin-fluffy-yard

> 一个 DeepSeek Harness（dsh）宠物插件：在你的会话面板里养一座小院——
> 独一无二的猫猫狗狗会来做客，摸摸、锁定、合影、收集明信片与成就。
> 缩放面板还能看它们从悠闲到拥挤的百态，以及热情家伙们的争宠大战。

[截图位：舞台全景 · 档案卡 · 争宠瞬间 · 图鉴]（建议 4 张，浏览器截图后放入 docs/screenshots/）

## 特色

- **独一无二的家伙们**：2 物种 × 3 体型 × 4 耳型 × 10 毛色 × 5 花纹 × 4 尾巴 × 4 眼色 × 4 配饰 ≈ 7.7 万种组合，历史不重复；用尽进入「二世」轮回
- **性格驱动**：热情 / 淡定 / 高冷（出生决定），日常动作、争宠、冷场各有表现
- **争宠机制**：面板缩放驱动分档行为——宽裕散步、拥挤探头、狭小卡位、聚光灯轮换、极小压扁；点名上台、锁定皇冠、冷场哈欠传染
- **生活感**：家具小院（墙窗沙发桌）、食盆水碗（点击添食）、宠物互动（贴贴/追逐/玩球）、昼夜与天气
- **收藏闭环**：档案卡 PNG 导出、全员合影（水印=日期+第 N 次探望）、图鉴与明信片、14 项成就、连续探望统计
- **双美术风格**：几何简笔 / 软萌手绘，随时切换（存档内生效）
- 零第三方运行时依赖；数据存于浏览器 localStorage

## 安装（需要 dsh ≥ 0.1.1）

### 方式 A：Release tarball（推荐——免构建、免脚本授权）

​```sh
# 下载 Release 附件 dsh-plugin-fluffy-yard-0.1.0.tgz 后：
dsh plugin --profile pets add ./dsh-plugin-fluffy-yard-0.1.0.tgz
​```

### 方式 B：直接从 GitHub 安装（跟随最新）

​```sh
dsh plugin --profile pets add github:<用户名>/dsh-plugin-fluffy-yard
# pnpm ≥10 会要求为 prepare 构建脚本授权：
# 按提示把 pnpm 打印的包键写入该 profile 的 pnpm-workspace.yaml：
#   allowBuilds:
#     dsh-plugin-fluffy-yard: true
# 然后重新执行上面的 add 命令
​```

### 两种方式都要做的最后一步（重要）

​```sh
# 编辑 ~/.dsh/profiles/pets/package.json，把 Web UI 加入 bundles（置于本包之前）：
#   "dsh": { "profile": { "bundles": [
#     "@deepseek-ai/dsh-base",
#     "@deepseek-ai/dsh-web-app",     ← 加这一行
#     "dsh-plugin-fluffy-yard"
#   ] } }
dsh --profile pets        # 打开终端打印的 URL，进入会话后切到「宠物小院」标签
​```

> 已知事项：清除浏览器站点数据会丢失小院存档（导出的 PNG 不受影响）；
> 探望统计按自然日计，同一浏览器多标签页同时打开时以最后保存为准。

## 从源码开发

​```sh
git clone https://github.com/<用户名>/dsh-plugin-fluffy-yard && cd dsh-plugin-fluffy-yard
npm install
npm run bundle          # 产出 lib/（index.js + client.js）
npm run typecheck && npm run test
dsh plugin --profile dev add "$(pwd)"
# （dev profile 同样需要 bundles 含 @deepseek-ai/dsh-web-app）
npm run watch           # tsdown --watch；dsh 端 HMR 自动热替换
​```

调试：院角 🛠 调参台（宽度/高度精确调参、立即到访、时间快进、演示/冷场存档、状态快照、立绘画廊）。

## 结构

src/core（领域内核，纯逻辑 150+ 单测）· src/client/stage（舞台引擎：档位/争宠/家具/粒子）·
src/client/render（双美术风格 + 档案卡/合影）· src/client/ui（面板/图鉴/成就/画廊）。
文档在 docs/（需求、总实现计划、P0–P6 执行手册与验收报告）。

## License

MIT
```

> 落地时：把 `<用户名>`/`<你的名字或 ID>` 替换为真实值；`​```sh` 中的零宽字符是本文档防嵌套转义用的，落地为正常三反引号；截图补齐后删除占位说明行。

### R1-3 package.json 元数据编辑（精确编辑）

1. `"version": "0.0.1"` → `"0.1.0"`。
2. 删除 `"private": true`（GitHub 源码发布不必须，但删除后未来 `npm publish` 不受阻；如确定永不发 npm 可保留）。
3. 顶层追加：

```json
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/<用户名>/dsh-plugin-fluffy-yard.git" },
  "keywords": ["deepseek-harness", "dsh", "dsh-plugin", "pet", "webview"],
  "prepare": "npm run bundle",
```

4. `files` 数组核对为：`["lib/index.js", "lib/client.js", "lib/client.js.map", "cordis.patch.yml", "README.md", "LICENSE"]`。

> `prepare` 的作用：git 安装路径（方式 B）在 pnpm 授权后自动从源码构建出 `lib/`（官方 publish 文档的既定机制）。tarball 路径（方式 A）内含已构建产物，不触发构建。**注意**：本地 `npm install` 也会触发 prepare（无害，多跑一次构建）。

### R1-4 CI（新建 `.github/workflows/ci.yml`）

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "${{ matrix.node }}", cache: npm }
      - run: npm install
      - run: npm run typecheck
      - run: npm run test
      - run: npm run bundle
      - name: bundle contract check
        run: |
          head -c 80 lib/client.js | grep -q "__ModuleLoader__.load" || { echo "client.js 工厂包裹缺失"; exit 1; }
          test -s lib/index.js || { echo "index.js 缺失"; exit 1; }
```

### R1-5 可选清理（执行前与用户确认）

`docs/autodoc/` 与 `.autodoc/` 是 AutoDoc 工具产物。若不希望入库：在 `.gitignore` 追加两行后执行 `git rm -r --cached docs/autodoc .autodoc`。保留亦可（作为在线文档）。

### R1-6 验证

```sh
npm install && npm run typecheck && npm run test && npm run bundle   # 全绿
git add -A && git commit -m "chore: 发布加固（LICENSE/README/CI/元数据）"
```

---

## 4. R2 — 版本化与产物（本地）

```sh
# 1. 打包 tarball（files 字段保证内含 lib 产物 + patch + 文档；.gitignore 不影响 files 白名单）
npm pack
# 2. 校验包内容（应含 lib/index.js、lib/client.js、cordis.patch.yml、README.md、LICENSE）
tar -tzf dsh-plugin-fluffy-yard-0.1.0.tgz
# 3. 干净目录安装冒烟（验证 tarball 自足；prepare 触发的构建幂等）
mkdir -p .pack-smoke && cd .pack-smoke
echo '{"name":"pack-smoke","private":true}' > package.json
npm install ../dsh-plugin-fluffy-yard-0.1.0.tgz
ls node_modules/dsh-plugin-fluffy-yard/lib/    # 应有 index.js client.js
cd .. && rm -rf .pack-smoke
```

**Release notes 模板**（存 `docs/release-notes-v0.1.0.md`，发布时粘贴）：

```markdown
# 毛茸茸小院 v0.1.0

首个公开发布：P0–P6 全量功能——特征生成与历史唯一、性格三档、争宠五档（含聚光灯/冷场/点名）、
锁定/重命名、档案卡与合影导出、图鉴/明信片/成就、心情系统、昼夜天气、家具与吃喝、
宠物互动与粒子、双美术风格（几何简笔/软萌手绘）、内置调参台与立绘画廊。

**兼容**：dsh 0.1.1-rc.2（构建锁定版，已验证运行）；latest 0.1.5-rc.1 六项契约核查一致（docs/github-release-plan.md §1，2026-09-16 复核）。

**安装**：下载附件 tgz → `dsh plugin --profile pets add ./dsh-plugin-fluffy-yard-0.1.0.tgz`
→ profile bundles 加入 `@deepseek-ai/dsh-web-app` → `dsh --profile pets`。详见 README。
```

---

## 5. R3 — 远端发布（用户账号操作）

```sh
# 1. 建仓并推送（二选一）
gh repo create dsh-plugin-fluffy-yard --public --source . --push     # GitHub CLI
# 或网页建空仓后：
git remote add origin https://github.com/<用户名>/dsh-plugin-fluffy-yard.git
git push -u origin main

# 2. 标签与 Release
git tag v0.1.0 && git push origin v0.1.0
gh release create v0.1.0 ./dsh-plugin-fluffy-yard-0.1.0.tgz \
  --title "毛茸茸小院 v0.1.0" --notes-file docs/release-notes-v0.1.0.md
```

发布后自检：新机器/新 profile 按 README 方式 A 完整装一遍（含 bundles 步骤）。

---

## 6. 发布门槛：双版本 smoke

发布前在同一浏览器完成两个 profile 的加载验证（每项 5 分钟能跑完）：

| 检查 | profile-a（dsh@latest = **0.1.5-rc.1**，09-16 起前移） | profile-b（alpha = 0.1.6-alpha.1，**建议但不阻塞**） |
|---|---|---|
| 建法 | `dsh plugin --profile a add ./dsh-plugin-fluffy-yard-0.1.0.tgz` | 先 `npm i -g @deepseek-ai/dsh@alpha` 再同法（独立环境装 CLI） |
| bundles | 均加入 `@deepseek-ai/dsh-web-app` | 同左 |
| 验收 | ① 终端无 fiber 报错；② Network 见插件 client.js 200（0.1.5+ 为 `/plugins/??dsh-plugin-fluffy-yard/client.js&rev=…` 批量 URL，旧单路径 `/plugins/dsh-plugin-fluffy-yard/client.js` 返回 404 属正常）；③ 会话视图出现「宠物小院」标签且面板完整渲染（宠物/HUD/头像条/工具条）；④ 设置面板双风格切换生效；⑤ `dsh` 终端与 console 零红色报错 | 同左 |

- profile-a（= 当前 latest 0.1.5-rc.1）**必须全过**（发布阻塞项；这正是"上传后在新版宿主可用"的直接运行时验证）。
  **✅ 已于 2026-09-16 实际执行并通过**：tarball 安装（`dsh plugin --profile petsmoke add`）→ bundles 含 web-app → 启动 → 插件 manifest 被 0.1.5-rc.1 正确识别（inject 三件套透出）→ 批量 URL 伺服 client.js 200（工厂包裹逐字完好）→「宠物小院」标签出现、面板完整渲染（HUD 实时跳动、成就弹出、工具条八钮齐全）→ 服务器日志零报错。
- profile-b 若有失败：不阻塞 0.1.0 发布（静态契约核查 §1 已通过），但**必须**记录进 issue，并在下一次 latest 前移日按附录 A 复查后处理。

---

## 7. 后续跟进

1. **下一次 npm latest 前移日**（0.1.6+ 进入 latest 或首个 stable 发布）：执行附录 A 复查（六项契约 + npm dist-tags）；变化则开 issue 并按 §1.2 表格逐项评估影响面（重点：`conversation.view` 是否更名、工厂包裹是否改形）。
2. **可选**：`npm publish --access public`（发布前 `npm view dsh-plugin-fluffy-yard name` 查重名；发布后用户可 `dsh plugin --profile X add dsh-plugin-fluffy-yard` 直装）。
3. **可选**：README 顶部补 demo GIF（浏览器录屏 → ffmpeg 抽帧）、加 Star 徽章、向 awesome-deepseek-harness 清单提 PR。

---

## 附录 A — 契约复查命令速查（latest 前移日执行；上次核查 2026-09-16）

```sh
# 1) 版本态势
curl -s https://registry.npmjs.org/@deepseek-ai%2fdsh | grep -o '"latest":"[^"]*"'
# 2) 六项契约文件的近期改动（每条应输出「无改动」或经评估的非破坏 diff）
for p in \
  packages/client/tsdown.client.ts \
  packages/client/web/src/platform.ts \
  packages/client/ui-slots/README.zh.md \
  packages/client/modules/src/node/manifest.ts \
  packages/client/ui-conversation/src/client/apply.ts \
  docs/user/develop/basic/index.zh.md ; do
  echo "--- $p"
  curl -s "https://api.github.com/repos/deepseek-ai/deepseek-harness/commits?path=$p&since=2026-09-16T00:00:00Z&per_page=3" \
    | grep -o '"message": *"[^"]*"' | head -3
done
# 3) 关键字面比对（应用层最怕的两处）
curl -s "https://api.github.com/repos/deepseek-ai/deepseek-harness/contents/packages/client/tsdown.client.ts" \
  | grep -c "__ModuleLoader__"          # 应 ≥1
# 4) conversation.view 声明仍在
#    fetch apply.ts 后 grep "conversation.view"
```

判定标准：六项中任何一项的 diff 涉及——工厂包裹字面量、PLATFORM_MODULES 清单成员、`register/inject` 签名、`conversation.view` 槽位名、`dsh.client` schema 字段、`dsh plugin add` 命令形态——即视为潜在破坏，转入兼容性修复流程（对照本项目 `tsdown.config.ts`、`src/client/index.ts`、`package.json` 三处依赖点逐项适配，并升级 devDependencies 至新版本后全量回归）。

## 附录 B — 本项目对 dsh 的全部依赖点（适配时的改动面清单）

| 依赖点 | 文件 | 内容 |
|---|---|---|
| client 产物契约 | `tsdown.config.ts` | CJS + `__ModuleLoader__.load` 三段式包裹 + PLATFORM_MODULES external 清单 |
| 面板注册 | `src/client/index.ts` | `ctx.slots.inject('conversation.view', …)`、`ctx.locale`、type-only 导入五处 |
| manifest | `package.json` | `dsh.bundle.patch` + `dsh.client.{inject, platform}` |
| 安装路径 | README/本文档 | `dsh plugin --profile X add` + bundles 含 `@deepseek-ai/dsh-web-app` |
| 运行时值级依赖 | （无 `@deepseek-ai/*` 值级 import） | 仅 react 家族经模块表共享；其余全 type-only |
