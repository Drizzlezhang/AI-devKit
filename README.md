# AI-DevKit

AI-DevKit 是一个面向 Claude Code 的 skill 工具包，用一个安装器交付两类核心能力：
- `devkit-init`：为项目建立更干净、更适配的 AI 协作环境
- `devkit-go`：把一句话需求推进成带产物、带验证、可交付的七阶段闭环

当前分发目标为 **GitHub Packages**。源码和版本继续由 GitHub 仓库管理，包通过 GitHub Packages 的 npm registry 发布。

## 适合谁用
- 想给新项目或存量项目快速补齐 AI 协作基础设施的工程团队
- 希望把“一句话需求”推进成结构化实现闭环，而不是只让模型临场发挥的开发者
- 需要同时兼顾使用者体验与仓库维护成本的 skill / prompt 工程作者

## 当前支持边界
- 支持通过包内 `bin/install.js` 作为 CLI 入口
- 支持安装到当前项目 `./.claude/skills/`
- 支持检测 `Claude Code`、`Trae CLI`、`Codex CLI` 运行时
- `Claude Code` 是当前唯一明确完成项目安装 + 全局安装闭环验证的宿主
- `Trae CLI` 与 `Codex CLI` 当前属于**实验性兼容 / 预留支持**：做运行时识别，并保留项目级兼容扩展基础，但不声明已具备 Claude 同等级别的全局 skills / MCP 集成能力
- `devkit-init` 与 `devkit-go` 都是 **手动触发 skill**，不会被模型自动调用
- 当前仓库提供的是 skill、模板与安装器，不负责代替 CI 平台或自动发布系统
- 因为使用 GitHub Packages，安装与执行通常需要额外的 registry 与 token 配置，体验不同于 npm 官方公开仓库

## 包信息
- 包名：`@Drizzlezhang/ai-devkit`
- CLI 命令名：`ai-devkit`
- 发布 registry：`https://npm.pkg.github.com`
- 源码仓库：`https://github.com/Drizzlezhang/AI-devKit`

## 为什么用它
- **少手工配置**：初始化项目协作环境，而不是每次从零补规则
- **少上下文浪费**：skill 采用入口 + 子文档结构，避免超大单文件 prompt
- **过程可追踪**：`devkit-go` 通过 `.specs/` 管理 proposal、requirements、design、tasks、verification
- **对工作项目友好**：内建字节内部项目的 bytedcli 强制策略

## 使用前提
在 GitHub Packages 场景下，安装前通常需要准备：
1. 一个有权访问该包的 GitHub 账号
2. 一个可用于 Packages 的 GitHub token
3. 本地 npm registry 配置，指向 GitHub Packages

最小 `.npmrc` 示例：
```ini
@Drizzlezhang:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

如果没有这类配置，即使包已经发布，安装和执行也可能失败。

## 快速开始

### 方式 1：本地开发验证
```bash
node bin/install.js --help
node bin/install.js --project --runtime claude
```

### 方式 2：从 GitHub Packages 安装
```bash
npm install @Drizzlezhang/ai-devkit
```

### 方式 3：安装后运行 CLI（已验证主路径）
```bash
./node_modules/.bin/ai-devkit --project --runtime claude
```

如果你的环境没有为 GitHub Packages 配好 registry 和 token，请先完成上面的 `.npmrc` 配置。
如果要直接使用 `npx @Drizzlezhang/ai-devkit ...`，仍依赖本地 registry 与认证环境，当前文档不把它作为默认验证链路。

## 首次使用路径
1. 配置 GitHub Packages 的 registry 与 token。
2. 安装 `@Drizzlezhang/ai-devkit`。
3. 运行安装器，把 skill 安装到当前项目或 Claude 全局 skills 目录。
4. 在宿主中手动调用 `/devkit-init`，先完成项目扫描、`CLAUDE.md` 方案与安装提案。
5. 当项目进入具体需求实现时，手动调用 `/devkit-go`，按七阶段闭环推进变更。

如果你只是想快速试用，最小路径是：
```bash
npm install @Drizzlezhang/ai-devkit
./node_modules/.bin/ai-devkit --project --runtime claude
```
随后在目标项目里手动调用：
```text
/devkit-init
/devkit-go
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
node bin/install.js --help
./node_modules/.bin/ai-devkit --help
./node_modules/.bin/ai-devkit --project
./node_modules/.bin/ai-devkit --project --runtime claude
./node_modules/.bin/ai-devkit --runtime codex --project
./node_modules/.bin/ai-devkit --runtime trae --project
./node_modules/.bin/ai-devkit --runtime claude --global
```

安装脚本 `bin/install.js` 会：
1. 检测当前环境更接近 Claude Code、Trae CLI 还是 Codex CLI
2. 让用户选择全局安装或项目级安装
3. 复制 `devkit-init` 与 `devkit-go` 的入口 `SKILL.md` 及其 `docs/` 子文档
4. 将 `templates/` 复制到安装后的 `devkit-go` 目录中
5. 输出安装结果摘要

## 运行时支持说明
- Claude Code：已明确支持全局安装到 `~/.claude/skills/` 与项目级安装到 `./.claude/skills/`，也是当前唯一完成完整安装闭环验证的目标宿主
- Codex CLI：官方文档确认配置目录为 `~/.codex/config.toml` 与项目级 `.codex/config.toml`；本工程当前只做运行时识别与项目级兼容预留，不声明官方 Claude-style global skills 目录，也不声明完整 MCP 闭环已验证
- Trae CLI：检测用户级目录 `~/.trae/`；本工程当前只做运行时识别与项目级兼容预留，不声明官方 Claude-style global skills 目录，也不声明完整 MCP 闭环已验证

可以把当前支持理解为：
- **Claude**：识别 + 项目安装 + 全局安装 + 已验证主路径
- **Codex / Trae**：识别 + 实验性项目级兼容预留

## 安装后你会得到什么
安装完成后，目标目录下会出现：
- `devkit-init/`
  - `SKILL.md`
  - `docs/*.md`
- `devkit-go/`
  - `SKILL.md`
  - `docs/*.md`
  - `templates/*`

也就是说，安装器不是只复制一个入口文件，而是把两个 skill 的完整运行上下文一起释放到目标目录。

## Skill 结构说明

### `devkit-init`
- `SKILL.md`：入口、边界、路由规则
- `docs/project-analysis.md`：项目扫描、空项目判断与摘要输出
- `docs/claude-md-strategy.md`：`CLAUDE.md` 生成/优化策略
- `docs/install-planning.md`：安装项规划、确认要求与空项目兜底规则
- `docs/baseline-bootstrap.md`：空项目 / 一句话需求场景下的基础保障模式
- `docs/redundancy-policy.md`：冗余检测与禁用原则
- `docs/bytedcli-policy.md`：字节内部项目强弱信号判定与 bytedcli 安装策略

### `devkit-go`
- `SKILL.md`：入口、阶段路由、总执行约束
- `docs/workflow-overview.md`：总流程、模板映射、阶段推进模板
- `docs/size-routing.md`：Size 推断、阶段序列与切换要求
- `docs/state-management.md`：`STATE.md`、`_meta.yaml` 与恢复模式
- `docs/gates.md`：审核关口与失败处理
- `docs/stage-*.md`：各阶段的输入、动作、产物与规则

## 使用后的能力

### `/devkit-init`
适合在下面场景使用：
- 仓库刚创建，只有一句话需求或几乎没有技术栈信号
- 已有项目准备补齐 `CLAUDE.md`、skill、plugin、MCP 等协作设施
- 想先做环境初始化，再进入具体需求实现

它会做的事：
- 手动触发，不允许模型自动调用
- 以入口 `SKILL.md` + `docs/` 子文档的方式渐进完成初始化
- 扫描项目技术栈与已有 AI 配置
- 对空项目 / 一句话需求场景自动切换到 baseline bootstrap，先给出基础保障安装清单
- 生成新的 `CLAUDE.md`，或在已有 `CLAUDE.md` 基础上提出优化建议
- 规划并安装必要的 skill / plugin / MCP
- 对冗余能力做检测与禁用
- 检测到字节/内部项目时，按强弱信号决定是否强制安装 bytedcli CLI + Skill + MCP

它不会做的事：
- 不会在未确认前直接安装外部能力
- 不会因为“能装”就批量安装重复能力
- 不会把空项目 baseline 描述成最终定型方案

### `/devkit-go`
适合在下面场景使用：
- 用户给出一句话需求，希望形成完整 change 产物并推进落地
- 需要把需求拆成 proposal / requirements / design / tasks / verification
- 需要按阶段做 gate、恢复、重试和最终交付

它会做的事：
- 手动触发，不允许模型自动调用
- 以入口 `SKILL.md` + `docs/` 子文档的方式渐进执行七阶段流程
- 基于需求复杂度自动裁剪阶段
- 通过 `docs/size-routing.md` 决定阶段序列，并在每次切换时显式说明读取文档与跳转原因
- 在 `.specs/` 下管理 proposal / requirements / design / tasks / verification
- 按验证结果决定是否返回 BUILD 阶段重试
- 最终生成 conventional commits 风格提交信息并进入 SHIP

它不会做的事：
- 不会把 `.specs/` 产物写到别处
- 不会跳过验证直接进入 SHIP
- 不依赖 GSD，也不安装 flow-kit

## 典型工作流

### 1. 空项目初始化
```text
用户只有一句话需求
→ 安装 ai-devkit
→ 调用 /devkit-init
→ 命中 baseline bootstrap
→ 输出不为空的基础能力安装计划
→ 用户确认后再安装
```

### 2. 存量项目补协作设施
```text
已有仓库与部分 AI 配置
→ 调用 /devkit-init
→ 扫描现有配置与冗余项
→ 提出 CLAUDE.md 优化与安装计划
→ 用户确认后执行增量改动
```

### 3. 需求闭环开发
```text
用户给出一个功能需求
→ 调用 /devkit-go
→ 创建或恢复一个 change-id
→ 根据 size 裁剪阶段
→ 在 .specs/ 下持续产出与验证
→ 通过 gate 后再进入 ship
```

### 4. 什么时候选项目级 / 全局安装
- **项目级安装**：适合当前仓库试用、团队内按 repo 管理能力、或在 Codex / Trae 中兼容使用
- **全局安装**：适合你已经确定长期在 Claude Code 中复用这两个 skill
- 如果不确定，优先从 `--project` 开始，影响范围更小

## 目录结构
```text
AI-devKit/
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
├── .claude/
│   └── settings.json
├── CLAUDE.md
├── LICENSE
└── README.md
```

## 模板产物
`devkit-go` 使用 `templates/` 中的模板创建以下文件：
- `proposal.md`
- `requirements.md`
- `design.md`
- `tasks.md`
- `verification.md`
- `_meta.yaml`

这些产物会存放在：
```text
.specs/<change-id>/
```

## 开发说明
- 安装脚本只使用 Node.js 内置模块
- `SKILL.md` 应保持“入口 + docs 子文档”结构，避免把所有规则堆在单文件中
- 两个 skill 的 frontmatter 必须始终包含 `trigger: manual`
- 修改安装行为后，至少重新验证一次 `node bin/install.js --help`
- 修改 README 或包元数据时，应与 `package.json`、`bin/install.js`、`skills/*/SKILL.md` 同步核对

### 常用检查命令
```bash
npm run check
npm run pack:check
```

## 发布到 GitHub Packages

### 发布前需要具备
- GitHub 仓库写权限
- 可用于 Packages 发布的 GitHub token
- 本地 npm 已配置 GitHub Packages registry

### 最小发布配置
可以在用户级 `.npmrc` 或项目级配置中加入：
```ini
@Drizzlezhang:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### 建议发布顺序
1. 更新 `package.json` 版本号
2. 运行 `npm run check`
3. 运行 `npm run pack:check`
4. 确认 tarball 内容正确
5. 确认 GitHub token、scope 与 registry 指向正确
6. 执行：
   ```bash
   npm publish
   ```

### 使用侧注意事项
- GitHub Packages 不等于 npm 官方公开仓库
- 安装与执行通常依赖 `.npmrc` 和 token
- `npx @Drizzlezhang/ai-devkit` 是否可直接使用，取决于本地是否已正确配置对应 registry 与认证

如果你的目标是无认证、公开、直接分发给外部用户，GitHub Packages 通常不如 npm 官方仓库合适。
