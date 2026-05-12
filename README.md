# AI-DevKit

面向 Claude Code 的 skill 工具包，用一个安装器交付两类能力：
- `devkit-init`：为项目建立更干净、更适配的 AI 协作环境
- `devkit-go`：把一句话需求推进成带产物、带验证、可交付的七阶段闭环

同时提供对 Trae CLI 与 Codex CLI 的运行时识别能力，但当前只对 Claude 的全局 skill 安装目录做了明确支持。

## 为什么用它
- **少手工配置**：初始化项目协作环境，而不是每次从零补规则
- **少上下文浪费**：skill 采用入口 + 子文档结构，避免超大单文件 prompt
- **过程可追踪**：`devkit-go` 通过 `.specs/` 管理 proposal、requirements、design、tasks、verification
- **对工作项目友好**：内建字节内部项目的 bytedcli 强制策略

## 快速开始

### 通过 npx 运行安装器
```bash
npx ai-devkit
```

### 项目级安装到 Claude skills
```bash
npx ai-devkit --project --runtime claude
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
## 使用后的能力

安装后，宿主中可手动调用：
- `/devkit-init`
- `/devkit-go`

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

## 发布与分发建议

### 当前状态
当前仓库已经适合继续通过 GitHub 维护源码与版本历史，但**还不算完整的 npm 发布形态**。

### 现在已经具备的条件
- 有合法的 npm 包名：`ai-devkit`
- 有 `bin` 入口：`ai-devkit`
- 有可运行的安装脚本：`bin/install.js`
- 有 `files` 白名单，能控制打包内容
- 已经可以通过 GitHub 仓库管理源码、issue、release 与 tag

### 还缺的关键项
如果你要稳定支持 `npm install -g ai-devkit` 或 `npx ai-devkit`，建议继续补这些：
- `package.json` 中的 `repository` / `homepage` / `bugs`
- `author` 与更完整的 package metadata
- 发布前版本管理策略（tag / release / changelog）
- 至少一次 `npm pack` 验证，确认最终 tarball 内容正确
- 最好补一个最小 CI，至少跑 `node bin/install.js --help`

### 关于“npm 或 npx 也用 GitHub 管理”
可以，但要分清两层：
- **源码与版本**：完全可以用 GitHub 管理，这是当前推荐路径
- **命令分发**：
  - 如果你想让用户直接运行 `npx ai-devkit`，最稳的是发布到 npm registry
  - 如果你暂时不发 npm，也可以让用户用 GitHub 直接运行，比如：
    - `npx github:Drizzlezhang/AI-devKit`
    - 或 `npm install git@github.com:Drizzlezhang/AI-devKit.git`

但要注意：**GitHub 直装更适合内部试用或早期验证，不如 npm registry 稳定**，因为：
- 版本解析与缓存体验较弱
- 首次安装更依赖 git / ssh 环境
- 对外用户的使用门槛更高

### 推荐发布路径
1. 继续用 GitHub 作为源码真源
2. 在 GitHub 上打 tag / release
3. 补齐 package metadata 与最小发布校验
4. 再发布到 npm，让 `npx ai-devkit` 成为标准入口

如果短期内只面向少量内部用户，GitHub 直装可以先用；如果要面向公开用户或稳定分发，还是建议补齐 npm 发布链路。
