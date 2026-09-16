# src/client/persist.ts

> 最近分析：2026-08-29 · 文件哈希：36cbd1c5 · 变更 2 次

## 业务接口

### loadYard `loadYard(now: number): Yard`

**用途**：从 localStorage 载入院子状态，失败时备份并回退初始档
**内部调用**：业务 → `fromDoc`, `migrate`
**最近变更**：08-29 新增

### saveYard `saveYard(yard: Yard): void`

**用途**：序列化院子状态并写入 localStorage
**内部调用**：辅助 → `toDoc`
**最近变更**：08-29 新增

## 实现接口

（无）

## 辅助/工具函数

（无）
