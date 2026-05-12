# 工作流总览

## 总流程
```text
0-CHANGE → 1-SPEC → 2-DESIGN → 3-PLAN → 4-BUILD → 5-VERIFY → 6-SHIP
                                                     ↑          |
                                                     └──────────┘
                                                   （验证失败 → 重试）
```

## 调用方式
- `/devkit-go <一句话需求>`：直接启动一个新的 change。
- `/devkit-go`：如果 `.specs/STATE.md` 中存在活跃 change，则继续该 change；否则先询问用户本次要处理的一句话需求。

## 变更即文件夹
每次 `/devkit-go` 必须创建或使用如下目录：
```text
.specs/<change-id>/
├── proposal.md
├── requirements.md
├── design.md
├── tasks.md
├── verification.md
└── _meta.yaml
```

## 模板映射
- `templates/CHANGE.md` → `.specs/<change-id>/proposal.md`
- `templates/REQUIREMENT.md` → `.specs/<change-id>/requirements.md`
- `templates/DESIGN.md` → `.specs/<change-id>/design.md`
- `templates/TASK.md` → `.specs/<change-id>/tasks.md`
- `templates/VERIFICATION.md` → `.specs/<change-id>/verification.md`
- `templates/_meta.yaml` → `.specs/<change-id>/_meta.yaml`

## Context Budget
你必须默认控制上下文预算，而不是把所有历史产物重新塞回当前会话：
- XS/S：优先使用当前阶段主产物 + 必要上游产物，不回读整套 `.specs`
- M：默认读取当前阶段主产物 + 最近一个上游产物
- L：按阶段逐步补读，只有在关键信息缺失时才扩展上下文

当需要扩展上下文时，必须说明原因，例如：
- 当前产物缺字段
- 上下游产物结论冲突
- 用户要求回顾完整设计链路

## TL;DR 约定
每次阶段完成后，建议在输出末尾附一个极短摘要，便于恢复：
- `TL;DR`: 当前完成了什么
- `Next`: 下一步做什么
- `Risk`: 当前最大剩余风险

该摘要应服务于恢复与切换，不应展开成长篇复述。

## 阶段推进模板
进入任一阶段前，你都应该用统一格式简要说明：
- `change-id`：...
- `size`：...
- `current_stage`：...
- `next_action`：...
- `read_docs`：[`docs/...`]

如果阶段被跳过，也必须明确说明跳过原因，而不是静默省略。

## 阶段退出一致性检查
每个阶段结束时，至少检查：
- 当前阶段产物是否已落盘或已明确说明为何不需要
- `_meta.yaml.current_stage` 是否已更新
- `.specs/STATE.md` 是否与当前 change 同步
- 下一阶段所需最小输入是否存在

若检查失败，不得静默进入下一阶段。
