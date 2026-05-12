# 6-SHIP — 提交发布

## 输入
- 验证通过的代码变更
- `proposal.md`

## 必做事项
- 生成符合 conventional commits 的 commit message
- 执行 `git commit`
- 提示用户是否继续 push 或创建 PR
- 将 `_meta.yaml` 标记为 `completed`

## 产物要求
- git commit hash
- `_meta.yaml` 中 `status: completed`

## 规则
1. commit message 必须是 conventional commits 风格。
2. 如果 Size ≥ L，必须先经过 review gate，再允许提交。
3. 提交后要向用户展示 commit hash。
4. push 和创建 PR 只提示，不默认执行，除非用户明确要求。
