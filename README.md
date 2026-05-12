# AI-devKit

AI-devKit 是一个面向 Claude Code 的 skill 工程，并为 Trae CLI / Codex CLI 提供运行时识别与兼容扩展基础。它提供两个手动触发的核心 skill：
- `devkit-init`：项目开发环境智能初始化（入口 + 子文档）
- `devkit-go`：七阶段需求闭环开发（入口 + 子文档）

## 安装

### 通过 npx 运行安装器
```bash
npx ai-devkit
```

### 本地开发验证
```bash
node bin/install.js --help
node bin/install.js --project --runtime claude
```

## 命令说明

### CLI 命令
- `ai-devkit`

### 参数
- `--help` / `-h`：显示帮助
- `--global`：安装到已验证的全局 skills 目录；当前仅 Claude 支持
- `--project`：安装到当前项目的 `./.claude/skills`
- `--runtime <name>`：强制指定运行时，可选 `claude` / `trae` / `codex`

### 常用示例
```bash
npx ai-devkit --help
npx ai-devkit --project
npx ai-devkit --project --runtime claude
npx ai-devkit --runtime codex --project
npx ai-devkit --runtime trae --project
npx ai-devkit --runtime claude --global
```

安装脚本 `bin/install.js` 会：
1. 检测当前环境更接近 Claude Code、Trae CLI 还是 Codex CLI
2. 让用户选择全局安装或项目级安装
3. 复制 `devkit-init` 与 `devkit-go` 的入口 `SKILL.md` 及其 `docs/` 子文档
4. 将 `templates/` 复制到安装后的 `devkit-go` 目录中
5. 输出安装结果摘要

### 运行时说明
- Claude Code：已明确支持全局安装到 `~/.claude/skills/` 与项目级安装到 `./.claude/skills/`
- Codex CLI：官方文档确认配置目录为 `~/.codex/config.toml` 与项目级 `.codex/config.toml`；本工程当前只做运行时识别，不声明官方 Claude-style global skills 目录
- Trae CLI：检测用户级目录 `~/.trae/`；本工程当前只做运行时识别，不声明官方 Claude-style global skills 目录

## 目录结构
```text
devkit/
├── package.json
├── bin/
│   └── install.js
├── skills/
│   ├── devkit-init/
│   │   ├── SKILL.md
│   │   └── docs/
│   └── devkit-go/
│       ├── SKILL.md
│       └── docs/
├── templates/
│   ├── CHANGE.md
│   ├── REQUIREMENT.md
│   ├── DESIGN.md
│   ├── TASK.md
│   ├── VERIFICATION.md
│   └── _meta.yaml
├── .gitignore
├── CLAUDE.md
├── LICENSE
└── README.md
```

## Skill 结构说明

### `devkit-init`
- `SKILL.md`：入口、边界、路由规则
- `docs/project-analysis.md`：项目扫描与摘要输出
- `docs/claude-md-strategy.md`：`CLAUDE.md` 生成/优化策略
- `docs/install-planning.md`：安装项规划与确认要求
- `docs/redundancy-policy.md`：冗余检测与禁用原则
- `docs/bytedcli-policy.md`：字节内部项目强制 bytedcli 规则

### `devkit-go`
- `SKILL.md`：入口、阶段路由、总执行约束
- `docs/workflow-overview.md`：总流程、模板映射、阶段推进模板
- `docs/size-routing.md`：Size 推断、阶段序列与切换要求
- `docs/state-management.md`：`STATE.md`、`_meta.yaml` 与恢复模式
- `docs/gates.md`：审核关口与失败处理
- `docs/stage-*.md`：各阶段的输入、动作、产物与规则


### `/devkit-init`
- 手动触发，不允许模型自动调用
- 以入口 `SKILL.md` + `docs/` 子文档的方式渐进完成初始化
- 扫描项目技术栈与已有 AI 配置
- 生成或优化 `CLAUDE.md`
- 规划并安装必要的 skill / plugin / MCP
- 对冗余能力做检测与禁用
- 检测到字节/内部项目时，强制安装 bytedcli CLI + Skill + MCP

### `/devkit-go`
- 手动触发，不允许模型自动调用
- 以入口 `SKILL.md` + `docs/` 子文档的方式渐进执行七阶段流程
- 基于需求复杂度自动裁剪阶段
- 通过 `docs/size-routing.md` 决定阶段序列，并在每次切换时显式说明读取文档与跳转原因
- 在 `.specs/` 下管理 proposal / requirements / design / tasks / verification
- 按验证结果决定是否返回 BUILD 阶段重试
- 最终生成 conventional commits 风格提交信息并进入 SHIP

## 模板产物
`devkit-go` 使用 `templates/` 中的模板创建以下文件：
- `proposal.md`
- `requirements.md`
- `design.md`
- `tasks.md`
- `verification.md`
- `_meta.yaml`

## 开发说明
- 安装脚本只使用 Node.js 内置模块
- `SKILL.md` 应保持“入口 + docs 子文档”结构，避免把所有规则堆在单文件中
- 两个 skill 的 frontmatter 必须始终包含 `trigger: manual`

## 发布
1. 运行 `node bin/install.js --help`
2. 检查 skill 与模板内容
3. 提交变更
4. 发布 npm 包或通过 `npx` 安装验证
