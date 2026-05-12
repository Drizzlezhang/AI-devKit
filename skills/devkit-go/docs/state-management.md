# 状态管理

你必须维护 `.specs/STATE.md`，至少记录：
- 当前活跃 `change-id`
- 当前阶段
- 中断原因（如有）
- 未完成任务
- 最近一次更新时间
- 最近一次恢复方式（新建 / 恢复 / 回退）

你还必须在 `.specs/<change-id>/_meta.yaml` 中维护：
- `change_id`
- `size`
- `stages`
- `current_stage`
- `status`
- `created_at`
- `updated_at`
- `retry_count`
- `last_verified_at`（如有）
- `last_context_mode`（例如 `fresh` / `resume-minimal`）

## change-id 规则
每次新变更都必须生成一个稳定、可读、文件系统安全的 `change-id`。建议格式：
- `verb-noun`
- `verb-short-topic`
- 必要时追加日期或序号避免冲突

例如：
- `fix-login-timeout`
- `add-export-command`
- `migrate-user-profile-schema`

## 恢复模式
当用户调用 `/devkit-go` 且不带参数时，你必须：
1. 检查 `.specs/STATE.md`
2. 如果有活跃 change，则总结当前阶段、未完成任务与下一步，并继续推进
3. 如果没有活跃 change，则询问一句话需求后创建新的 change

## 最小上下文恢复
当进入恢复模式时，不要一次性回读所有产物。必须按最小上下文加载：
1. 先读 `.specs/STATE.md`
2. 再读 `.specs/<change-id>/_meta.yaml`
3. 再根据 `current_stage` 读取当前阶段直接依赖的单个主产物
4. 只有在信息不足时，才继续补读上游产物

建议的最小加载优先级：
- `0-CHANGE`：`proposal.md`
- `1-SPEC`：`requirements.md`，缺失时回退 `proposal.md`
- `2-DESIGN`：`design.md`，缺失时回退 `requirements.md`
- `3-PLAN`：`tasks.md`，缺失时回退 `design.md`
- `4-BUILD`：`tasks.md`，缺失时按既有降级链回退
- `5-VERIFY`：`verification.md`，缺失时回退 `requirements.md` 或 `proposal.md`
- `6-SHIP`：`verification.md` + 最近一次验证结论，必要时再读 `proposal.md`

## 状态一致性检查
每次恢复或阶段切换前，都必须检查：
- `.specs/STATE.md` 的活跃 `change-id` 是否存在对应目录
- `_meta.yaml.current_stage` 与 `STATE.md` 记录是否一致
- 当前阶段所需的核心产物是否存在
- `status` 是否允许继续推进（例如 `abandoned` 不得静默恢复）
- `retry_count` 是否已达到上限

如果发现不一致：
1. 先停止自动推进
2. 明确指出哪一项状态冲突
3. 提示用户选择修正状态、恢复到上一个稳定阶段，或放弃当前 change

## 归档与清理策略
- `status: completed` 的 change，默认保留在 `.specs/<change-id>/`，不自动删除
- 当 completed / abandoned 的 change 积累过多时，可以建议归档，但不得未经确认直接删除
- 归档优先于删除；建议移动到 `.specs/archive/<change-id>/`
- 若用户明确要求清理，必须先说明将删除或移动哪些目录与状态文件
- 清理后要同步更新 `.specs/STATE.md`，避免悬挂引用
