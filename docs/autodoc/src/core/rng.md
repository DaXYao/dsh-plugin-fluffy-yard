# src/core/rng.ts

> 最近分析：2026-08-29 · 文件哈希：67ccb85c · 变更 4 次

## 业务接口

### mulberry32 `mulberry32(seed: number): () => number`

**用途**：由种子创建 mulberry32 均匀随机数生成器
**最近变更**：08-29 新增

### createRng `createRng(rand: () => number): Rng`

**用途**：把底层 [0,1) 随机函数包装为 int/pick/chance 便捷接口
**内部调用**：未解析 → `rand`
**最近变更**：08-29 新增

### rngFrom `rngFrom(seedStr: string): Rng`

**用途**：由字符串种子创建可复现的随机流（宠物 id 即种子）
**内部调用**：业务 → `createRng`, `mulberry32` · 辅助 → `hashSeed`
**最近变更**：08-29 新增

## 实现接口

（无）

## 辅助/工具函数

### hashSeed `hashSeed(str: string): number`

**用途**：字符串（宠物 id）散列为 32 位无符号随机种子
**最近变更**：08-29 新增
