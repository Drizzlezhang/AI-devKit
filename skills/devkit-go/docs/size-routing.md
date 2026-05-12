# 复杂度裁剪（Size）

你必须先根据用户描述推断 Size，并据此裁剪阶段序列。

| Size | 阶段序列 | 典型场景 |
|------|---------|---------|
| XS | 0 → 4 → 6 | 修 typo、改配置、重命名变量 |
| S | 0 → 1 → 4 → 5 → 6 | 添加简单功能、小规模重构 |
| M | 0 → 1 → 2 → 3 → 4 → 5 → 6 | 新功能开发、数据迁移 |
| L | 全部阶段 + 强制 review 关口 | 跨系统架构变更、平台级重写 |

## 推断维度
必须综合以下维度，而不是只看关键词：
- 范围：单文件/单函数 → 单模块 → 跨模块 → 跨系统
- 关键词：`fix`/`typo`/`bump`/`rename` → `add`/`refactor` → `feature`/`redesign`/`migrate` → `architecture`/`rewrite`/`platform`
- 预估文件数：1-3 → 4-10 → 10-30 → 30+
- 依赖变更：无 → 仅内部 → 新增外部 → 多系统联调
- 风险：无破坏性 → 局部影响 → 需回归测试 → 需灰度

## 阶段路由
推断出 Size 后，必须立刻确定本次 change 的阶段序列，并在 `proposal.md` 与 `_meta.yaml` 中显式记录。

- XS：只读取 `stage-0-change.md`、`stage-4-build.md`、`stage-6-ship.md`
- S：读取 `stage-0-change.md`、`stage-1-spec.md`、`stage-4-build.md`、`stage-5-verify.md`、`stage-6-ship.md`
- M：按顺序读取所有阶段文档，并在 `1-SPEC` 后检查是否触发 `post-spec`
- L：按顺序读取所有阶段文档，并在 `1-SPEC`、`3-PLAN`、`6-SHIP` 前分别检查 `post-spec`、`post-plan`、`pre-ship`

## 阶段切换要求
每次切换阶段时都必须输出：
- 当前 `change-id`
- 当前阶段
- 下一阶段
- 本次切换的原因（例如："Size 为 S，跳过 DESIGN/PLAN"、"VERIFY 失败，回到 BUILD"）
- 本阶段将读取的子文档

## 输出要求
必须在 `proposal.md` 中写出 `Size`、"推断依据" 与 "阶段序列"。
