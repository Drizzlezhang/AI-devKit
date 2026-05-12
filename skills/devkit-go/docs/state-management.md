# 状态管理

你必须维护 `.specs/STATE.md`，至少记录：
- 当前活跃 `change-id`
- 当前阶段
- 中断原因（如有）
- 未完成任务
- 最近一次更新时间

你还必须在 `.specs/<change-id>/_meta.yaml` 中维护：
- `change_id`
- `size`
- `stages`
- `current_stage`
- `status`
- `created_at`
- `updated_at`
- `retry_count`

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
