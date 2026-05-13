# 3-PLAN — 任务拆解

按 `_meta.yaml.size` 渲染 `templates/TASK.md` 对应分段：XS 仅保留 `size:all`，S 增加 `size:S+`，M 再增加 `size:M+`，L 保留全部分段。

## 输入
- `design.md`

## 必做事项
- 将设计拆成可执行原子任务
- 标注依赖关系与优先级
- 分成可并行的波次
- 每个任务都必须带 `verify` 命令
- 明确每个任务读哪些文件、写哪些文件

## 产物要求
创建 `.specs/<change-id>/tasks.md`，参考 `templates/TASK.md` 结构。
