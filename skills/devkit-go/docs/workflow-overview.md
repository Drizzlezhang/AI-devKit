# 工作流总览

## 总流程
```text
0-CHANGE → 1-SPEC → 2-DESIGN → 3-PLAN → 4-BUILD → 5-VERIFY → 6-SHIP
                                                     ↑          |
                                                     └──────────┘
                                                   （验证失败 → 重试）
```

## 调用方式
- `/devkit-go <一句话需求>`：直接启动一个新的 change。
- `/devkit-go`：如果 `.specs/STATE.md` 中存在活跃 change，则继续该 change；否则先询问用户本次要处理的一句话需求。

## 变更即文件夹
每次 `/devkit-go` 必须创建或使用如下目录：
```text
.specs/<change-id>/
├── proposal.md
├── requirements.md
├── design.md
├── tasks.md
├── verification.md
└── _meta.yaml
```

## 模板映射
- `templates/CHANGE.md` → `.specs/<change-id>/proposal.md`
- `templates/REQUIREMENT.md` → `.specs/<change-id>/requirements.md`
- `templates/DESIGN.md` → `.specs/<change-id>/design.md`
- `templates/TASK.md` → `.specs/<change-id>/tasks.md`
- `templates/VERIFICATION.md` → `.specs/<change-id>/verification.md`
- `templates/_meta.yaml` → `.specs/<change-id>/_meta.yaml`
