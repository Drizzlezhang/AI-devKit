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

## 安装器行为
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

## Skills

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
