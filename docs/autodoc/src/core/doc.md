# src/core/doc.ts

> 最近分析：2026-08-29 · 文件哈希：9cf06661 · 变更 15 次

## 业务接口

### createInitialDoc `createInitialDoc(now: number): SaveDoc`

**用途**：创建全空的初始存档文档（当前版本号）
**内部调用**：业务 → `initialStats`
**最近变更**：08-29 新增

### migrate `migrate(raw: unknown, now: number): SaveDoc`

**用途**：把存储上的存档迁移到当前版本（v1→v2 等）
**内部调用**：业务 → `createInitialDoc` · 辅助 → `normalizeV2`, `numOr`
**最近变更**：08-29 新增

### fromDoc `fromDoc(doc: SaveDoc): Yard`

**用途**：存档文档转内存态 Yard（usedCombos 转 Set）
**最近变更**：08-29 新增

## 实现接口

（无）

## 辅助/工具函数

### numOr `numOr(v: unknown, fallback: number): number`

**用途**：存档字段数字容错取值（非法回退默认）
**最近变更**：08-29 新增

### strArrayOr `strArrayOr(v: unknown): string[]`

**用途**：存档字段字符串数组容错取值
**最近变更**：08-29 新增

### isPet `isPet(v: unknown): v is Pet`

**用途**：校验未知值是否为合法宠物记录
**内部调用**：辅助 → `isValidTraits`
**最近变更**：08-29 新增

### isArchiveEntry `isArchiveEntry(v: unknown): v is ArchiveEntry`

**用途**：校验未知值是否为合法图鉴条目（含离场时间）
**内部调用**：辅助 → `isPet`
**最近变更**：08-29 新增

### statsOr `statsOr(v: unknown): Stats`

**用途**：存档统计字段容错归一（缺失回退初始值）
**内部调用**：业务 → `initialStats` · 辅助 → `numOr`
**最近变更**：08-29 分类变更（pending → auxiliary） ｜ 08-29 分类变更（auxiliary → pending） ｜ 08-29 分类变更（pending → auxiliary）

### settingsOr `settingsOr(v: unknown): Settings`

**用途**：存档设置字段容错归一（缺失回退默认间隔）
**内部调用**：辅助 → `numOr`
**最近变更**：08-29 分类变更（pending → auxiliary） ｜ 08-29 分类变更（auxiliary → pending） ｜ 08-29 分类变更（pending → auxiliary）

### normalizeV2 `normalizeV2(doc: Record<string, unknown>, now: number): SaveDoc`

**用途**：将任意 v2 形态原始值规范化为当前版本存档
**内部调用**：业务 → `createInitialDoc` · 辅助 → `numOr`, `strArrayOr`, `statsOr`, `settingsOr`
**最近变更**：08-29 新增

### toDoc `toDoc(yard: Yard): SaveDoc`

**用途**：内存态 Yard 转存档文档（usedCombos 转数组并补版本戳）
**最近变更**：08-29 新增
