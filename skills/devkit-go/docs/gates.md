# Gate 与失败处理

你必须在以下条件触发时暂停并向用户展示产物或失败信息：

| Gate | 触发条件 | 行为 |
|------|---------|------|
| post-spec | Size ≥ M | 展示 `requirements.md`，等待用户审核确认 |
| post-plan | Size ≥ L | 展示 `tasks.md`，等待用户审核确认 |
| verify-fail | 测试 / lint / 类型检查失败 | 展示失败详情，询问重试或放弃 |
| partial-pass | VERIFY 存在非阻塞遗留问题 | 展示剩余问题、影响范围与建议后续动作，确认是否允许继续进入 SHIP |
| pre-commit | Size ≥ S，或 VERIFY 为 `partial-pass` | 在提交前确认提交粒度、验证状态、剩余风险 |
| pre-ship | Size ≥ L | 强制执行 review 后才能提交 |

## 失败处理
- 验证失败时，必须展示失败详情，而不是笼统地说“没通过”。
- 当 `retry_count` 达到 3 次仍未通过时，必须暂停，向用户说明阻塞点与建议方案，不要无限重试。
- 如果用户选择放弃，必须把 `_meta.yaml` 标记为 `abandoned`，并更新 `.specs/STATE.md`。
- 如果 VERIFY 为 `partial-pass`，必须记录剩余问题与用户确认结果，不能静默当作完全通过。
