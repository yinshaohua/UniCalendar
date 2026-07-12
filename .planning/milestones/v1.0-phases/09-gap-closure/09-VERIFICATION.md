---
phase: 09-gap-closure
verified: 2026-04-05T15:40:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "确认 defaultView 设置生效：在设置中将默认视图改为 week 或 day，关闭再打开 UniCalendar，观察打开后是否直接进入 week/day 视图"
    expected: "插件打开后直接显示用户在设置中选择的视图模式（week 或 day），而非硬编码的 month 视图"
    why_human: "onOpen 中 currentViewMode 的赋值无法通过静态分析验证实际渲染效果；需在真实 Obsidian 实例中运行才能确认设置读取与 UI 渲染的完整链路"
  - test: "确认闰月 '闰' 前缀显示：在包含农历闰月的月份（如 2025 年 6-7 月为闰六月）导航至该月，检查工具栏月份标签"
    expected: "工具栏显示 '闰六月' 而非 '六月'"
    why_human: "getLunarMonthForTitle 的 isLeap 返回值依赖 chinese-days 库对实际日期的计算，无法通过静态代码分析确认视觉输出正确性；需在实际插件 UI 中观察"
  - test: "INFR-03 视觉质量检验：在 Obsidian 桌面和移动端打开 UniCalendar，检查整体视觉风格"
    expected: "UI 呈现圆角、柔和配色、清晰排版，与 Apple Calendar 美学一致"
    why_human: "INFR-03 明确标注为 'human visual check pending'，视觉质量无法通过代码静态分析验证"
---

# Phase 9: Gap Closure 验证报告

**Phase Goal:** Close all code-level gaps identified by v1.0 milestone audit — wire defaultView setting, fix leap month display, fix failing tests, verify Phase 7, and update stale traceability
**Verified:** 2026-04-05T15:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths（来自 ROADMAP.md 成功标准）

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | CalendarView 在打开时读取 `settings.defaultView` 而非硬编码 'month' | VERIFIED | `src/views/CalendarView.ts` 第 646 行：`this.currentViewMode = this.plugin.settings.defaultView;`，位于 `onOpen()` 方法内，第 642 行 `container.empty()` 之后 |
| 2 | `getLunarMonthForTitle()` 为闰月添加 '闰' 前缀 | VERIFIED | `src/lunar/LunarService.ts` 第 85 行：`return lunar.isLeap ? \`闰${lunar.lunarMonCN}\` : lunar.lunarMonCN;` |
| 3 | 全天事件结束日期测试通过（修正测试期望值） | VERIFIED | ICS 测试（第 109 行）期望 '2026-04-01'（已修正自 '2026-04-02'）；Google 测试（第 182 行）期望 '2026-04-05'（已修正自 '2026-04-06'）；完整测试套件：97 个测试全部通过，0 失败 |
| 4 | Phase 7 有 VERIFICATION.md | VERIFIED | `.planning/phases/07-lunar-solar-terms-source-display/07-VERIFICATION.md` 存在，frontmatter 包含 `status: passed`，`score: 7/7` |
| 5 | REQUIREMENTS.md 追踪表反映实际满足状态（12 个过期复选框已修正） | VERIFIED | REQUIREMENTS.md 包含 17 个 `[x]` 复选框和 2 个 `[ ]` 复选框（SYNC-02、INFR-03 标记为部分满足），追踪表 Status 列全部正确，最后更新日期为 2026-04-05 |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/views/CalendarView.ts` | defaultView setting wired to currentViewMode | VERIFIED | 第 646 行包含 `this.plugin.settings.defaultView`，位于 `onOpen()` 方法体内（第 641 行方法声明后） |
| `src/lunar/LunarService.ts` | 闰月前缀逻辑 | VERIFIED | 第 85 行：`lunar.isLeap ? \`闰${lunar.lunarMonCN}\` : lunar.lunarMonCN`；第 58 行另有 `!lunar.isLeap` 用于动态除夕检测 |
| `tests/sync/IcsSyncAdapter.test.ts` | 修正全天事件结束日期测试 | VERIFIED | 第 109 行：`expect(event.end).toContain('2026-04-01')`（含正确注释 "adapter normalizes exclusive DTEND to inclusive end date"） |
| `tests/sync/GoogleSyncAdapter.test.ts` | 修正全天事件结束日期测试 | VERIFIED | 第 182 行：`expect(events[0]!.end).toBe('2026-04-05')`（含注释 "adapter normalizes exclusive end date to inclusive"） |
| `.planning/phases/07-lunar-solar-terms-source-display/07-VERIFICATION.md` | Phase 7 验证报告 | VERIFIED | 文件存在，frontmatter `status: passed`，Observable Truths 表 7/7 VERIFIED，包含 LunarService.ts 行号证据 |
| `.planning/REQUIREMENTS.md` | 已修正的追踪表 | VERIFIED | 17 个 [x]，2 个 [ ]，追踪表 Status 列准确，最后更新 2026-04-05 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/settings/SettingsTab.ts` | `src/views/CalendarView.ts` | `plugin.settings.defaultView` | WIRED | CalendarView.onOpen() 第 646 行读取 `this.plugin.settings.defaultView`；settings 对象由 SettingsTab 持久化 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `src/views/CalendarView.ts` | `currentViewMode` | `this.plugin.settings.defaultView` | Yes — 来自 Obsidian 持久化的用户设置 | FLOWING |
| `src/lunar/LunarService.ts` | `lunar.isLeap` | `getLunarDate(dateStr)` from `chinese-days` 库 | Yes — 基于真实农历日期计算 | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 全部 97 个测试通过 | `npx vitest run` | 97 passed (10 files), 0 failed, 0 skipped | PASS |
| CalendarView.ts 包含 defaultView wiring | `grep -n "this.plugin.settings.defaultView" src/views/CalendarView.ts` | 第 646 行匹配 | PASS |
| LunarService.ts 包含 isLeap 检查 | `grep -n "isLeap" src/lunar/LunarService.ts` | 第 58 行（除夕检测）和第 85 行（闰月前缀）均匹配 | PASS |
| ICS 测试使用包含日期 | `grep -n "2026-04-01\|2026-04-02" tests/sync/IcsSyncAdapter.test.ts` | 仅 2026-04-01 出现于 event.end 期望值（无 2026-04-02） | PASS |
| Google 测试使用包含日期 | `grep -n "2026-04-05\|2026-04-06" tests/sync/GoogleSyncAdapter.test.ts` | end 期望值为 2026-04-05（原始 mock 数据 end.date 为 2026-04-06，适配器转换） | PASS |
| REQUIREMENTS.md 有 17 个 [x] | `grep -c "\[x\]" .planning/REQUIREMENTS.md` | 17 | PASS |
| Phase 7 VERIFICATION.md 存在 | 文件检查 | 存在，status: passed，score: 7/7 | PASS |
| 所有文档提交有效 | `git log --oneline 485d83e c1a9aed bbdb3fc a5eb072` | 4 个提交均存在于 git 历史 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| VIEW-02 | 09-01-PLAN.md | 用户可以查看周视图 | SATISFIED | 周视图实现于 Phase 2；09-01 通过 wiring defaultView 确保设置被尊重；REQUIREMENTS.md 已更新为 [x] |
| VIEW-03 | 09-01-PLAN.md | 用户可以查看日视图 | SATISFIED | 同上 |
| VIEW-04 | 09-01-PLAN.md | 用户可以切换视图 | SATISFIED | 同上 |
| VIEW-05 | 09-01-PLAN.md | 用户可以导航到今天 | SATISFIED | 同上 |
| VIEW-06 | 09-01-PLAN.md | 键盘导航 | SATISFIED | 同上 |
| SYNC-02 | 09-02-PLAN.md | CalDAV 同步（包括钉钉） | PARTIAL | 代码实现存在；DingTalk 真实服务器测试仍待人工验证；REQUIREMENTS.md 正确标记为 [ ] |
| SYNC-03 | 09-01-PLAN.md | ICS 订阅导入 | SATISFIED | ICS 测试（97/97）通过；全天事件结束日期修正正确 |
| EVNT-01 | 09-01-PLAN.md | 按来源颜色编码事件 | SATISFIED | Phase 2 实现；REQUIREMENTS.md 已更新 |
| EVNT-02 | 09-01-PLAN.md | 事件详情弹窗 | SATISFIED | 同上 |
| EVNT-03 | 09-01-PLAN.md | 重复事件展开 | SATISFIED | 同上 |
| EVNT-04 | 09-01-PLAN.md | 时区处理 | SATISFIED | 同上 |
| INFR-03 | 09-02-PLAN.md | Apple Calendar 风格 UI | PARTIAL | CSS 实现存在（Phase 5）；视觉质量需人工检验；REQUIREMENTS.md 正确标记为 [ ] |
| INFR-04 | 09-02-PLAN.md | 桌面和移动端均可运行 | SATISFIED | REQUIREMENTS.md 已更新为 [x]；Phase 1 中已验证 |

---

### Anti-Patterns Found

扫描了 4 个在此 Phase 修改的文件，未发现阻碍性反模式。

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| （无） | — | — | — | — |

无 TODO/FIXME/PLACEHOLDER 注释，无存根返回值，无空数据道具。

---

### Human Verification Required

#### 1. defaultView 设置生效验证

**Test:** 在 Obsidian 设置中将 UniCalendar 的"默认视图"改为"week"或"day"。关闭并重新打开 UniCalendar 侧栏视图。
**Expected:** 插件打开后直接显示用户在设置中选择的视图模式（week 或 day），而非 month 视图。
**Why human:** `onOpen()` 第 646 行的赋值 `this.currentViewMode = this.plugin.settings.defaultView` 通过静态分析确认存在，但需要在真实 Obsidian 实例中验证渲染路径——即 currentViewMode 是否正确控制初始渲染逻辑。

#### 2. 闰月 '闰' 前缀显示验证

**Test:** 导航至包含农历闰月的公历月份（例如 2025 年 6-7 月区间包含闰六月）。观察 UniCalendar 工具栏中的农历月份标签。
**Expected:** 工具栏显示 "闰六月" 而非 "六月"。
**Why human:** `getLunarMonthForTitle()` 中的 `lunar.isLeap` 检查通过代码审查已确认（第 85 行），但视觉输出正确性（正确月份显示 "闰"、其他月份不显示）需要在实际插件 UI 中观察，以防 chinese-days 库行为或渲染逻辑存在边界情况。

#### 3. INFR-03 Apple Calendar 风格 UI 视觉验证

**Test:** 在 Obsidian 桌面和移动端打开 UniCalendar，浏览月视图、周视图、日视图。
**Expected:** UI 呈现圆角、柔和配色、清晰排版，整体风格与 Apple Calendar 美学一致；事件块、日期单元格、导航元素保持一致的间距和视觉权重。
**Why human:** INFR-03 在 REQUIREMENTS.md 中明确标注为 "(human visual check pending)"，CSS 实现于 Phase 5，视觉质量属于主观判断，无法通过代码静态分析验证。

---

### Gaps Summary

所有 5 个可编程验证的 must-have truths 均已通过。

3 个人工验证项不影响代码完整性判断，但需要在真实 Obsidian 环境中确认端到端行为：

1. **defaultView wiring 实际渲染效果** — 代码已正确修改，onOpen 中读取了 settings，但用户可见的视图切换效果需人工确认
2. **闰月前缀视觉输出** — isLeap 逻辑已实现，但特定农历闰月日期的实际工具栏显示需人工确认
3. **INFR-03 视觉质量** — 该需求本身就标注为 "human visual check pending"，超出本次自动化验证范围

这些人工项均属于 INFR-03（视觉）和运行时行为范畴，不属于代码层面的 gap——它们反映了 v1.0 milestone audit 中原本就存在的"需人工测试"项目。

---

_Verified: 2026-04-05T15:40:00Z_
_Verifier: Claude (gsd-verifier)_
