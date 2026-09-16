# 「毛茸茸小院」实现方案

> 版本：v1.0 · 对应需求文档 v0.3（`docs/requirements.md`）
> 性质：可执行开发计划（技术选型 / 架构 / 关键设计 / 分阶段任务 / 风险对策）

---

## 0. 总览

### 0.1 一句话结论

插件实现为**一个标准 DSH 插件包**：浏览器半边（`src/client/`）注册一个槽位组件承载宠物院子；全部玩法规则在 **React-free 的纯逻辑内核**中实现并单测覆盖；持久化默认走**客户端 localStorage 整值存储**（保留升级到宿主侧 domain 存储的路径）；PNG 导出走**浏览器原生下载**（`ctx.fs` 变更操作仅支持文本，二进制写延期，不适用）。

### 0.2 阶段总览与里程碑映射

| 阶段 | 内容 | 产出里程碑 | 估算* |
|---|---|---|---|
| P0 | 工程骨架 + DSH 集成 spike | 联调通道打通 | 3 人日 |
| P1 | 领域内核（纯逻辑 + 全量单测） | — | 4 人日 |
| P2 | SVG 渲染 + 场景引擎骨架 | **M0 验收** | 5 人日 |
| P3 | MVP 交互闭环（锁定/起名/统计/档案卡/争宠基础版） | **M1 验收** | 6 人日 |
| P4 | 争宠全量 + 合影 + 图鉴 | **M2 验收** | 7 人日 |
| P5 | M3 选题池（心情/明信片/成就/昼夜…） | M3 | 按选题 |
| A（并行） | 美术素材流水线（占位 → 正式） | 贯穿 P2–P4 | 5–8 人日 |

\* 按一名熟悉 TypeScript/前端的开发全职估算，含自测。P0–P4 合计约 5 周出头。

### 0.3 工程原则

1. **core 层零 DOM、零 React** —— 全部规则（生成/唯一性/淘汰/统计）可在 node 下单测，不依赖浏览器。
2. **占位素材先行** —— 几何占位图形解锁全部逻辑开发，美术与逻辑并行（A 工作流）。
3. **魔数集中** —— 所有调参项进 `src/config.ts`（对应需求 §6 调参清单）。
4. **槽位无关的院子组件** —— `<PetYard>` 是自包含组件，尺寸感知全部基于自身容器的 `ResizeObserver`，换槽位零改动。
5. **schemaVersion 从第一天存在** —— 持久化 JSON 带版本与迁移函数。
6. **时间驱动** —— 到访判定只看 `lastSpawnAt` 与激活时刻，不信任 `setInterval`（面板经常被挂起，需求 §7）。

---

## 1. DSH 技术底座（调研结论）

以下事实已从 deepseek-harness 仓库（master 分支）源码与文档核实，是本方案的技术依据：

| # | 事实 | 出处 |
|---|---|---|
| 1 | 插件是导出 `apply(ctx)` 的 TS 模块，可声明 `inject` 依赖；本地经 `cordis.yml`（insert 清单，绝对路径）+ `dsh web --patch` 加载 | `docs/user/develop/basic/index.zh.md` |
| 2 | 浏览器端运行**独立的 client 侧 Cordis 插件树**；每个 UI 能力是一个插件包：`package.json` 声明 `dsh.client`，浏览器半边写在 `src/client/`，产物为 `lib/client.js`（tsdown client 预设同时产出 node 半边 `lib/index.js`） | `.agents/notes/.../2026-07-19-gui-web-client-architecture.zh.md` |
| 3 | UI 经 **slot 体系**组合：一次 `register({name, children?, store?, inject?, ...kind}, Component)` 向已声明 slot 贡献 React 组件；组件 props 由四个 share 自动推导，**不对渲染器做值 import** | `packages/client/ui-slots`，slot 体系标准笔记 |
| 4 | 外壳布局为三栏 AppFrame，声明 `sidebar` / `conversation` / `details` / `shell.overlay` 四个槽位；**details 面板可由用户拖拽缩放**，侧栏亦可缩放 | `packages/client/ui-layout` |
| 5 | client store 引擎（zustand vanilla + 草稿式更新）支持**整值 localStorage 持久化**，从 runtime 包 `./client` 出口导出 | web 客户端架构笔记 |
| 6 | 宿主侧持久存储为 `ctx.storageDomain`（zod schema 声明领域，读写原子、带 `domain/changed` 事件，json/sqlite 后端）——**host 侧服务**，浏览器访问需经生成的 Remote controller（Typert），参照 `api/settings-controller` 模式 | `docs/subsystems/storage.zh.md` |
| 7 | `ctx.fs` 的**变更操作只支持文本**（二进制写延期）——PNG 落盘不能走宿主 fs | `packages/fs/fs/README.zh.md` |
| 8 | dev 下 webserver 对自有 bundle 做 stat 轮询并广播 `rebuilt` SSE 帧，`client-hmr` 每帧换一个 fiber（热重载） | web 客户端架构笔记 |

### 1.1 三个关键落地决策

**① 面板落位（P0 已验证 ✓，详见 docs/p0-report.md）**

- **主面板落 `conversation.view`**（会话区视图 tab，与「对话」「轨迹」并列）。实测：tab 条在存在打开的会话时渲染；面板宽度跟随会话区容器，窗口/侧栏拖拽时自由缩放——"面板可自由缩放"基础成立。已知边界：无会话时整个视图 tab 条不渲染（内置 tab 亦然）。
- **常驻悬浮件落 `shell.overlay`**（additive 列表槽）。实测：注册成功，无会话时也渲染（`position: fixed`），适合后续的桌面宠物入口/状态胶囊。

`<PetYard>` 组件仍保持槽位无关（原则 4），换槽位是单行改动。

**② 持久化：默认 localStorage 整值存储，保留宿主升级路径**

- v1 用「单一 SaveDoc JSON 整值写 localStorage」：状态量级 KB 级，实现零宿主依赖，满足需求决策 #3 的"本地存储"。
- 升级路径（后续可选）：宿主半边声明 `pet-plugin` domain（zod）+ 生成 Remote controller 暴露给浏览器（settings-controller 同款模式），状态迁入 `$DSH_HOME`，抗"清浏览器数据"。持久化经 `persist.ts` 单点收口，替换实现不动业务层。
- 已知代价（记入风险表）：清除站点数据 = 宠物搬家；多标签页同时打开时 last-writer-wins。

**③ PNG 导出：浏览器原生下载**

SVG → 离屏 canvas 栅格化 → `Blob` + `<a download>` 落到用户下载目录。不涉及宿主 fs（事实 #7）。文件名示例：`档案卡_№0421_汤圆.png`、`合影_2026-08-28_第37次探望.png`。

### 1.2 P0 待验证项——已全部有结论（2026-08-28 实测，详见 docs/p0-report.md）

1. **树外 client 半边装载：可用。** 实际路径：`dsh plugin --profile <名> add <本地路径>`（pnpm link）→ 在 profile 的 `package.json` 中把 `@deepseek-ai/dsh-web-app` 加入 `dsh.profile.bundles`（置于本包之前）→ `dsh --profile <名>` 启动。**命令形态修正**：`dsh web --profile X` 不存在；`dsh plugin add` 创建的裸 profile 只含 `dsh-base`，不含 Web UI。
2. **面板槽位与缩放：** 见 §1.1 ①——conversation.view 宽度跟随会话区；shell.overlay 常驻可用。
3. **HMR：自动热替换可用。** 触发源是 bundle 文件变化（client-hmr stat 轮询），与构建方式无关——`tsdown --watch` 或手动 `npm run bundle` 均触发热替换；独立调参页（§3.9）保留但降级为补充（不打扰真实存档时仍有价值）。

---

## 2. 架构与目录结构

### 2.1 分层

```
┌─────────────────────────────────────────────────┐
│ src/client/ui/    slot 组件（HUD：菜单/头像条/      │  DSH slot 体系内的
│                   图鉴/统计/设置）——薄壳            │  React 面
├─────────────────────────────────────────────────┤
│ src/client/stage/ 舞台引擎（React-free：rAF 主循环· │  自包含，可挂进任意
│                   Actor·档位·聚光灯·导出）           │  容器，也可在独立
├─────────────────────────────────────────────────┤  调参页运行
│ src/core/         领域内核（纯函数：生成·唯一性·     │  node 可单测
│                   到访·统计）零 DOM 零 React         │
├─────────────────────────────────────────────────┤
│ src/client/persist.ts  SaveDoc 载入/保存（单点）     │
├─────────────────────────────────────────────────┤
│ src/index.ts      host 半边：空 apply（暂无宿主逻辑） │
└─────────────────────────────────────────────────┘
```

依赖方向严格单向向下；`core` 不依赖任何上层；`stage` 依赖 `core` 但不依赖 React/DSH。

### 2.2 目录树

```
dsh-plugin-fluffy-yard/
├─ docs/                      # requirements.md / implementation-plan.md（本文）
├─ package.json               # 声明 dsh.client；tsdown 双产物
├─ tsconfig.json
├─ cordis.yml.example         # 本地 patch 清单模板（绝对路径按环境填写）
├─ src/
│  ├─ index.ts                # host 半边（空 apply）
│  ├─ config.ts               # 全部调参常量（§6）
│  ├─ core/
│  │  ├─ types.ts             # Pet/Traits/Stats/SaveDoc 领域模型
│  │  ├─ rng.ts               # id → 种子 → 可复现随机流（xfnv1a + mulberry32）
│  │  ├─ traits.ts            # 特征生成·组合 key·历史唯一·轮回
│  │  ├─ namer.ts             # 自动起名（猫/狗音节池）
│  │  ├─ spawn.ts             # 到访/淘汰/全锁定暂停/离线补算
│  │  ├─ stats.ts             # 探望/streak 统计
│  │  └─ passion.ts           # 热情度推导与三档性格映射
│  ├─ client/
│  │  ├─ index.ts             # client 半边入口：slot 注册 <PetYard>
│  │  ├─ yard.ts              # <PetYard> 组件：容器 + 引擎挂载 + HUD 组合
│  │  ├─ stage/
│  │  │  ├─ engine.ts         # rAF 主循环·actor 生命周期·档位事件·合帧
│  │  │  ├─ actor.ts          # 单只宠物行为状态机 + 走位
│  │  │  ├─ actions.ts        # 动作定义（时长/循环/性格权重表）
│  │  │  ├─ tiers.ts          # 档位计算与分档策略（宽裕→极小）
│  │  │  ├─ spotlight.ts      # 聚光灯轮换·点名·冷场
│  │  │  ├─ reactions.ts      # 缩放跨越反应·矮窗躺平
│  │  │  └─ photoSession.ts   # 合影召回模式
│  │  ├─ render/
│  │  │  ├─ palette.ts        # 毛色 → {base, dark, light} 三阶色数据
│  │  │  ├─ parts/            # SVG 形状素材（无色，分图层）
│  │  │  ├─ petSprite.ts      # traits → 分层 <g> 组装
│  │  │  ├─ cardRender.ts     # 档案卡离屏渲染（540×720）
│  │  │  └─ pngExport.ts      # SVG → canvas → Blob → 下载
│  │  ├─ ui/                  # InteractMenu/AvatarBar/Archive/StatsPanel/
│  │  │                       # Settings/Toast（slot 组件，薄壳）
│  │  ├─ persist.ts           # SaveDoc localStorage 读写 + debounce + 迁移
│  │  └─ debug.ts             # ?debug=1 调试面板
│  └─ shared/                 # 跨半边纯类型
├─ dev/                       # 独立调参页（vite，仅引 core+stage，不依赖 DSH）
│  ├─ index.html              #   可拖拽改变容器宽高的测试台
│  └─ main.ts
└─ tests/                     # vitest：core 规则全覆盖 + 压力模拟
```

### 2.3 运行时数据流

```
面板挂载/可见 ──► persist.load() ──► store(SaveDoc)
      │                                   │
      ▼                                   ▼
 engine.start(container)            core 补算（离线到访/探望统计）
      │                                   │
      ▼                                   │
 ResizeObserver ──► 档位事件 ──► Actor 行为切换        │
      │                                   ▲          │
      ▼                                   └── 用户操作（锁定/重命名/设置）
 rAF tick：Actor 动作·聚光灯计时·到访检查 ──► store 变更 ──► debounce 保存
```

- HUD 订阅 store 的不可变快照（uSES 模式），引擎每帧只写 DOM transform/class，不进 React 渲染路径。
- 到访检查：引擎内每 30s 比对 `now - lastSpawnAt ≥ interval`（rAF 内低成本轮询，不依赖 setInterval）。

---

## 3. 关键技术设计

### 3.1 持久化（persist.ts）

- 单键 `dsh-plugin-fluffy-yard/state`，结构即需求 §5 的 SaveDoc，外加 `schemaVersion`、`idCounter`、`cycle`。
- 写入时机：变更后 debounce 2s；`visibilitychange`→hidden 立即保存；导出合影等关键动作后立即保存。
- 载入：`migrate(doc)` 版本链；校验失败则把原文备份到 `.../state.broken` 后重置（不静默丢弃）。
- **与需求 §5 注的差异（有意为之）**：traits/热情度/默认名**出生时即持久化**，而非每次由 id 重推导。原因："组合冲突重摇"使推导依赖生成时刻的 `usedCombos` 历史，纯 id 推导不可复现；持久化后图鉴永不失效。id 仍是种子来源与唯一真相源。

### 3.2 时间驱动到访（core/spawn.ts）

- 激活时（面板挂载或从不可见→可见的当日首次）：`elapsed = now - lastSpawnAt`；`elapsed ≥ interval` → 到访 1 只（离线上限，需求 §3.1），`lastSpawnAt = now`；补到访的入场气泡用"它在门口等你很久啦"。
- 面板持续可见期间由引擎轮询触发；离线时长再多也只补 1 只。
- 全 5 只锁定时暂停（返回暂停原因），解锁后自动恢复；淘汰目标 = 到场最早的**未锁定**宠物；被解锁宠物按原 `arrivedAt` 重新排队。

### 3.3 Seeded RNG、唯一性与轮回（core/rng.ts, traits.ts, passion.ts）

```
id = "p_" + padStart(idCounter, 6)        // idCounter 持久化自增
seed = xfnv1a(id) → mulberry32 随机流
derivePet(id):
  依次摇 species→body→ears→fur→pattern→tail→eyes→accessory(低概率)→passion(0–100)
  comboKey 命中 usedCombos → 同流继续摇下一组，最多 2000 次
  2000 次未中 → cycle+1，usedCombos 清空，本只标记 cycle（图鉴显示"二世"+星标）
  defaultName = namer(id, species)
```

- passion 阈值 ≥60 / 20–59 / <20 对应热情/淡定/高冷，均匀分布下天然得到 40%/40%/20%（需求 §3.7）。
- 单测断言：同 id 确定性；抽样 1 万次分布误差 <2%；从空档连生成 N 只组合互异；缩小池强制耗尽后正确进入轮回。

### 3.4 SVG 参数化素材（render/）

**形状与颜色分离**是美术量压缩的关键：

- 形状素材（无色，fill 用 CSS 变量 `--fur-base/--fur-dark/--fur-light`）：猫/狗 × 3 体型 = 6 身体；4 耳型（按物种微调）≈ 6；4 尾巴；5 花纹 overlay；1 眼型（瞳色为 fill）；3 配饰。**约 25 个 path 素材覆盖全部 14,400 组合。**
- 颜色纯数据：`palette.ts` 定义 10 毛色 → 三阶色；花纹用 dark/light 阶；眼色 4 种 fill；异瞳 = 左右眼不同 fill。
- 每只宠物 = 一个 `<g class="pet">`，图层顺序：尾巴→身体→花纹→耳朵→眼→配饰→徽章（锁/皇冠）。
- 动画纪律：外层 `<g>` 走位用 `transform`（CSS transition）；动作（跳/滚/躺平…）在内层 `<g>` 切换 CSS keyframes class；**永不重建 DOM，只改 transform/class**。
- 深浅主题：院子配色消费 DSH 主题 token（`--dsh-*` 变量），避免夜间模式下的违和感。

### 3.5 档位引擎（stage/tiers.ts, engine.ts）

```
slots = floor(容器宽 / CELL_W)            // CELL_W = 140，config.ts
tier(容器宽, 在场数):
  容器宽 < MIN_STAGE_W(120)  → 极小（大眼睛窥视 / Q弹压扁）
  slots ≥ 在场数             → 宽裕
  slots ≥ 3                  → 拥挤（靠拢站位；热情者边缘探头/撞肩）
  slots == 2                 → 狭小（卡位死守/冲刺抢位）
  其余（slots ≤ 1）          → 聚光灯（见 3.6）
```

- `ResizeObserver` 监听 PetYard 自身容器；**rAF 合帧**后判定，拖拽过程中不逐事件判定。
- `tierChanged(from, to)` 事件 → reactions：缩小跨越 = 热情者惊跳"！" / 淡定抬头 / 高冷抖耳；放大跨越 = 热情者欢呼回场 / 其他溜达回场。
- 在场数变化（到访/离场）同样触发重判；矮窗（高 < 160）触发全员躺平彩蛋。

### 3.6 争宠与聚光灯（stage/spotlight.ts）

- spotlight 持有 `currentPetId / remainMs`；**计时用引擎活跃时间**（页面不可见即暂停，回来续算，避免"看不见却轮换了"）。
- 轮换：计时归零 → 从热情者（≠现任）随机挑挑战者 → 撞飞序列（冲刺→现任打滚出场"哇！"→新任昂首臭美）；无热情者 → 冷场模式（舞台空/被淡定者占着打盹，首次进入 toast 一次"今天大家都有点懒得营业……"）。
- 现任为淡定/高冷被挑战：不还手让位；锁定宠物上台 30s（×2）并戴皇冠。
- 点名（P4）：`spotlight.summon(petId)` 无视性格立即顶替；高冷慢吞吞挪 + 头顶"……"。
- 仅一只热情者：低频随机"下台溜达再杀回马枪"。

### 3.7 导出管线（render/cardRender.ts, pngExport.ts）

- **档案卡**：540×720 SVG 模板（卡底/立绘槽/文字槽：名字·编号№·特征标签·性格·相遇日期）；立绘用**完整尺寸离屏组装**，与当前档位无关（需求 §3.5）；SVG → Blob URL → Image → canvas → `toBlob('image/png')` → 下载。
- **合影**：`photoSession.begin()` → 全体（含边缘探头者）召回中心挤成一团 → 稳定 800ms → 序列化舞台 SVG 克隆 + 水印（日期 + "第 N 次探望"）→ 导出 → `end()` 各回各位 → `photosTaken++`。
- 序列化前 `document.fonts.ready`，保证 SVG text 字体就绪。

### 3.8 统计（core/stats.ts）

- "一次探望" = 自然日内首次**面板可见**（挂载或从不可见→可见的首次），按**本地时区**判定日期。
- streak：昨天有记录 → +1；今天已记 → 不变；否则 → 1；同步维护 longestStreak；另记累计打开次数。
- 边界单测：同日重复打开、跨月/跨年连续、断档重置。

### 3.9 测试与调参基础设施

- **vitest 单测**（`tests/`）：rng 确定性与分布、组合唯一与轮回、淘汰排序（锁定/解锁重排队/全锁定暂停）、离线补算上限、streak 边界、档位计算表、`?debug` 之外的全部 core 规则。
- **面板内 debug 调参模式**（v1.2 起，替代独立调参页）：`?debug=1` 或院角小齿轮唤出——宽度/高度滑块实时约束舞台（档位/矮窗调参）、立即到访/时间快进、演示存档注入、状态快照导出、存档重置。P0 已验证 HMR 自动热替换，无需独立 vite 构建路径。
- **?debug=1 调试面板**（打进插件，默认隐藏）：立即到访 / 时间快进 N 分钟 / 强制档位 / 强制性格生成 / 导出状态 JSON / 重置存档。**没有它，30 分钟间隔与 ~8% 的冷场概率几乎无法验收**——是特色机制的验收基础设施。

---

## 4. 分阶段任务清单

> 每任务：内容 · 主要落点 · 规模（S<半天 / M=1 天 / L≥2 天）。阶段末尾为验收门。

### P0 工程骨架与 DSH 集成 spike（≈3 人日）

| # | 任务 | 落点 | 规模 |
|---|---|---|---|
| P0-1 | 按插件包规范初始化仓库：`package.json`（`dsh.client` 声明）、tsdown 双产物（`lib/index.js` + `lib/client.js`）、tsconfig、`cordis.yml.example` | 根目录 | S |
| P0-2 | Spike：树外插件 client 半边装载——参照 `ui-trajectory`（最小样板：仅视图 slot 注册，无服务）注册一个空组件；确认产物经 `/plugins/<id>/client.js` 到达浏览器；记录 HMR 可用性 | `src/client/index.ts` | L |
| P0-3 | Spike：面板落位三选一（details / conversation.view / sidebar+overlay），标准：可自由缩放 + 常驻可见；结论回填 §1.1 并修订 `<PetYard>` 挂载点 | `src/client/yard.ts` | M |
| P0-4 | 持久化与导出通道验证：localStorage 整值 roundtrip（含 schemaVersion 迁移骨架）；canvas→Blob→`<a download>` 落盘一张测试 PNG | `persist.ts`, `pngExport.ts` | M |
| P0-5 | vitest 脚手架 + 首个 core 冒烟测试 | `tests/` | S |

**验收门**：真实 `dsh web` 中打开宠物空面板（占位 UI）；刷新后 localStorage 数据仍在；能下载测试 PNG。§1.2 三个待验证项全部有结论。

### P1 领域内核（≈4 人日，纯逻辑无 UI）

| # | 任务 | 落点 | 规模 |
|---|---|---|---|
| P1-1 | 领域模型与 SaveDoc（含 `schemaVersion`/`idCounter`/`cycle`） | `core/types.ts` | S |
| P1-2 | seeded RNG + `derivePet` 全推导（特征/热情度/默认名一体） | `core/rng.ts`, `passion.ts` | M |
| P1-3 | 历史唯一与轮回（comboKey/usedCombos/2000 次重摇/cycle 标记） | `core/traits.ts` | M |
| P1-4 | 自动起名器（猫/狗风格音节池） | `core/namer.ts` | S |
| P1-5 | 到访/淘汰/全锁定暂停/解锁重排队/离线补 1 只 | `core/spawn.ts` | M |
| P1-6 | 探望/streak/longestStreak 统计 | `core/stats.ts` | S |
| P1-7 | 全量单测（§3.9 清单）+ 压力模拟：从空档模拟 1000 次到访，断言无超员/无重复组合/不淘汰锁定者 | `tests/` | M |

**验收门**：单测全绿；压力模拟通过。

### P2 场景与渲染骨架（≈5 人日）→ **M0 验收**

| # | 任务 | 落点 | 规模 |
|---|---|---|---|
| P2-1 | 素材规范定稿（viewBox/锚点/三阶色变量/图层顺序）+ 几何占位素材 + palette 数据 | `render/parts`, `palette.ts` | M |
| P2-2 | `petSprite` 分层组装 + 三阶调色 | `render/petSprite.ts` | M |
| P2-3 | ~~独立调参页~~ → **面板内 debug 调参模式**（宽度/高度滑块 + 演示存档注入；P0 已验证 HMR 自动热替换可用，无需维护双构建路径。v1.2 调整） | `client/debug.ts` | M |
| P2-4 | 舞台引擎：rAF 主循环、actor 挂载/卸载、走位系统、动作调度器（性格权重表） | `stage/engine.ts`, `actor.ts`, `actions.ts` | L |
| P2-5 | 基础动作集：待机呼吸/踱步/跳/打滚/坐/打盹 ZZZ（CSS keyframes） | `stage/actions.ts` | M |
| P2-6 | 档位计算 + `tierChanged` 事件 + 矮窗躺平 | `stage/tiers.ts`, `reactions.ts` | M |
| P2-7 | 入场/离场动画 + 名字气泡（含离线补访文案）；告别即入图鉴数据 | `stage/actor.ts` | M |
| P2-8 | `?debug=1` 调试面板（立即到访/快进/强制档位/状态快照/重置） | `client/debug.ts` | M |
| P2-9 | 接通真实链路：面板挂载 → 载入 → 补算 → 引擎呈现；DSH 主题 token 接入 | `yard.ts`, `persist.ts` | S |

**验收门（= 需求 M0）**：调参页与真实 DSH 面板中均能看到宠物换班——到场（边缘跑入 + 名字气泡）、定时轮换、离场（挥手渐隐）；拖拽容器时档位切换与即时反应日志正确。

### P3 MVP 闭环（≈6 人日）→ **M1 验收**

| # | 任务 | 落点 | 规模 |
|---|---|---|---|
| P3-0 | **美术风格系统**（v1.3 新增，用户决策 #11）：几何简笔形象转正为可选风格 `geo`，注册表架构（`STYLE_REGISTRY`）+ `Settings.artStyle`；**调参台宽/高增加数值精确输入**（用户决策） | `render/styles.ts`, `client/debug.ts` | M |
| P3-1 | 点击命中（SVG hit-test）→ 互动菜单：摸摸/看档案/锁定解锁/重命名 | `ui/interactMenu.ts`, `stage/engine.ts` | M |
| P3-2 | 锁定徽章常驻 + 全锁定暂停提示（toast + HUD 后缀）；解锁按原到场时间重排队（UI 反馈） | `ui/` + `core` | S |
| P3-3 | 头像条：≤5 圆头像（风格注册表迷你立绘）、锁定/持有者角标、点击打开互动菜单（无需宠物当前可见，需求 §3.7 交互保障） | `ui/avatarBar.ts` | M |
| P3-4 | 争宠基础版：热情者聚光灯轮换 15s（锁定 30s + 👑）+ 撞飞/臭美编排 + 拥挤/狭小档贴边探头与热情冲挤 + 冷场基础版（无热情者舞台空置） | `stage/spotlight.ts` | L |
| P3-5 | 档案卡离屏渲染 + PNG 导出（编号№/特征标签/性格/相遇日期/风格名） | `render/cardRender.ts`, `render/labels.ts` | M |
| P3-6 | 探望统计面板（总次数/日志/连续天数/相遇总数） | `ui/panels.ts` | S |
| P3-7 | 设置页（到访间隔 10min–24h + **美术风格切换**）+ toast 系统 | `ui/panels.ts`, `ui/toast.ts` | S |
| P3-8 | 卖萌动作集：转圈/追尾/伸懒腰/舔毛/歪头（性格权重已就绪）+ P3 全部 UI 样式 | `stage/actions.ts` | M |
| P3-9 | 真机回归 + 调参第一轮（格位宽度/动作频率/轮换时长观感） | `config.ts` | S |

**验收门（= 需求 M1）**：需求 §8 M1 全项真机跑通——特征生成与历史唯一、锁定、基础动作、自动起名/重命名、基础响应式与争宠基础版、档案卡导出、探望统计。

### P4 争宠全量 + 合影 + 图鉴（≈7 人日）→ **M2 验收**

| # | 任务 | 落点 | 规模 |
|---|---|---|---|
| P4-1 | 三档热情度全量行为：淡定/高冷档内差异（退让/边缘趴/背对镜头）+ 冷场模式（舞台空或淡定者占台打盹/哈欠传染/一次性提示/热情者到场即恢复） | `stage/` | M |
| P4-2 | 狭小档卡位死守/冲刺抢位；极小档大眼睛窥视/Q弹压扁 | `stage/tiers.ts` | M |
| P4-3 | 点名系统（头像点击上台，性格差异化移动 + "……"） | `spotlight.summon` | S |
| P4-4 | 实时缩放反应全量（缩小：热情惊跳"！"/淡定抬头/高冷抖耳；放大：热情欢呼转圈、不热情慢回场）——锁定 30s 与皇冠已随 P3 提前完成（v1.4 注） | `stage/engine.ts` | M |
| P4-5 | 合影模式：全员召回挤成一团 + 水印（日期 + 第 N 次探望）+ 导出 + 各回各位 | `stage/photoSession.ts` | M |
| P4-6 | 图鉴/相册页：相遇一览（缩略立绘/名字/相遇与告别日期/轮回"二世"标记）+ 回看完整档案卡 | `ui/Archive` | M |
| P4-7 | 真机回归 + 调参第二轮（轮换时长/性格分布观感） | `config.ts` | S |

**验收门（= 需求 M2）**：特色玩法（分档全表/聚光灯/冷场/点名/实时反应）与收藏闭环（合影/图鉴/档案卡）成立。

### P5 M3 里程碑（v1.5 定稿：心情 + 明信片 + 成就 + 昼夜/天气 + P4 遗留修复）

| # | 任务 | 落点 | 规模 |
|---|---|---|---|
| P5-1 | 心情系统：`Pet.mood?`（0–100 加性字段）、探望/合影提升、离线衰减、心情×昼夜驱动的动作权重、高心情淡定者争宠加演 | `core/mood.ts` 等 | M |
| P5-2 | 明信片：离开满 3 天确定性推导文案、图鉴 📮 归档与弹窗、新到 toast | `core/postcard.ts` | M |
| P5-3 | 成就系统：14 项定义 + 纯评估器 + 目睹旗标 + 🏆 面板 | `core/achievements.ts` | M |
| P5-4 | 昼夜/天气：本地时间三段配色、夜晚打盹加成、10% 雨天覆盖层 | `client/dayNight.ts` | M |
| P5-5 | P4 遗留：`PHOTO_TIMEOUT_MS` 3000→5000；缩放反应后延迟 600ms 重排（可见性） | `config.ts`、`engine.ts` | S |
| P5-6 | 宠物间互动/礼物架/粒子/音效仍为 P6 选题池（本阶段不做） | — | — |

### A 美术素材流水线（并行，5–8 人日）

| # | 任务 | 时点 |
|---|---|---|
| A-1 | 素材规范定稿（与 P2-1 同步：viewBox/锚点/三阶色/图层顺序文档） | P2 前 |
| A-2 | 几何占位素材（供逻辑开发，即 P2-1 交付物） | P2 |
| A-3 | 正式线稿 + 上色：身体×6 → 耳/尾/花纹/眼/配饰（~25 素材） | P2–P3 间 |
| A-4 | 动作 keyframes 调优、档案卡版式设计 | P3–P4 |
| A-5 | 整体氛围：草地/院子背景、气泡/徽章/HUD 素材 | P4 |

正式美术以**并列风格 `real` 注册进 `STYLE_REGISTRY`，不替换 `geo`**——几何简笔已是长期可选风格（用户决策 #11）；切换零代码改动（风格 = 数据驱动注册表）。

---

## 5. 风险与对策

| # | 风险 | 影响 | 对策 |
|---|---|---|---|
| 1 | ~~树外插件 client 半边装载链路~~ | — | **P0 已验证可用**（profile add + bundles 含 dsh-web-app），风险消除 |
| 2 | ~~面板槽位不满足"自由缩放"~~ | — | **P0 已验证**：conversation.view 宽度跟随会话区；shell.overlay 常驻可用，风险消除 |
| 3 | 清除浏览器站点数据 = 宠物搬家 | 用户数据丢失 | 风险明示（设置页提示）；P5 提供宿主侧 domain 存储迁移路径 |
| 4 | 多标签页同开导致双仿真/双生成 | 状态分叉 | v1 接受 last-writer-wins 并记录；如需修复加 BroadcastChannel 单写者租约（P5 选题） |
| 5 | webview 挂起 rAF 停转 | 到访停摆/计时漂移 | 全部时间逻辑时间驱动（§3.2）；聚光灯用活跃时间（§3.6）；hidden 即保存 |
| 6 | 拖拽 resize 事件风暴 | 卡顿 | ResizeObserver + rAF 合帧（§3.5） |
| 7 | 素材工作量/质量失控 | 延期、观感差 | 形状×颜色分离（25 素材覆盖全组合，§3.4）；占位先行解耦（A 工作流） |
| 8 | 冷场/热情度等低频分支难验收 | 特色机制质量 | debug 面板强制性格/立即到访/时间快进（§3.9） |
| 9 | 存档结构演进 | 升级损坏 | schemaVersion + 迁移链 + 失败备份（§3.1） |
| 10 | 远期组合耗尽（14,400） | 唯一性失效 | 轮回机制 P1 即实现（成本低，晚做风险大） |

---

## 6. 调参常量（`src/config.ts` 初始值）

| 常量 | 初始值 | 说明 |
|---|---|---|
| `CELL_W` | 140px | 舒适格位宽度（需求 §3.7） |
| `MIN_STAGE_W` | 120px | 极小档阈值 |
| `FLATTEN_H` | 160px | 矮窗躺平阈值 |
| `ROTATE_MS` | 15000 | 聚光灯轮换周期 |
| `ROTATE_LOCKED_MS` | 30000 | 锁定宠物上台时长 |
| `SPAWN_INTERVAL_DEFAULT` | 30min | 到访间隔（可配 10min–24h） |
| `OFFLINE_SPAWN_CAP` | 1 | 离线补访上限 |
| `ACCESSORY_RATE` | ~15% | 配饰出现率 |
| `MAX_PETS` | 5 | 在场上限 |
| `SAVE_DEBOUNCE_MS` | 2000 | 持久化防抖 |
| `PHOTO_SETTLE_MS` | 800 | 合影召回稳定等待 |

全部对应需求 §6"开发期调参项"，改这里不动逻辑。

---

## 7. 与需求文档的差异与澄清

| # | 差异/澄清 | 理由 |
|---|---|---|
| 1 | traits/热情度/默认名**出生时持久化**（需求 §5 注：只存 id） | 冲突重摇使纯 id 推导依赖生成时刻的 usedCombos，不可复现；持久化后图鉴永不失效（§3.1） |
| 2 | 聚光灯轮换计时用**活跃时间**而非墙钟 | 页面不可见时不轮换，符合"看着它演"的体验（§3.6） |
| 3 | 持久化默认 localStorage 而非宿主 domain 存储 | 领域存储是 host 侧服务，浏览器访问需 Typert Remote controller 全套机制；v1 无必要，升级路径保留（§1.1） |
| 4 | PNG 导出走浏览器下载而非宿主 fs | `ctx.fs` 变更操作仅支持文本（调研事实 #7） |
| 5 | "打开面板"（探望判定）= 自然日内首次**面板可见** | DSH 面板可能常驻挂载；以可见性为准更贴合"来看望"语义（§3.8） |
| 6 | 卖萌动作集、头像条归入 M1（P3）；点名上台按需求归 M2（P4） | 前者是"性格影响日常"的最低呈现且成本低；后者依赖聚光灯全量 |

---

## 8. 变更记录

- **v1.9**：复核 + 本地冒烟（2026-09-16，npm latest 已前移至 0.1.5-rc.1）：六项契约复核仍全部一致；升级全局 CLI 至 0.1.5-rc.1 后走 tarball 安装路径（`dsh plugin --profile petsmoke add`）实测——插件 manifest 正确识别、client.js 经 `??` 批量 URL 伺服 200（工厂包裹逐字完好；单路径 404 属新版正常行为）、「宠物小院」标签出现且面板完整渲染，日志零报错 → §6 profile-a 门槛通过。R1 加固落地（LICENSE/README/CI/package.json 元数据 0.1.0）。详见 `docs/github-release-plan.md` v1.1。
- **v1.8**：兼容性核查（2026-09-01，npm latest 仍为 0.1.1-rc.2；0.1.2-alpha.3 已核对六项契约全部一致——工厂包裹/平台模块表/slot API/conversation.view/manifest schema/安装命令）→ 结论无破坏性更新，进入 GitHub 发布路线；方案见 `docs/github-release-plan.md`（R1 仓库加固 / R2 版本化与 tarball / R3 远端发布 / 双版本 smoke 门槛 / 附录 A 上游复查清单 + 附录 B 依赖点改动面）。
- **v1.7**：P6 定稿（用户决策，需求 v0.5）：场景家具（墙/窗/沙发/桌 + 位置比例布局 + 窄舞台降级）、吃喝系统（食盆份数/点击添食/水碗无限 + eat/drink 动作 + 粒子）、宠物互动三式（贴贴/追逐/玩球）、粒子系统（爱心/碎屑/水滴/闪光）、昼夜手动切换按钮（auto 循环，localStorage 偏好）。手册：`docs/p6-execution-plan.md`。
- **v1.6**：A 工作流正式激活——最终版美术以并列风格 `real` 实施（`docs/art-execution-plan.md`），lift「不注册 real」的临时禁令；lift 后 `geo` 仍是并列可选风格（决策 #11 不变）。
- **v1.5**：P4 验收（M2 通过，109/109）后定稿 P5 = M3 里程碑：心情/明信片/成就/昼夜天气四项 + P4 两遗留修复（合影超时、缩放反应可见性）；宠物互动/礼物架/粒子/音效留 P6。
- **v1.4**：P3 验收（M1 通过，95/95）后进入 P4——P4-4 的锁定 30s/皇冠已随 P3 提前落地，P4 只补实时缩放反应全量；另按需求 §3.7 把头像点击语义改为「点名上台」（⋯ 打开菜单），并纳入 P3 遗留 #2（暂停 toast 优先级）修复。
- **v1.3**：P2 验收（M0 通过）后的用户决策落地——新增 P3-0 美术风格系统：几何简笔形象转正为可选风格 `geo`（`STYLE_REGISTRY` 注册表 + `Settings.artStyle`，需求决策 #11），最终版美术以并列风格 `real` 接入；调参台常驻并增加宽/高数值精确输入；P3 任务表相应更新（P3-4 扩为含冷场基础版与贴边探头）。
- **v1.2**：P1 验收后调整——P2-3 独立调参页改为面板内 debug 调参模式（P0 已验证 HMR；宽度/高度滑块覆盖档位调参需求，避免 vite 双构建路径）。
- **v1.1**：P0 验收后回填——§1.1 ① 面板落位定为 conversation.view（主面板）+ shell.overlay（常驻悬浮件）；§1.2 三个待验证项全部转为已验证结论（含"profile bundles 需含 dsh-web-app"的命令形态修正）；风险表 1/2 标记消除。
- **v1.0**：首版。基于 deepseek-harness master 分支源码调研（插件装载/slot 体系/布局/存储/fs/客户端架构六处出处见 §1）确立技术形态；P0–P5 + 美术流水线分阶段任务清单；风险对策与调参常量表。
