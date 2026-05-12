# Tasks: {{change-id}}

## 任务波次

### Wave 1（无依赖，可并行）
#### T01: ...
- 描述: ...
- read_files: [...]
- write_files: [...]
- verify: `<可执行的验证命令>`
- status: pending

### Wave 2（依赖 Wave 1）
#### T02: ...
- 描述: ...
- depends_on: [T01]
- read_files: [...]
- write_files: [...]
- verify: `<可执行的验证命令>`
- status: pending
