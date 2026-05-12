# 5-VERIFY — 测试验证

## 输入
- 代码变更
- `requirements.md`

## 必做事项
- 运行测试、lint、类型检查
- 逐条对照验收标准核验
- 形成结构化验证记录
- 如果验证失败，回退到 `4-BUILD` 重试，最多 3 次
- 每次失败都必须增加 `_meta.yaml` 的 `retry_count`

## 产物要求
创建 `.specs/<change-id>/verification.md`，参考 `templates/VERIFICATION.md` 结构。

## 输出要求
`verification.md` 必须至少包括：
- 验证时间
- 验收标准逐条验证表
- 单元测试结果
- Lint 结果
- 类型检查结果
- 是否通过
- 失败项（如有）
- 建议操作
