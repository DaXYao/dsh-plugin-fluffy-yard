# tests/spawn.spec.ts

> 最近分析：2026-08-29 · 文件哈希：09ebe237 · 变更 4 次

## 业务接口

（无）

## 实现接口

（无）

## 辅助/工具函数

### yard0 `yard0(now = T0): Yard`

**用途**：创建空院子初始态（测试夹具）
**内部调用**：业务 → `fromDoc`, `createInitialDoc`
**最近变更**：08-29 分类变更（pending → auxiliary） ｜ 08-29 新增

### spawnTimes `spawnTimes(yard: Yard, n: number): Yard`

**用途**：连续到访 n 次生成测试状态（时间严格递增）
**内部调用**：业务 → `spawnPet`
**最近变更**：08-29 分类变更（pending → auxiliary） ｜ 08-29 新增
