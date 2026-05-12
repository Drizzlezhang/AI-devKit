# AI-devKit

## 工程简介
AI-devKit 是一个可通过 `npx` 或 `npm` 安装的 skill 工程，面向 Claude Code、Trae CLI 与 Code CLI。它提供两个手动触发的核心 skill：
- `devkit-init`：为项目初始化或优化 AI 协作环境
- `devkit-go`：用七阶段闭环流程推进需求实现、验证与交付

## 架构说明
- `bin/install.js`：安装入口，负责识别运行时、选择安装作用域并释放 skill/template 文件
- `skills/devkit-init/SKILL.md`：项目初始化 meta-prompt
- `skills/devkit-go/SKILL.md`：七阶段闭环开发 meta-prompt
- `templates/`：`devkit-go` 使用的产物模板

## 开发规范
- 仅使用 Node.js 内置模块实现安装脚本，不引入额外运行时依赖
- 新增能力优先保持最小实现，避免为了未来假设抽象过度
- 修改 skill prompt 时，必须保持 frontmatter 与触发方式稳定，尤其是 `trigger: manual`
- 提交信息使用 Conventional Commits
- 改动后至少验证安装脚本帮助输出：`node bin/install.js --help`

## 目录结构说明
- `package.json`：npm 包元数据与 bin 入口
- `bin/`：CLI 安装脚本
- `skills/`：可分发的 skill 定义
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
3. 检查安装脚本与两个 `SKILL.md` 的内容一致性
4. 提交代码并打 tag（如需要）
5. 发布到 npm 或通过 `npx` 进行安装验证
