# 安装规划

你必须按“按需、不重复、功能互补、不过度暴露 skill”的原则规划增强能力。

## 候选来源
可以从以下来源中选择最合适的项目，也可以使用官方市场中的高质量项目或任何通过 `npx` / `npm` 可安装的 coding skill：
- `https://github.com/obra/superpowers`
- `https://github.com/mattpocock/skills`
- `https://github.com/addyosmani/agent-skills`
- `https://github.com/anthropics/skills`
- `https://github.com/forrestchang/andrej-karpathy-skills`
- 官方 skill / plugin 市场中的 Top 项目

## 规划时必须考虑
- 当前项目技术栈最缺什么，而不是“别人常装什么”
- 是否已存在等效能力
- 是否会与现有 skill / plugin / MCP 职责重叠
- 是否会让 skill 列表膨胀，导致模型暴露过多无关能力
- 安装后是否需要额外配置、登录、token、权限、hooks

## 可选安装方式
- `npx <package>` 执行安装
- `npm install` 后执行安装脚本
- 从官方市场安装
- `git clone` 后复制相关文件到 `.claude/skills/`

## 安装前强制交互确认
执行任何安装前，必须先展示“计划安装清单”，至少包含：
- 名称
- 类型（skill / plugin / MCP / CLI）
- 安装方式
- 安装原因
- 是否与现有能力重叠
- 是否涉及全局影响

未确认不得安装。
