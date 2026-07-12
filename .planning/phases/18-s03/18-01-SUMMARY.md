---
phase: "18"
plan: "01"
---

# T01: GitHub Release 1.0.0 已发布，三个附件齐全。

**GitHub Release 1.0.0 已发布，三个附件齐全。**

## What Happened

用户在 https://github.com/yinshaohua/UniCalendar/releases/new 手动创建 Release 1.0.0，上传 main.js（188KB）、manifest.json（276B）、styles.css（20KB）三个附件。API 验证确认 tag=1.0.0，draft=false，prerelease=false，assets 三个均 state=uploaded。

## Verification

curl GitHub API 确认：tag_name=1.0.0，draft=false，assets=[main.js, manifest.json, styles.css]。

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `curl -s https://api.github.com/repos/yinshaohua/UniCalendar/releases/tags/1.0.0` | 0 | ✅ pass — tag=1.0.0, draft=false, 3 assets uploaded | 800ms |

## Deviations

由用户在 GitHub 网页手动完成，原因是本地无 gh CLI 且无 GitHub token。

## Known Issues

None.

## Files Created/Modified

None.
