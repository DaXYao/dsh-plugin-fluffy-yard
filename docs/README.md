# 「毛茸茸小院」项目文档索引

> DeepSeek Harness 宠物插件（`dsh-plugin-fluffy-yard`）的全部文档入口。
> 本文件是文档导航，不承载具体内容；具体内容见各子文档。

---

## 文档地图

| 文档 | 内容 | 建议读者 |
|---|---|---|
| [requirements.md](./requirements.md) | **需求文档 v0.3**：玩法规则、外观唯一性、锁定/导出/统计、窗口缩放反应系统（争宠机制）、数据模型草案、已确认决策、开发里程碑 | 所有人；一切实现的出发点 |
| [implementation-plan.md](./implementation-plan.md) | **实现方案 v1.0**：DSH 技术底座调研结论、三个关键落地决策（面板落位/持久化/PNG 导出）、架构原则、分阶段任务、风险对策 | 开发人员 |
| [p0-execution-plan.md](./p0-execution-plan.md) | P0 执行计划：工程骨架 + DSH 集成 spike 的检查点清单 | 开发人员 |
| [p0-report.md](./p0-report.md) | **P0 执行报告**：骨架/构建/vitest/profile/装载/持久化/HMR/overlay 全部实测结论与偏差记录 | 开发人员 |
| [p1-execution-plan.md](./p1-execution-plan.md) | P1 执行计划：领域内核（纯逻辑 + 全量单测）的手册式清单 | 开发人员 |
| [p1-report.md](./p1-report.md) | **P1 执行报告**：8 个检查点全过（59 用例）、浏览器冒烟记录、决策树使用记录与遗留问题 | 开发人员 |
| [autodoc/](./autodoc/) | **代码文档镜像**：由 AutoDoc 从 `src/` 与 `tests/` 自动生成，符号级签名/用途/调用关系/变更历史 | 开发人员；源码级检索 |

---

## 阅读顺序建议

1. **先读需求**：`requirements.md`（了解产品是什么、规则边界、已确认的 10 条决策）
2. **再读方案**：`implementation-plan.md`（了解技术选型与三个关键落地决策）
3. **看进度**：按阶段读执行报告 `p0-report.md` → `p1-report.md`（各阶段的实测结论与遗留问题）
4. **查代码**：`autodoc/` 目录按文件路径镜像，符号级查阅签名与调用关系

---

## 状态总览（截至 P1 结束）

- **P0** ✅ 完成：工程骨架、DSH 装载链路、持久化、PNG 导出、HMR 全部验证通过
- **P1** ✅ 完成：领域内核（rng/特征/起名/到访淘汰/统计/存档迁移）59 个单测全过，浏览器冒烟 7 项全过
- **P2** ⏳ 未开始：SVG 渲染 + 场景引擎骨架（M0 验收）
- **P3** ⏳ 未开始：MVP 交互闭环（M1 验收）

> 里程碑映射见 `implementation-plan.md` §0.2；遗留问题见各阶段报告的「遗留问题 / 待用户决策」。

---

## 维护约定

- **需求变更** → 改 `requirements.md` 并在文末「变更记录」追加版本
- **代码变更** → 源码注释遵循现有 JSDoc 风格；AutoDoc 文档镜像由工具重建（增量扫描），无需手改 `docs/autodoc/`
- **符号级注释指令**（供 AutoDoc 使用）：
  - `@autodoc:purpose <一句话>` —— 人工锁定用途说明（优先于 LLM 生成）
  - `@autodoc:category business|implementation|auxiliary` —— 强制指定符号分类
