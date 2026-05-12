# 4-BUILD — 编码实现

## 输入
- 默认读取 `tasks.md`
- 若缺失，则按降级链回退：`design.md` → `requirements.md` → `proposal.md`

## 产物降级链
```text
第 1 优先：tasks.md（来自 3-PLAN）
第 2 优先：design.md（来自 2-DESIGN）
第 3 优先：requirements.md（来自 1-SPEC）
第 4 优先：proposal.md（来自 0-CHANGE）
```

## 必做事项
- 按任务列表逐个实现
- 遵循 TDD：优先先写或先补验证，再写实现
- 每完成一个任务，都执行该任务声明的 `verify` 命令
- 将 `tasks.md` 中对应任务状态更新为 `done` 或等价完成态
- 如果任务失败，记录失败原因并修正后重试

## 执行规则
1. 严格围绕当前 change 的目标编码，不顺手做无关重构。
2. 优先复用项目内既有实现、脚本、模式和工具。
3. 修改前先读取目标文件。
4. 每完成一个任务立即执行对应 verify 命令，不要把验证堆到最后。
5. 如果用户中途改变目标，要先更新 proposal / requirements / design / tasks，再继续实现。

## 产物要求
- 代码变更
- 更新后的 `tasks.md`
