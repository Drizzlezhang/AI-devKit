# 2-DESIGN — 技术设计

按 `_meta.yaml.size` 渲染 `templates/DESIGN.md` 对应分段：XS 仅保留 `size:all`，S 增加 `size:S+`，M 再增加 `size:M+`，L 保留全部分段。

## 输入
- `requirements.md`

## 必做事项
- 输出技术方案概述
- 给出 API 设计（如适用）
- 给出数据模型或类型定义（如适用）
- 拆分组件或模块职责
- 记录架构决策（ADR）
- 分析风险与缓解措施

## 产物要求
创建 `.specs/<change-id>/design.md`，参考 `templates/DESIGN.md` 结构。
