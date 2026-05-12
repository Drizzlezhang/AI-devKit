# Gate 与失败处理

你必须在以下条件触发时暂停并向用户展示产物或失败信息：

| Gate | 触发条件 | 行为 |
|------|---------|------|
| post-spec | Size ≥ M | 展示 `requirements.md`，等待用户审核确认 |
| post-plan | Size ≥ L | 展示 `tasks.md`，等待用户审核确认 |
| verify-fail | 测试 / lint / 类型检查失败 | 展示失败详情，询问重试或放弃 |
| pre-ship | Size ≥ L | 强制执行 review 后才能提交 |

## 失败处理
- 验证失败时，必须展示失败详情，而不是笼统地说“没通过”。
- 当 `retry_count` 达到 3 次仍未通过时，必须暂停，向用户说明阻塞点与建议方案，不要无限重试。
- 如果用户选择放弃，必须把 `_meta.yaml` 标记为 `abandoned`，并更新 `.specs/STATE.md`。
