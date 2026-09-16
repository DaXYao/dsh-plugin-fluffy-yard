# src/core/stats.ts

> 最近分析：2026-08-29 · 文件哈希：9fb87857 · 变更 4 次

## 业务接口

### dateKey `dateKey(ms: number): string`

**用途**：时间戳格式化为本地自然日键 YYYY-MM-DD
**内部调用**：未解析 → `String`
**最近变更**：08-29 新增

### yesterdayKey `yesterdayKey(ms: number): string`

**用途**：计算指定时间的本地昨日自然日键
**内部调用**：业务 → `dateKey`
**最近变更**：08-29 新增

### initialStats `initialStats(): Stats`

**用途**：创建全零初始统计对象
**最近变更**：08-29 新增

### recordOpen `recordOpen(stats: Stats, now: number): Stats`

**用途**：记录一次打开面板：自然日首开计探望，同日再开只计打开
**内部调用**：业务 → `dateKey`, `yesterdayKey`
**最近变更**：08-29 新增

## 实现接口

（无）

## 辅助/工具函数

（无）
