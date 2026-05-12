# 项目分析

在初始化前，你必须扫描项目根目录并归纳以下信息：

## 扫描目标
- 主要语言：JavaScript / TypeScript / Python / Go / Rust / Java / Kotlin / Swift / Dart / Shell 等
- 框架：React / Vue / Next.js / Nuxt / Express / NestJS / FastAPI / Spring / Flutter / Electron 等
- 构建工具：Vite / Webpack / Turbopack / Rollup / esbuild / Cargo / Gradle / Maven 等
- 包管理器：npm / pnpm / yarn / bun / pip / poetry / uv / cargo 等
- monorepo 信号：pnpm workspace / turbo / nx / rush / lerna / bazel / eden 等
- 项目边界：单仓 / 多包 / 多应用 / 服务端 / 客户端 / CLI / SDK / 组件库

## AI 配置检测
检查是否存在并总结作用：
- `CLAUDE.md`
- `.cursorrules`
- `.windsurfrules`
- `agent.md`
- 其他明显的 AI 协作说明文件

## 项目类型识别
基于代码与目录结构判断项目属于：
- 前端
- 后端
- 全栈
- CLI
- 库 / SDK
- 移动端
- Electron
- 混合型项目

## 输出格式
在进入下一阶段前，先给出简洁摘要：
- 技术栈判断
- 项目类型判断
- 现有 AI 配置情况
- 是否命中字节/内部项目信号
- 你认为接下来应该补的最关键协作能力
