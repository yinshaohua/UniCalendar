---
phase: "17"
plan: "01"
---

# T01: README.md 从样板内容完整替换为真实插件描述。

**README.md 从样板内容完整替换为真实插件描述。**

## What Happened

完整重写 README.md（99 行），覆盖功能列表、社区市场安装、手动安装、Google/CalDAV/ICS 配置、使用方法、隐私声明、开发命令。无样板内容残留。

## Verification

grep -c 'UniCalendar' README.md → 6；grep -i 'sample plugin' README.md → 0 行。

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -c 'UniCalendar' README.md` | 0 | ✅ pass — 6 处提及插件名 | 50ms |
| 2 | `grep -i 'sample plugin' README.md | wc -l` | 0 | ✅ pass — 0 行样板内容 | 50ms |

## Deviations

None.

## Known Issues

docs/screenshot.png 占位符尚不存在，S03 创建 Release 时可补充截图。

## Files Created/Modified

- `README.md`
