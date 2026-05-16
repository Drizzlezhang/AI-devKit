# AI-devKit

## 工程简介
AI-devKit 是一个可通过 `npx` 或 `npm` 安装的 skill 工程，面向 Claude Code，并为 Trae CLI 与 Codex CLI 提供运行时识别与兼容扩展基础。它提供两个手动触发的核心 skill：
- `devkit-init`：为项目初始化或优化 AI 协作环境
- `devkit-go`：用七阶段闭环流程推进需求实现、验证与交付

## 架构说明
- `skills/devkit-init/SKILL.md`：项目初始化入口 prompt，按需路由到 `docs/`
- `skills/devkit-go/SKILL.md`：七阶段闭环开发入口 prompt，按需路由到 `docs/`
- `skills/*/docs/`：按阶段、策略、关口拆分的子文档

## 开发规范
- 仅使用 Node.js 内置模块实现安装脚本，不引入额外运行时依赖
- 新增能力优先保持最小实现，避免为了未来假设抽象过度
- 修改 skill prompt 时，入口文件只保留目标、边界与路由规则，细节放入 `docs/` 子文档
- `trigger: manual` 必须保持稳定，避免 skill 被模型自动触发
- 改动后至少验证安装脚本帮助输出：`node bin/install.js --help`

## 目录结构说明
- `package.json`：npm 包元数据与 bin 入口
- `bin/`：CLI 安装脚本
- `skills/`：可分发的 skill 定义与子文档
- `templates/`：spec 产物模板
- `README.md`：用户安装与使用说明
- `LICENSE`：MIT 许可

## 测试要求
- 基础验证：`node bin/install.js --help`
- 若修改文件复制逻辑，至少做一次本地安装路径手动验证
- 提交前确认 skill 文件与模板均被纳入 npm `files` 列表

## 发布流程
1. 更新版本号与 README（如有行为变化）
2. 运行 `node bin/install.js --help`
3. 检查安装脚本与 skill 入口/子文档的内容一致性
4. 提交代码并打 tag（如需要）
5. 发布到 npm 或通过 `npx` 进行安装验证

<!-- devkit-managed:start version=1 generated_at=2026-05-16T08:33:57.385Z -->
## DevKit Configuration

This section is managed by `devkit-init`. Do not edit manually.

### Installed Skills
- devkit-init: project bootstrap, audit, adopt
- devkit-go: 7-stage development workflow

### Project Meta
- language: [javascript]
- scale: S
- internal: false

### Workflow Conventions
- 触发 devkit-go 进入 7 阶段流程
- _meta.yaml schema_version: 2
- STATE.md 字段顺序锁定(详见 templates/STATE.md)
<!-- devkit-managed:end -->
