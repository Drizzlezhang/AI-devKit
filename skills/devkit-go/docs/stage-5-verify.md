# 5-VERIFY — 测试验证

## 输入
- 代码变更
- 优先读取 `requirements.md`
- 若 XS 或 `requirements.md` 缺失，则回退读取 `proposal.md`

## 验证模式
- `5-lite`：仅用于 XS。执行最小必要验证，例如受影响命令、核心测试、关键手动路径或最小 lint/typecheck 子集，并记录为什么采用轻量验证。
- `5-full`：用于 S/M/L。执行完整测试、lint、类型检查，并逐条对照验收标准核验。

## 必做事项
- 运行测试、lint、类型检查或等效最小验证
- 逐条对照验收标准核验
- 形成结构化验证记录
- 如果验证失败，回退到 `4-BUILD` 重试，最多 3 次
- 每次失败都必须增加 `_meta.yaml` 的 `retry_count`
- 如果存在少量非阻塞问题但主路径已通过，可标记为 `partial-pass`

## partial-pass 规则
只有在以下条件同时满足时，才允许使用 `partial-pass`：
1. 主路径与核心验收标准已通过。
2. 未通过项不影响当前交付目标的可用性。
3. 剩余问题已被明确记录，可继续修复或后续跟进。
4. 进入 SHIP 前必须向用户展示剩余问题并获得确认。

若不满足以上条件，必须按 `verify-fail` 处理，不得滥用 `partial-pass`。

## 产物要求
创建 `.specs/<change-id>/verification.md`，参考 `templates/VERIFICATION.md` 结构。

## 输出要求
`verification.md` 必须至少包括：
- 验证时间
- 验证模式（`5-lite` 或 `5-full`）
- 验收标准逐条验证表
- 单元测试结果
- Lint 结果
- 类型检查结果
- 是否通过（`pass` / `partial-pass` / `fail`）
- 失败项或剩余问题（如有）
- 建议操作
