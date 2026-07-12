---
phase: "16"
plan: "01"
---

# T01: manifest.json version → 1.0.0，package.json name → uni-calendar，三文件版本一致。

**manifest.json version → 1.0.0，package.json name → uni-calendar，三文件版本一致。**

## What Happened

直接编辑两个 JSON 文件：manifest.json version 从 0.1.0 改为 1.0.0，package.json name 从 obsidian-sample-plugin 改为 uni-calendar。versions.json 已有正确条目无需修改。node 验证命令确认三文件一致。

## Verification

node -e 验证输出：manifest.version: 1.0.0 | package.name: uni-calendar | package.version: 1.0.0 | versions keys: [ '1.0.0' ]

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node -e "const m=require('./manifest.json'),p=require('./package.json'),v=require('./versions.json'); console.log('manifest.version:', m.version, '| package.name:', p.name, '| package.version:', p.version, '| versions keys:', Object.keys(v));"` | 0 | ✅ pass | 120ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `manifest.json`
- `package.json`
