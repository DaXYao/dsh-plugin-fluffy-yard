# src/core/traits.ts

> 最近分析：2026-08-29 · 文件哈希：0e98efa4 · 变更 6 次

## 业务接口

### comboKeyOf `comboKeyOf(traits: Traits): string`

**用途**：将特征组合序列化为唯一键（历史唯一性判定用）
**最近变更**：08-29 新增

### personalityOf `personalityOf(passion: number): Personality`

**用途**：热情度 0-100 映射为热情/淡定/高冷三档性格
**最近变更**：08-29 新增

### derivePet `derivePet(id: string, usedCombos: ReadonlySet<string>, cycle: number, pools: TraitPools = DEFAULT_POOLS): DerivedPet`

**用途**：从宠物 id 种子推导全部出生属性（特征/热情/名字），冲突重摇，耗尽进入轮回
**内部调用**：业务 → `rngFrom`, `comboKeyOf`, `personalityOf`, `makeDefaultName` · 辅助 → `totalCombos`, `rollTraits`
**最近变更**：08-29 新增

## 实现接口

（无）

## 辅助/工具函数

### totalCombos `totalCombos(pools: TraitPools): number`

**用途**：计算给定维度池下的特征组合总数（含 none 配饰）
**最近变更**：08-29 新增

### rollTraits `rollTraits(rng: Rng, pools: TraitPools): Traits`

**用途**：从特征池随机摇出一套完整特征（内部）
**最近变更**：08-29 新增

### isValidTraits `isValidTraits(value: unknown): value is Traits`

**用途**：校验未知值是否为合法特征组合（存档载入防线）
**最近变更**：08-29 新增
