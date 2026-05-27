# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- `bin/install.js` 将 Codex 项目级安装目标改为 `.codex/skills`，并写入 `AGENTS.md` managed block；`--global --runtime codex` 明确报不支持。
- `bin/detect.js` 审计改为 runtime 感知路径（Claude/Trae/Codex），并新增 Codex legacy 布局提示。
- `bin/smoke.js` 新增 Codex 安装与全局拒绝场景，覆盖 `.codex/skills` 与 `AGENTS.md` 行为。
- `README.md` 运行时支持矩阵同步更新为 Codex 项目级完整支持。

## [0.2.2] - 2026-05-18

### Changed
- 版本升级到 `0.2.2`，补充发行记录与校验对齐。

## [0.2.1] - 2026-05-18

### Added
- `templates/README.md` 模板文件，支持按 project.scale 分段渲染。
- `skills/devkit-init/docs/readme-strategy.md`，定义 README 生成/评估/巡检策略。
- `skills/devkit-go/docs/readme-update-check.md`，定义 SHIP 阶段 README 更新检查流程。
- `bin/detect.js` 新增 `has_readme` 字段输出。

### Changed
- `skills/devkit-init/SKILL.md` 入口增加 README 生命周期管理职责。
- `skills/devkit-go/docs/stage-6-ship.md` 退出检查清单增加 README 同步检查。

## [0.2.0] - 2026-05-14

### Added
- `skills/devkit-init/seeds.yaml`，27 条精选种子（skill 20 条 + MCP 7 条，全部 ≥ 5k GitHub Stars），含条件匹配、安装命令与 MCP 配置片段。
- `skills/devkit-init/docs/seed-recommend.md`，两级推荐模型文档（精选种子优先 → find-skill 备选）。
- `bin/detect.js` 在 bootstrap / adopt 流程末尾输出 `recommended_seeds` 推荐列表，排除已装 skill。
- MCP 种子推荐支持：seeds.yaml 新增 `type`/`mcp_config`/`requires_auth` 字段，detect.js 输出 MCP 种子的类型与认证标记。
- MCP 种子扩展：新增 memory-mcp、sequential-thinking-mcp、mcp-registry 3 条 MCP 种子，detect.js 新增 `find_mcp_hint` 和 `mcp_scope` 输出。
- `templates/STATE.md` 作为 change 级状态文件 schema 模板，并增加 `Recent Changes` 历史段。
- `bin/render-template.js` 作为模板分段渲染的唯一入口脚本。
- `skills/devkit-init/docs/runtime-decision.md`，定义 devkit-init 的运行时档位判定树与显式覆盖规则。
- `templates/CLAUDE.md`，带 `<!-- devkit-managed:start -->` ~ `<!-- devkit-managed:end -->` 标记块的模板。
- `skills/devkit-init/docs/adopt-flow.md`，描述接入档位的合并流程与边界规则。

### Changed
- `skills/devkit-init/SKILL.md` 首装与接入分支末尾追加种子推荐环节。
- `bin/smoke.js` 新增种子推荐场景覆盖：TS 匹配、无条件种子、已装排除、无匹配提示、格式错误降级。
- `devkit-go` 的状态管理文档与各阶段退出检查清单统一要求维护 `STATE.md.Recent Changes`。
- `bin/smoke.js` 开始校验 change 级 `STATE.md` 的字段顺序与 schema 兼容性。
- VERIFY 阶段增加 retry-limit gate、升级/降级/中止三选一，以及 abandoned change 的归档约定。
- `_meta.yaml` 升级为 schema v2，并为跨会话恢复补充 `last_*` 字段与优先读取规则。
- 模板分段语义收敛到 `bin/render-template.js`，相关 stage 文档改为引用统一渲染规则与阶段切换仪式。
- `REQUIREMENT.md` 的验收标准升级为 `AC | 验证方式` 对账格式，`VERIFICATION.md` 与 SPEC/VERIFY 文档同步要求按该列执行验证。
- `devkit-go` 的 gate matrix 收敛为按 Size 分级：M 默认仅强制 `post-spec` 与 `pre-commit`，L 保持完整 gate。
- `devkit-init` 入口改为先做运行时档位判定，再按首装 / 接入 / 巡检 / 静默分支执行。
- `bin/detect.js` 通过环境变量 `DEVKIT_INIT_TIER` 支持 `bootstrap` / `adopt` / `audit` / `silent` 四种行为，默认 `bootstrap` 保持向下兼容。
- `project.yaml` 新增 `ai_configs.managed_by` 字段，`adopt` 模式下值为 `user`。
- `bin/install.js` 新增 `writeManagedBlock` 函数，所有 CLAUDE.md 写入走标记块协议，不覆盖用户手写区域。
- `skills/devkit-init/docs/install-planning.md` 增加"标记块协议"段。
- `bin/detect.js` audit 模式增加 skill 健康度检测与漂移分级（高/中/低），并检查 `CLAUDE.md` 标记块一致性。
- `skills/devkit-init/docs/runtime-decision.md` 增加"漂移分级与修复策略"段。
- `skills/devkit-init/docs/redundancy-policy.md` 增补接入档位例外：用户已装 skill 视为白名单。
- `bin/install.js` 支持 Trae 项目级安装：`--runtime trae` 时 skill 安装到 `.trae/skills/`，managed block 写入 `AGENTS.md`。

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
