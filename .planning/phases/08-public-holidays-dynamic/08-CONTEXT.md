# Phase 8: 法定假日的动态获取 - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

将 HolidayService 从 chinese-days 静态数据升级为在线动态获取中国大陆法定节假日数据，支持自动更新和离线缓存。不涉及 UI 变更——节假日的展示方式（"休"/"班" 角标等）已在 Phase 6 完成，本阶段仅改变数据来源。

</domain>

<decisions>
## Implementation Decisions

### 数据源选择
- **D-01:** 使用 NateScarlet/holiday-cn GitHub 项目作为数据源，通过 raw URL 获取 JSON 文件
- **D-02:** 数据源 URL 硬编码在代码中，用户无需知道或配置数据源（完全透明）

### 更新与缓存策略
- **D-03:** 插件启动时检查更新——若距上次获取超过 24 小时，后台静默获取新数据，不阻塞界面
- **D-04:** 获取的假日数据缓存在 Obsidian 的 plugin data 存储中（复用已有的 saveData/loadData 模式）

### 年份范围与过渡
- **D-05:** 动态获取当前年份 + 下一年的假日数据
- **D-06:** 动态数据优先，未获取到动态数据时 fall back 到 chinese-days 静态数据（getDayDetail），确保平滑过渡和零风险

### 错误处理
- **D-07:** 获取失败时通过 Obsidian Notice 提示用户数据可能不是最新的，同时使用缓存或静态数据继续正常展示

### Claude's Discretion
- 具体的 HTTP 请求实现（Obsidian requestUrl vs fetch）
- 缓存数据结构设计
- 更新检查的具体时间阈值微调
- NateScarlet/holiday-cn JSON 数据的具体解析逻辑
- 重试策略细节

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 当前假日实现（主要修改目标）
- `src/lunar/HolidayService.ts` — 当前 HolidayService 实现，使用 chinese-days getDayDetail() 静态数据
- `src/lunar/index.ts` — lunar 模块导出
- `tests/lunar/HolidayService.test.ts` — 现有假日服务测试

### 数据源
- `NateScarlet/holiday-cn` GitHub 仓库 — 动态假日数据源，提供每年 JSON 文件

### 插件数据存储模式
- `src/models/types.ts` — UniCalendarSettings 接口，需扩展缓存字段
- `src/main.ts` — saveData/loadData 模式参考

### 视图集成（不修改，仅确认接口兼容）
- `src/views/CalendarView.ts` lines 979, 1102, 1198 — 调用 getHolidayInfo() 的位置

### 先前阶段上下文
- `.planning/phases/06-chinese-lunar-calendar/06-CONTEXT.md` — Phase 6 假日相关决策（D-06 至 D-12）

### 项目约束
- `.planning/PROJECT.md` — Bundle size 约束、离线缓存需求、桌面和移动端兼容性

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HolidayService.getHolidayInfo()` — 现有接口，返回 HolidayInfo { type: HolidayType; name?: string }，需保持接口不变
- `Obsidian requestUrl` — 跨平台 HTTP 请求 API，已在 CalDAV/ICS 同步中使用
- `saveData()/loadData()` — Obsidian 插件数据持久化，已建立模式

### Established Patterns
- chinese-days 库的 getDayDetail() 返回 { name, work } 结构
- HolidayService 是无状态类，按日期查询——需要改造为支持缓存数据的有状态服务
- CalendarView 通过 this.holidayService.getHolidayInfo(dateStr) 调用，接口契约已固定

### Integration Points
- HolidayService 构造函数/初始化——需注入缓存数据或初始化异步加载
- UniCalendarSettings——添加缓存字段（上次更新时间、缓存的假日数据）
- 插件 onload()——触发后台假日数据更新检查

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-public-holidays-dynamic*
*Context gathered: 2026-04-05*
