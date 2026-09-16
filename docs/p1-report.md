# P1 执行报告

- 日期：2026-08-30
- 执行环境：node v24.19.0 / vitest 4.1.11 / tsdown 0.22.14 / typescript ^6（同 P0 环境）

## 检查点结果

| 检查点 | 结果 | 备注 |
|---|---|---|
| CP1 类型与常量 | ✅ | `src/config.ts` + `src/core/types.ts` 落地，typecheck 通过 |
| CP2 RNG | ✅ | 7 用例（可复现性/散列质量/int/pick/chance/rngFrom） |
| CP3 特征/起名 | ✅ | traits 17 用例 + namer 4 用例。10,000 id 分布实测：猫 4907 / 狗 5093；热情 4102 / 淡定 3946 / 高冷 1952；配饰率 15.16%（全部落在手册区间） |
| CP4 到访/淘汰 | ✅ | 13 用例（时钟判定/首访/满员淘汰/锁定跳过/解锁重排/未满员不暂停/满员全锁定暂停/轮回避让/id 形态） |
| CP5 统计 | ✅ | 9 用例（自然日键跨月跨年/首访/同日再开/连续/断档重置/最长纪录） |
| CP6 存档 v2 | ✅ | 7 用例。v1→v2 迁移：浏览器实测旧 P0 存档（smokeCounter=3）→ smokeCounter 消失、createdAt 1787934417649 无损保留、其余按首档初始化 |
| CP7 冒烟面板 | ✅ | 浏览器验证 7 项全过（见下）；深色主题下按钮文字清晰可见（P0 遗留 #2 修复确认） |
| CP8 压力模拟 | ✅ | 1000 次到访模拟全程不变量成立（cycle 保持 1、分布达标、锁定者永不被淘汰），耗时 86ms；小池轮回模拟 50 只 ≥25 代、代内组合唯一 |

## 测试统计

```
Test Files  7 passed (7)
     Tests  59 passed (59)
  Duration  ~320ms
```

文件明细：doc.spec 7 · namer.spec 4 · pressure.spec 2 · rng.spec 7 · spawn.spec 13 · stats.spec 9 · traits.spec 17。

## 浏览器冒烟记录（`dsh --profile pets --port 3081 --no-open`）

1. **v1 迁移**：向 3081 源注入 P0 真实存档原文 `{"schemaVersion":1,"smokeCounter":3,"createdAt":1787934417649}` 后加载面板——统计行全零起步（smokeCounter 消失），迁移后 v2 存档 `createdAt` 保留。
2. **6 次模拟到访**：前 5 次逐行入表，第 6 次提示「旺王（p_000006）到访啦；麻圆 收拾行李告别」——最早到场者（p_000001 麻圆）被淘汰，行数保持 5。
3. **锁定跳过**：锁定小蓉（p_000002）再访 → 淘汰的是布子（p_000003，下一只最早未锁定者）。
4. **满员全锁定**：全员锁定后到访 → 提示「小院已满，住满都是你锁定的宝贝（到访暂停）」，状态不变。
5. **解锁恢复**：解锁小蓉（原 arrivedAt 最早）再访 → 到访恢复且被淘汰者恰为小蓉（含刚解锁者按原时间重排）。
6. **F5 持久化**：刷新后表格与统计保留（在场 5/5 · 已相遇 8 · 组合 8）；同日再开口径正确——探望 1 次不变、打开 2 次（+1）。
7. **深色主题**：表格按钮（锁定/解锁）与底部按钮（模拟到访/导出测试 PNG）文字清晰可见。
8. `dsh` 终端零 fiber 报错。

## 偏差与决策树使用记录

1. **D1（类型摩擦）· `isValidTraits`**：`ACCESSORY_POOL.includes(t.accessory as Accessory)` 因 `as const` 池的 `includes` 参数窄化报错。修复：`(ACCESSORY_POOL as readonly Accessory[]).includes(...)`。语义不变。
2. **D1（类型摩擦）· `isArchiveEntry`**：`(v as ArchiveEntry).leftAt` 与 `(v as Record<string, unknown>).leftAt` 均因收窄后的 Pet 转型报 TS2352。修复：`(v as { leftAt?: unknown }).leftAt`。语义不变。
3. **D2-3（模板与决策表矛盾，有据修改）· `toDoc`**：模板 `toDoc` 展开的 Yard 无 `schemaVersion`，而 SaveDoc 必需——typecheck 直接失败（模板自身不可编译）。按 §L1（Yard 与 SaveDoc 仅差 usedCombos，存档需版本戳）修复：`return { ...yard, usedCombos: [...yard.usedCombos], schemaVersion: DOC_SCHEMA_VERSION }`。doc.spec 往返等价断言仍通过。
4. **D2-3（模板与决策表矛盾，有据修改）· `rollTraits` 空配饰池**：模板 `rng.chance(ACCESSORY_RATE) ? rng.pick(pools.accessory) : 'none'` 在 `pools.accessory` 为空数组（手册 TINY 池即如此）时会产出 `accessory: undefined`，导致组合键落在可能值之外（traits.spec「耗尽快路径」用例失败实测复现），并污染存档合法性。按 §L3「none 是未命中分支」修复：`rng.chance(ACCESSORY_RATE) && pools.accessory.length > 0 ? ... : 'none'`。对所有非空池（含生产 DEFAULT_POOLS）行为零变化。
5. **测试文件的两处自组织**（手册允许"断言自行组织"）：traits.spec 500 只唯一性用例与 10k 分布用例按清单语义实现；namer.spec 与 traits.spec 存在少量重叠用例（两文件各自按清单独立成篇）。
6. **浏览器冒烟环境**：用户手动启动的 `dsh web`（内置 web profile，无插件）占着 3080；为不动它，pets profile 用 `--port 3081` 启动。localStorage 按源隔离，故 v1 迁移验证采用「注入 P0 真实存档原文」方式在 3081 源复现（payload 与 P0 实测存档逐字节一致）。
7. **验证后清理**：冒烟产生的测试存档（8 只宠物）留在 3081 源 localStorage；pets profile 服务仍在 3081 后台运行。用户日常自用的 3080（内置 web profile）全程未动。

## 遇到的报错与处置

1. `TS2345: Argument of type 'Accessory' is not assignable ... '"scarf" | "bell" | "bowtie"'`（isValidTraits）→ 见偏差 #1，解决。
2. `TS2352: Conversion of type 'Pet' to type 'ArchiveEntry' may be a mistake`（isArchiveEntry，两次转型形态均报）→ 见偏差 #2，解决。
3. `TS2741: Property 'schemaVersion' is missing`（toDoc 返回值）→ 见偏差 #3，解决。
4. `TS7034/TS7005: Variable 'derived' implicitly has type 'any[]'`（测试内推断失败）→ 显式标注 `DerivedPet[]`，解决。
5. traits.spec「耗尽快路径」断言失败（`expected [ …(2) ] to include 'dog|small|...'`，实际键含 `undefined` 维度）→ 见偏差 #4 根因定位与修复，解决。

## 遗留问题 / 待用户决策

1. **模板修正回填**：偏差 #3/#4 属于 P1 手册模板自身缺陷（toDoc 缺版本戳、rollTraits 空池行为），已按决策树修正并全量回归；建议后续修订 `p1-execution-plan.md` 模板原文时同步（本文档不改动它）。
2. **3080/3081 并存**：3081 上的 pets profile 服务仍在后台运行（可直接打开 `http://127.0.0.1:3081` 体验 P1 面板）；你之前的 3080 内置 web profile 未受影响。若想让日常 `dsh web` 自带插件，仍需执行此前方式 B（`npx @deepseek-ai/dsh plugin --profile web add E:/dsh-plugin-pet`）。
3. **P1 数据形态提示**：P1 面板无"取名/图鉴/设置"UI（按计划属 P2+）；存档中 archive 已开始积累被淘汰宠物，P2 可直接消费。
