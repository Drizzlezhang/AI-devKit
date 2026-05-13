# 1-SPEC — 编写需求

按 `_meta.yaml.size` 渲染 `templates/REQUIREMENT.md` 对应分段：XS 仅保留 `size:all`，S 增加 `size:S+`，M 再增加 `size:M+`，L 保留全部分段。

## 输入
- `proposal.md`

## 必做事项
- 将 proposal 转化为结构化需求文档
- 写清功能需求与非功能需求
- 定义 Given / When / Then 验收标准
- 补充边界场景
- 明确 out of scope

## 产物要求
创建 `.specs/<change-id>/requirements.md`，参考 `templates/REQUIREMENT.md` 结构。
