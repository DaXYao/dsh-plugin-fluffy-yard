# src/core/spawn.ts

> 最近分析：2026-08-29 · 文件哈希：c375e2b6 · 变更 7 次

## 业务接口

### spawnIntervalMs `spawnIntervalMs(yard: Yard): number`

**用途**：读取设置中的到访间隔并换算为毫秒
**最近变更**：08-29 新增

### dueSpawnCount `dueSpawnCount(yard: Yard, now: number): number`

**用途**：时钟判定距上次到访是否满一个间隔，离线最多补 1 只
**内部调用**：业务 → `spawnIntervalMs` · 辅助 → `isSpawnPaused`
**最近变更**：08-29 新增

### spawnPet `spawnPet(yard: Yard, now: number, pools?: TraitPools): SpawnResult`

**用途**：让一次到访立刻发生：生成新宠物，满员时淘汰最早未锁定者
**内部调用**：业务 → `derivePet` · 辅助 → `formatPetId`
**最近变更**：08-29 新增

### setLocked `setLocked(yard: Yard, petId: string, locked: boolean): Yard`

**用途**：锁定或解锁指定宠物，返回新状态
**最近变更**：08-29 新增

### renamePet `renamePet(yard: Yard, petId: string, name: string): Yard`

**用途**：重命名指定宠物（空名忽略，截断到长度上限）
**最近变更**：08-29 新增

## 实现接口

（无）

## 辅助/工具函数

### formatPetId `formatPetId(counter: number): string`

**用途**：宠物 id 序号格式化为 'p_000042' 形态
**内部调用**：未解析 → `String`
**最近变更**：08-29 新增

### isSpawnPaused `isSpawnPaused(yard: Yard): boolean`

**用途**：判定到访是否因满员且全锁定而暂停
**最近变更**：08-29 新增
