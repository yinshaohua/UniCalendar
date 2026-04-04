---
phase: 06-chinese-lunar-calendar
verified: 2026-04-05T02:43:00Z
status: human_needed
score: 10/12 must-haves auto-verified (2 require human visual check)
human_verification:
  - test: "打开 Obsidian 月视图，确认每个日历格右侧显示农历文字（较小字体、淡色）"
    expected: "每格日期数字右侧有农历日期/节日/节气文字；春节等节日显示为粗体强调色；小寒等节气显示为蓝调色"
    why_human: "DOM 渲染结果只能在实际 Obsidian 宿主环境中目视确认，programmatic 测试覆盖了计算逻辑但无法验证最终视觉输出"
  - test: "确认工具栏标题在月视图中显示 '农历X月'，切换到周/日视图后农历月消失"
    expected: "月视图：标题形如 '2026年4月 农历三月'；周/日视图：仅显示 Gregorian 标题"
    why_human: "视图切换行为和 DOM 更新需要运行时环境验证"
  - test: "导航到 2026-10-01（国庆节），确认月视图格子有浅红色背景和右上角红底'休'徽章"
    expected: "格子背景为 color-mix(#ef4444 8%)，右上角有红底白字'休'标记"
    why_human: "CSS color-mix 渲染和徽章绝对定位需要浏览器渲染上下文"
  - test: "确认 2026-02-14（补班日）月视图格子有浅琥珀色背景和'班'徽章"
    expected: "格子背景为 color-mix(#f59e0b 8%)，右上角有琥珀底白字'班'标记"
    why_human: "同上"
  - test: "切换到周视图，在包含假日的周（如国庆假期）验证日列有红色背景和头部'休'徽章"
    expected: "周视图：假日列有浅红色背景；日视图：当天假日背景和头部徽章"
    why_human: "多视图一致性需要人工切换验证"
  - test: "在设置中关闭'显示农历'开关，确认月视图农历文字和工具栏农历月立即消失"
    expected: "开关关闭后日历视图立即刷新，不再显示农历信息；再次打开后恢复"
    why_human: "设置切换的即时响应需要实际交互验证"
  - test: "在设置中关闭'显示法定节假日'开关，确认假日背景和徽章立即消失"
    expected: "开关关闭后，休/班徽章和背景色消失；再次打开后恢复"
    why_human: "同上"
  - test: "检查今日格：应只有日期数字圆圈（强调色背景），格子本身无背景色"
    expected: "今日格格子背景与普通格相同；日期数字有圆形强调色背景（D-09）"
    why_human: "CSS 背景层叠需要视觉确认"
---

# 阶段 6：中国农历日历支持 验证报告

**阶段目标：** 向所有日历视图添加农历日期覆盖层，包括农历日期、节气、传统节日和法定节假日指示器
**验证时间：** 2026-04-05T02:43:00Z
**状态：** human_needed
**重新验证：** 否 — 初次验证

## 目标达成情况

### 可观测真值

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | LunarService 在有传统节日时返回节日名称 | ✓ 已验证 | 12 个测试通过；春节/元宵/端午/中秋/重阳均有测试 |
| 2 | LunarService 在有节气时返回节气名称 | ✓ 已验证 | 测试 '2026-01-05 小寒' 通过，type=solarTerm |
| 3 | LunarService 普通日期返回农历日 | ✓ 已验证 | 测试 '2026-03-15 lunarDay' 通过 |
| 4 | LunarService 返回工具栏农历月名 | ✓ 已验证 | getLunarMonthForTitle 有测试且通过 |
| 5 | HolidayService 对法定节假日返回 'rest' | ✓ 已验证 | 元旦、春节、国庆测试均通过 |
| 6 | HolidayService 对补班日返回 'work' | ✓ 已验证 | 2026-02-14、2026-10-10 补班测试通过 |
| 7 | HolidayService 对普通日返回 null | ✓ 已验证 | 普通工作日和普通周末测试通过 |
| 8 | chinese-days 2026 静态节假日数据存在且可用 | ✓ 已验证 | 国庆、劳动节数据验证测试通过 |
| 9 | UniCalendarSettings 有 showLunarCalendar 默认 true | ✓ 已验证 | types.ts 第 44 行；DEFAULT_SETTINGS 第 87 行；类型测试通过 |
| 10 | UniCalendarSettings 有 showHolidays 默认 true | ✓ 已验证 | types.ts 第 45 行；DEFAULT_SETTINGS 第 88 行；类型测试通过 |
| 11 | 月视图日格显示农历文字（节日/节气/农历日优先级正确）| ? 需人工 | CalendarView.ts 第 999-1007 行有正确实现；需视觉确认 |
| 12 | 三个视图的法定节假日背景和徽章 | ? 需人工 | CalendarView.ts 第 978、1011-1020、1120-1162、1194-1227 行；需视觉确认 |

**得分：** 10/12 真值已自动验证（2 项需人工）

### 延迟项

无。所有功能均在本阶段实现，未延迟到后续阶段。

---

## 必要工件

| 工件 | 预期内容 | 状态 | 详情 |
|------|---------|------|------|
| `src/lunar/LunarService.ts` | 农历计算封装，D-02 优先级 | ✓ 已验证 | 存在；54 行；导出 LunarService 和 LunarDayInfo；含 month+1 偏移处理 |
| `src/lunar/HolidayService.ts` | 节假日类型检测封装（静态数据） | ✓ 已验证 | 存在；61 行；导出 HolidayService、HolidayInfo、HolidayType；含 try-catch；无 requestUrl |
| `src/lunar/index.ts` | 清晰导入的再导出桶 | ✓ 已验证 | 存在；4 行；导出全部 4 个名称 |
| `tests/lunar/LunarService.test.ts` | 农历显示优先级和节日映射单元测试 | ✓ 已验证 | 12 个测试，全部通过 |
| `tests/lunar/HolidayService.test.ts` | 节假日类型检测和 2026 数据单元测试 | ✓ 已验证 | 11 个测试，全部通过 |
| `src/models/types.ts` | 含农历/节假日开关的扩展设置 | ✓ 已验证 | showLunarCalendar: boolean（第 44 行）；showHolidays: boolean（第 45 行）；默认值均为 true（第 87-88 行） |
| `src/settings/SettingsTab.ts` | 农历和节假日切换 UI | ✓ 已验证 | 第 251-273 行：'农历与节假日' 标题 + 两个开关；onChange 均调用 refreshCalendarViews() |
| `tests/settings/types.test.ts` | 验证默认值的单元测试 | ✓ 已验证 | 第 50-56 行有两个默认值测试，通过 |
| `src/views/CalendarView.ts` | 全视图农历/节假日集成 | ✓ 已验证（逻辑层） | 导入、类字段、月视图渲染、工具栏、周/日视图均已实现；需视觉确认 |

---

## 关键链路验证

| 来源 | 目标 | 通过 | 状态 | 详情 |
|------|------|------|------|------|
| `src/lunar/LunarService.ts` | `chinese-days` | 命名导入 | ✓ 已连接 | 第 1 行：`import { getLunarDate, getSolarTerms, getLunarFestivals } from 'chinese-days'` |
| `src/lunar/HolidayService.ts` | `chinese-days` | 命名导入 | ✓ 已连接 | 第 1 行：`import { getDayDetail } from 'chinese-days'` |
| `src/views/CalendarView.ts` | `src/lunar/index.ts` | `import { LunarService, HolidayService }` | ✓ 已连接 | 第 5 行：`import { LunarService, HolidayService } from '../lunar'` |
| `src/views/CalendarView.ts` | `src/models/types.ts` | `this.plugin.settings.showLunarCalendar` | ✓ 已连接 | 第 835、999 行调用设置字段 |
| `src/settings/SettingsTab.ts` | `src/views/CalendarView.ts` | `refreshCalendarViews` via workspace 迭代 | ✓ 已连接 | SettingsTab 第 261、270 行；main.ts 第 117-125 行实现 getLeavesOfType + rerender() |

---

## 数据流追踪（第 4 层）

| 工件 | 数据变量 | 来源 | 产生真实数据 | 状态 |
|------|---------|------|------------|------|
| CalendarView.ts 月视图 | `lunarInfo` | `this.lunarService.getLunarDayInfo(ly, lm-1, ld)` | 是 — chinese-days 表格查找 | ✓ 流通 |
| CalendarView.ts 月视图 | `holidayInfo` | `this.holidayService.getHolidayInfo(dateStr)` | 是 — chinese-days 静态数据 | ✓ 流通 |
| CalendarView.ts 工具栏 | `lunarMonth` | `this.lunarService.getLunarMonthForTitle(year, month)` | 是 — chinese-days 表格查找 | ✓ 流通 |
| CalendarView.ts 周视图 | `weekHolidays[i]` | `this.holidayService.getHolidayInfo(dateStr)` | 是 — 预计算数组 | ✓ 流通 |
| CalendarView.ts 日视图 | `holidayInfo` | `this.holidayService.getHolidayInfo(dateStr)` | 是 — chinese-days 静态数据 | ✓ 流通 |

---

## 行为抽查（第 7b 步）

| 行为 | 命令 | 结果 | 状态 |
|------|------|------|------|
| 农历测试通过（23 个） | `npx vitest run tests/lunar/` | 23 个测试通过，0 失败 | ✓ 通过 |
| 设置默认值测试通过 | `npx vitest run tests/settings/types.test.ts` | 7 个测试通过，0 失败 | ✓ 通过 |
| 总测试套件（30 个）通过 | `npx vitest run tests/lunar/ tests/settings/types.test.ts` | 30 个测试通过 | ✓ 通过 |
| 构建成功 | `npm run build` | 退出码 0，无错误 | ✓ 通过 |
| HolidayService 无网络调用 | grep requestUrl in HolidayService.ts | 无匹配 | ✓ 通过 |
| HolidayService 含优雅回退 | grep try in HolidayService.ts | 第 37 行 try-catch 存在 | ✓ 通过 |

---

## 需求覆盖

**注意：** D-01 至 D-12 是阶段 6 内部用户决策编号（在 06-DISCUSSION-LOG.md/06-UI-SPEC.md 中定义），而非 REQUIREMENTS.md 中的正式需求条目。REQUIREMENTS.md 未将任何需求映射到阶段 6。以下追踪基于 ROADMAP.md 的成功标准。

| ROADMAP 成功标准 | 支持计划 | 实现证据 | 状态 |
|----------------|---------|---------|------|
| 每个日历日格显示对应的中国农历日期 | 06-01, 06-03 | CalendarView.ts 第 999-1007 行渲染农历文字 | ✓ 满足（需视觉确认） |
| 节气（24节气）在正确日期有视觉指示 | 06-01, 06-03 | LunarService 节气优先级；CSS `.uni-calendar-lunar-text--solar-term`（第 535 行） | ✓ 满足（需视觉确认） |
| 当前年份中国大陆法定节假日和补班日清晰标示 | 06-01, 06-03 | HolidayService + CalendarView 背景/徽章渲染；2026 数据测试通过 | ✓ 满足（需视觉确认） |
| 农历/节假日信息在桌面端和移动端正确渲染 | 06-03 | 使用 CSS 自定义属性和 Obsidian 变量（自适应）；响应式设计依赖 Obsidian 框架 | ? 需人工（移动端验证） |

**REQUIREMENTS.md 正式需求覆盖：** D-01 至 D-12 不属于 REQUIREMENTS.md 中的条目，因此无法进行正式需求追踪。阶段 6 的功能不与任何 v1 或 v2 REQUIREMENTS.md 条目绑定。

---

## 发现的反模式

| 文件 | 行号 | 模式 | 严重性 | 影响 |
|------|-----|------|--------|------|
| 无 | - | 无桩代码或占位符发现 | - | - |

特别检查：
- HolidayService.ts：无 `requestUrl`、无 `Notice`、无网络调用 — 符合 D-11 静态数据范围
- CalendarView.ts：holidayInfo 每格计算一次并复用（无重复调用）
- LunarService.ts：`month + 1` 偏移处理存在（第 13 行），避免 JS 0 基月份错误

---

## 需人工验证的事项

### 1. 月视图农历文字渲染

**测试：** 在已加载插件的 Obsidian 中打开日历月视图，检查各日格
**预期：** 每格日期数字右侧有农历文字（较小字体、淡色）；春节/元宵等节日显示为粗体强调色；小寒等节气显示为蓝调色
**需人工原因：** CSS 渲染和 DOM 可见性只能在 Obsidian 宿主环境中验证

### 2. 工具栏农历月显示

**测试：** 月视图下查看工具栏标题；再切换到周/日视图
**预期：** 月视图显示 "2026年4月 农历三月"（格式）；切换到周/日视图后农历月部分消失
**需人工原因：** 视图切换和 DOM 更新需要运行时环境

### 3. 法定节假日视觉指示（月视图）

**测试：** 导航到 2026-10-01（国庆节首日）
**预期：** 格子有浅红色背景；右上角有红底白字"休"徽章
**需人工原因：** `color-mix()` CSS 渲染和绝对定位需要浏览器渲染验证

### 4. 补班日视觉指示（月视图）

**测试：** 导航到 2026-02-14（春节补班日）
**预期：** 格子有浅琥珀色背景；右上角有琥珀底白字"班"徽章
**需人工原因：** 同上

### 5. 周/日视图节假日指示

**测试：** 切换到周视图，导航到含假日的周；再切换到日视图查看假日当天
**预期：** 周视图：假日日列有浅红色背景，日头部有"休"徽章；日视图：背景和头部徽章
**需人工原因：** 多视图一致性需要实际切换操作

### 6. 设置开关即时响应

**测试：** 在 Obsidian 设置 > "农历与节假日" 中分别切换"显示农历"和"显示法定节假日"
**预期：** 每次切换后，日历视图立即刷新（无需关闭再开），显示/隐藏对应元素
**需人工原因：** onChange 即时响应链路（saveSettings + refreshCalendarViews + rerender）需要交互验证

### 7. 今日格无背景色（D-09）

**测试：** 在月视图找到今日格（通常有圆圈标记）
**预期：** 今日格格子背景与普通格相同；只有日期数字有强调色圆形背景
**需人工原因：** 需要视觉确认 CSS 背景层叠和今日格样式

### 8. 移动端渲染

**测试：** 在 iOS 或 Android 上的 Obsidian 中打开日历（或使用开发者工具模拟）
**预期：** 农历文字和徽章在移动屏幕宽度下可读，不溢出或遮挡事件
**需人工原因：** 响应式行为需要实际设备或模拟器

---

## 差距摘要

无程序可验证的差距。所有自动可检查的实现均已到位：

- LunarService 和 HolidayService 经过 30 个测试完整验证
- 设置字段和 UI 已实现并测试
- CalendarView 集成了农历/节假日渲染，数据流端到端追踪完整
- 构建无错误通过

剩余 8 项需人工验证的全部属于视觉/UI 层面的确认，这些无法通过程序化手段检测。等待人工视觉验收。

---

_验证时间：2026-04-05T02:43:00Z_
_验证者：Claude (gsd-verifier)_
