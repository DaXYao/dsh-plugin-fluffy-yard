# P2 执行报告

- 日期：2026-08-30
- 执行环境：Windows 10.0.22631 / node v24.19.0 / vitest 4.1.11 / tsdown 0.22.14 / dsh 0.1.1-rc.2（`dsh --profile pets --port 3081`）

## 检查点结果

| 检查点 | 结果 | 备注 |
|---|---|---|
| CP1 渲染层 | ✅ | sprite 测试 7 用例（三阶调色注入 / clipPath uid 隔离 / 异瞳双色 / 配饰 / 花纹 --fur-light 计数 / 50 组合抽样 / bodyGeom 递增） |
| CP2 档位 | ✅ | tiers 测试 8 用例（五档判定 / 空场 / slotsFor 边界 / 标签表） |
| CP3 动作系统 | ✅ | actions.ts 落地（8 动作时长表 / 性格权重表 / pickAction / STAGE_CSS 幂等注入），typecheck 通过 |
| CP4 引擎 | ✅ | actor.ts + engine.ts 落地；1 处模板缺陷修正（见偏差 #3）后全绿 |
| CP5 接线 | ✅ | yardController.ts + debug.ts + PetYardView.tsx 薄壳；typecheck + 74/74 + bundle 通过 |
| CP6 M0 验收 | ✅ | 11 项全部通过（逐项见下），console/服务端零报错 |

## 测试统计

```
Test Files  9 passed (9)
     Tests  74 passed (74)     ← P1 的 59 + 新增 sprite 7 + tiers 8
  Duration  ~390ms
```

## M0 验收记录

1. **原位淡入 ✓**：打开宠物小院 tab → 草地/天空场景渲染，此前存档的 5 只宠物在槽位淡入（名字牌/🔒 徽章/睡眠 ZZZ 全部正确；期间离线补算还自动发生：最早未锁定者被淘汰、新 pet 从边缘跑入——离线链路顺带实证）。
2. **入场动画 ✓**：「立即到访」→ 新宠物从右缘跑入（截图捕获半程），头顶弹出气泡「你好呀，我是…」，HUD 在场 1/5。
3. **满员淘汰 ✓**：满员后第 6 访 → 最早者告别气泡「…再见啦…」→ 走向边缘 → 渐隐（opacity 0）→ HUD 已相遇 6、在场保持 5/5；动画结束后 DOM 节点被移除（偏差 #3 修复后实测）。
4. **定时轮换路径 ✓**：「快进一个间隔」→ 立即到访（豆瓜入场问候 + 小蓉告别），下次到访倒计时重置 29:59。
5. **档位切换 ✓**：宽 600→1400→280→200→100 → HUD 依次「拥挤→宽裕→狭小→聚光灯→极小」，每次跨越 console 输出 `[pet-yard] tier: X → Y`（逐条捕获），宠物间距随宽度收窄。
6. **矮窗躺平 ✓**：高 100 → 5/5 actor 挂 `.py-flatten`，console `flatten: on`；「恢复跟随面板」后还原。
7. **点击反馈 ✓**：点宠物 → 气泡「喵～」+ `py-jump` 立即挂上（同步探针证实）。注意：若点击瞬间宠物正在走路，移动逻辑会同帧把 jump 覆盖回 walk（V12 级视觉小癖，见遗留 #3）。
8. **持久化 ✓**：F5 → 在场/已相遇/HUD 全保留，5 只原位淡入，debug 面板可见性也随 localStorage 恢复。
9. **状态快照 ✓**：下载事件触发；localStorage 中同源 v2 文档结构核对完整（10 个键、pets 5、archive 2、usedCombos 7、schemaVersion 2）。
10. **演示存档 ✓**：5 只新宠物从边缘陆续入场（问候气泡正常），旧 5 只渐隐离场并被移除。
11. **console 无报错 ✓**：error/rejection 捕获器全程为空；`dsh` 终端零 fiber 报错。

## 视觉微调记录（V12）

无（部件几何、keyframes、时长、权重、颜色均照抄模板，零微调）。

## 偏差与决策树使用记录

1. **模板遗漏（补常量）**：CP2 `tiers.ts` 引用 `CELL_W`，但 CP1 的追加常量清单没有它。按测试"格位数 = floor(宽/140)"与 implementation-plan §3.5 语义，在 `src/config.ts` 追加 `export const CELL_W = 140`（带注释说明来源）。属于"config 只允许追加"规则内的必要扩充，记入偏差。
2. **PetYardView 覆写说明**：文件在执行期间被外部加入过一行 `@autodoc:purpose` 注释；按手册"整文件覆写"以 P2 模板替换（P1 冒烟面板整体退役，其能力由舞台 + 调参台承接）。
3. **模板缺陷修正（engine.ts，D1 规程）**：V9 法典规定离场时间线为"挥手→走向边缘→渐隐→**移除**"，但模板 `start()` 循环只把 done actor 从数组过滤、从未移除其 SVG 节点（DOM 泄漏，实测 p_000001 渐隐后永久残留）。修复：过滤时同步 `actor.root.remove()`。状态机语义零改动，是对"移除"二字的忠实实现；修复后重刷 + 演示存档两条路径实测节点正常消失。
4. **浏览器自动化方式**：沿用 P0/P1 的 dom_cua/PointerEvent 派发路径（该应用对 Playwright role 引擎不可点击）；console.info/error 拦截器在每次页面重载后重新注入。

## 遇到的报错与处置

1. `TS` 无新增报错（CP1 起全程一次通过；CELL_W 缺失会在 tiers.ts 编译期暴露，属预期内模板遗漏，见偏差 #1）。
2. 运行时缺陷：离场完成的宠物 DOM 节点残留（截图+节点清点证实）→ 见偏差 #3，修复并实测验证。
3. 点击跳跃两次未观察到 → 非缺陷：一次是点击目标正在走路（移动逻辑同帧覆盖 jump），一次是断言时机问题；同步探针（dispatch 后立即读 class）证实 `py-action py-jump` 即时生效。

## 遗留问题 / 待用户决策

1. **walking 覆盖 jump**：点击行走中的宠物只有气泡没有跳跃。若想"点击必跳"，可在 poke 时把 pet 临时定住（改 scheduleNext/移动优先级）——属 P4 手感打磨范畴，待定。
2. **1080p 以下窄面板**：宠物小院 tab 在窄窗口下舞台随之变窄，档位自动降级（设计行为）；真实小窗体验建议在 P4 全量分档行为时再评估。
3. **pets profile 仍在 3081 后台运行**（含 demo 存档 5 只），可直接打开体验；你自己的 3080 内置 web profile 未动。若要日常 `dsh web` 自带插件，仍需方式 B（`npx @deepseek-ai/dsh plugin --profile web add E:/dsh-plugin-pet`）。
4. **P2 改动未提交 git**，需要时按前例提交。
