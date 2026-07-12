# Phase 6: Chinese Lunar Calendar Support - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

在日历视图中展示中国农历日期、二十四节气、以及当前年度中国大陆法定节假日和调休工作日。不涉及新的日历数据源或同步功能——纯粹是在现有视图上叠加农历/节假日信息层。

</domain>

<decisions>
## Implementation Decisions

### 农历日期显示
- **D-01:** 月视图日格中，农历信息显示在公历日期数字的右侧，同行排列，使用较小字号。
- **D-02:** 显示优先级：传统节日名称 > 节气名称 > 农历日期（初一~三十）。有节日时显示节日名（如"春节""中秋"），有节气时显示节气名，其他日子显示农历日。
- **D-03:** 月视图标题栏（如"2026年4月"）增加农历月份显示（如"三月"），若标题变长影响右侧按钮布局则调整按钮位置。
- **D-04:** 周视图和日视图的 header 不显示农历信息，仅月视图显示。

### 节气标记
- **D-05:** 节气名称用与普通农历日不同的颜色文字显示，以提供视觉区分。

### 法定节假日与调休
- **D-06:** 法定休息日：日格使用淡色背景 + 右上角"休"小标签。
- **D-07:** 调休工作日（补班日）：日格使用不同淡色背景 + 右上角"班"小标签。
- **D-08:** 节假日和调休标记应用于所有三个视图（月/周/日），保持一致性。
- **D-09:** 今天日期不再使用不同背景色，改为仅通过日期数字样式（加粗、颜色或圆圈等）区分，将背景色差异留给节假日标记使用，避免视觉杂乱。

### 数据与依赖策略
- **D-10:** 农历日期转换、二十四节气、传统节日判断使用第三方库（如 lunar-js、tyme4ts 等），具体库由 research 阶段评估 bundle size 和功能完整度后确定。
- **D-11:** 中国大陆法定节假日数据通过在线接口获取（如公开 API 或 GitHub 数据源），支持自动更新。
- **D-12:** 设置中提供开关，默认开启农历和节假日显示，用户可关闭。

### Claude's Discretion
- 节气文字的具体颜色值（需与 Apple Calendar 风格协调）
- 休息日和补班日背景色的具体值（淡红/淡绿或其他柔和色调）
- "休"/"班"角标的具体字号、位置、样式
- 今天日期数字的具体区分样式（加粗+颜色/圆圈/下划线等）
- 农历月份在标题栏的具体排版方式
- 在线节假日数据的具体 API 选择和缓存策略
- 离线时节假日数据的 fallback 行为
- 第三方农历库的最终选型

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 当前视图实现（主要修改目标）
- `src/views/CalendarView.ts` lines 834-948 — `renderMonthGrid()` 月视图渲染，日格结构（公历数字 + 事件列表），需要在此注入农历信息
- `src/views/CalendarView.ts` lines 952-1024 — `renderWeekGrid()` 周视图渲染，header 和 day column 结构
- `src/views/CalendarView.ts` lines 1027-1068 — `renderDayGrid()` 日视图渲染，header 和 column 结构
- `src/views/CalendarView.ts` lines 8-486 — `CALENDAR_CSS` 内联样式常量，需添加农历/节假日相关 CSS

### 类型和设置
- `src/models/types.ts` — UniCalendarSettings 接口，需添加农历/节假日开关
- `src/settings/SettingsTab.ts` — 设置界面，需添加开关 UI

### 先前阶段上下文
- `.planning/phases/05-apple-calendar-ui-polish/05-CONTEXT.md` — Apple Calendar 视觉风格决策，新 UI 元素需保持一致
- `.planning/phases/02-ics-feeds-and-calendar-views/02-CONTEXT.md` — 月视图事件渲染、overflow 模式等基础决策

### 项目约束
- `.planning/PROJECT.md` — Bundle size 约束、离线缓存需求、桌面和移动端兼容性
- `.planning/REQUIREMENTS.md` — v1 需求追踪

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CALENDAR_CSS` 内联样式常量 — 所有日历样式集中管理，可直接添加农历/节假日相关 CSS class
- `Obsidian CSS variables` — 已建立的主题兼容模式（light/dark），新颜色应使用 `color-mix()` 等方式保持兼容
- `color-mix()` 模式 — Phase 5 已建立的柔和色彩方案，节假日背景可复用
- `createDiv/createEl` DOM helpers — Obsidian 标准 DOM 操作方式

### Established Patterns
- 中文 locale 已建立（"今天"、"同步中"、周几名称等）
- 内联 CSS 在 TypeScript 常量中（`CALENDAR_CSS`、`CARD_STYLES`）
- Settings 使用 `UniCalendarSettings` 接口 + `DEFAULT_SETTINGS` 默认值
- 月视图日格结构：`uni-calendar-day` > `uni-calendar-day-number` span + `uni-calendar-day-events` div

### Integration Points
- `renderMonthGrid()` 中每个日格的 `cell` 元素 — 注入农历信息 span 和节假日背景/角标
- `renderWeekGrid()` 中 day column 和 header — 注入节假日背景标记
- `renderDayGrid()` 中 header 和 body — 注入节假日标记
- `UniCalendarSettings` — 添加 `showLunarCalendar` 和 `showHolidays` 布尔开关
- 月视图标题栏渲染 — 追加农历月份文字
- `.uni-calendar-day-today` CSS class — 移除背景色差异，改为日期数字样式区分

</code_context>

<specifics>
## Specific Ideas

- 月视图标题栏左侧增加农历月份（如"2026年4月 三月"），注意长度变化对右侧功能按钮的影响
- 今天的标识方式改为不影响背景色（背景色留给节假日），避免多种背景色造成视觉杂乱
- 节假日标记需在桌面和移动端都清晰可辨

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-chinese-lunar-calendar*
*Context gathered: 2026-04-16*
