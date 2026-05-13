# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `templates/STATE.md` 作为 change 级状态文件 schema 模板，并增加 `Recent Changes` 历史段。
- `bin/render-template.js` 作为模板分段渲染的唯一入口脚本。

### Changed
- `devkit-go` 的状态管理文档与各阶段退出检查清单统一要求维护 `STATE.md.Recent Changes`。
- `bin/smoke.js` 开始校验 change 级 `STATE.md` 的字段顺序与 schema 兼容性。
- VERIFY 阶段增加 retry-limit gate、升级/降级/中止三选一，以及 abandoned change 的归档约定。
- `_meta.yaml` 升级为 schema v2，并为跨会话恢复补充 `last_*` 字段与优先读取规则。
- 模板分段语义收敛到 `bin/render-template.js`，相关 stage 文档改为引用统一渲染规则与阶段切换仪式。
- `REQUIREMENT.md` 的验收标准升级为 `AC | 验证方式` 对账格式，`VERIFICATION.md` 与 SPEC/VERIFY 文档同步要求按该列执行验证。
- `devkit-go` 的 gate matrix 收敛为按 Size 分级：M 默认仅强制 `post-spec` 与 `pre-commit`，L 保持完整 gate。

## [0.1.2] - 2026-05-13

### Added
- `.devkit/project.yaml` 作为共享项目元信息池与检测缓存。
- `bin/detect.js` 项目检测脚本，支持 fingerprint、TTL 与 `--refresh`。
- 模板按 Size 分段渲染的 HTML 注释方案。
- `CHANGELOG.md` 与版本变更纪律。
- `bin/smoke.js` 端到端冒烟测试与 CI 接入。

### Changed
- `devkit-init` 启动时优先读取或生成 `.devkit/project.yaml`，并在项目级安装后回写 `ai_configs.installed_skills`。
- `devkit-go` Size 推断优先读取 `.devkit/project.yaml.project.scale`。
- `devkit-go` 模板加载规则明确为按 `_meta.yaml.size` 裁剪模板分段。
- CLI 接入采用 `ai-devkit` + `ai-devkit-detect` 双入口，而不是把 detect 合并进安装器参数解析。

## [0.1.0] - 2026-05-12

### Added
- 初始 devkit 工程结构与 npm 包元数据。
- `devkit-init` 与 `devkit-go` 两个手动触发 skill。
- 七阶段闭环工作流与 `.specs/` 产物模板。
- 空项目 baseline bootstrap 与 bytedcli / caveman / grill-me 基础策略。
- GitHub Packages 分发入口与安装脚本。

### Changed
- 将 skill prompt 拆分为 `SKILL.md` + `docs/` 子文档结构。
- README、运行时识别与安装器帮助文案对齐 Claude / Trae / Codex 支持边界。
- `devkit-go` 增加 XS `5-lite`、`partial-pass`、`pre-commit`、恢复与 Context Budget 规则。
