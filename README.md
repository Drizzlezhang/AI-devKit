# AI-devKit

AI-devKit 是一个可通过 `npx` 或 `npm` 安装到 Claude Code / Trae CLI / Code CLI 的 skill 包，提供两个手动触发的核心 skill：
- `devkit-init`：项目开发环境智能初始化
- `devkit-go`：七阶段需求闭环开发

## 安装

### 通过 npx 运行安装器
```bash
npx devkit-cc
```

### 本地开发验证
```bash
node bin/install.js --help
node bin/install.js --project --runtime claude
```

## 安装器行为
安装脚本 `bin/install.js` 会：
1. 检测当前环境更接近 Claude Code、Trae CLI 还是 Code CLI
2. 让用户选择全局安装或项目级安装
3. 复制 `devkit-init` 与 `devkit-go` 的 `SKILL.md`
4. 将 `templates/` 复制到安装后的 `devkit-go` 目录中
5. 输出安装结果摘要

## 目录结构
```text
devkit/
├── package.json
├── bin/
│   └── install.js
├── skills/
│   ├── devkit-init/
│   │   └── SKILL.md
│   └── devkit-go/
│       └── SKILL.md
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
- 扫描项目技术栈与已有 AI 配置
- 生成或优化 `CLAUDE.md`
- 规划并安装必要的 skill / plugin / MCP
- 对冗余能力做检测与禁用
- 检测到字节/内部项目时，强制安装 bytedcli CLI + Skill + MCP

### `/devkit-go`
- 手动触发，不允许模型自动调用
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
- `SKILL.md` 必须保持完整可用 prompt，不使用占位符
- 两个 skill 的 frontmatter 必须始终包含 `trigger: manual`

## 发布
1. 运行 `node bin/install.js --help`
2. 检查 skill 与模板内容
3. 提交变更
4. 发布 npm 包或通过 `npx` 安装验证
