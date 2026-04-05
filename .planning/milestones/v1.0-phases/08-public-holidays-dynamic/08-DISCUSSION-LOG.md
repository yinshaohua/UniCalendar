# Phase 8: 法定假日的动态获取 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 08-public-holidays-dynamic
**Areas discussed:** 数据源选择, 更新与缓存策略, 年份范围与过渡, 错误处理与用户感知

---

## 数据源选择

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub 静态 JSON 文件 | 如 NateScarlet/holiday-cn，通过 raw URL 直接获取。稳定、免费、无限流。 | ✓ |
| 第三方公开 API | 如 timor.tech 等 REST API。方便但有服务可用性风险。 | |
| 多源 fallback | 同时支持多个数据源，主源失败自动切换。复杂度更高。 | |

**User's choice:** GitHub 静态 JSON 文件
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| NateScarlet/holiday-cn | 数据全面、更新及时，社区活跃。包含每年 JSON + 历史数据。 | ✓ |
| 用户自定义 URL | 用户在设置中自己填写 JSON 文件的 URL。灵活但用户门槛高。 | |

**User's choice:** NateScarlet/holiday-cn
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| 完全透明 | 设置中不显示任何数据源配置，内置硬编码 URL。最简单。 | ✓ |
| 默认+可覆盖 | 默认用 NateScarlet/holiday-cn，但设置中提供「自定义 URL」字段。 | |

**User's choice:** 完全���明
**Notes:** None

---

## 更新与缓存策略

| Option | Description | Selected |
|--------|-------------|----------|
| 启动时检查 | 每次插件加载时检查更新（如距上次获取超过 24 小时），后台静默获取不阻塞界面。 | ✓ |
| 跟随事件同步 | 跟随日历��件同步一起获取假日数据。逻辑统一但可能过于频繁。 | |
| 手动触发 | 仅当用户主动点击时才获取。最节省但用户可能忘记。 | |

**User's choice:** 启动时检查
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| 插件 data 存储 | 用 Obsidian 的 plugin data 存储（已有 saveData/loadData 模式），简单可靠。 | ✓ |
| Vault 文件 | 缓存到 vault 内的文件，用户可见但可能污染 vault。 | |

**User's choice:** 插件 data 存储
**Notes:** None

---

## 年份范围与过渡

| Option | Description | Selected |
|--------|-------------|----------|
| 当年+下年 | 只获取当前年份 + 下一年。请求少、实用。 | ✓ |
| 所有可用年份 | 获取数据源所有可用年份。数据更全但请求更大。 | |
| 仅当年 | 只获取当前年份。最简单但跨年时可能无数据。 | |

**User's choice:** 当年+下年
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| 动态优先 + 静态 fallback | 动态数据优先。未获取到动态数据时 fall back 到 chinese-days 静态数据。平滑过渡、零风险。 | ✓ |
| 纯动态（移除静态数据） | 完全移除 chinese-days 的 getDayDetail，仅依赖动态数据。减少 bundle 但离线时无数据。 | |

**User's choice:** 动态优先 + 静态 fallback
**Notes:** None

---

## 错误处理与用户感知

| Option | Description | Selected |
|--------|-------------|----------|
| 静默 fallback | 获取失败时静默使用缓存/静态数据，不打扰用户。仅在设置页显示上次更新时间。 | |
| 显示提示通知 | 获取失败时通过 Obsidian Notice 提示用户，让用户知道数据可能不是最新的。 | ✓ |
| 视图内指示器 | 在日历视图中显示一个微妙的警告图标，点击可查看详情。 | |

**User's choice:** 显示提示通知
**Notes:** None

---

## Claude's Discretion

- HTTP 请求实现细节
- 缓存数据结构设计
- 更新检查时间阈值微调
- JSON 数据解析逻辑
- 重试策略

## Deferred Ideas

None
