# Phase 8: 法定假日的动态获取 - Research

**Researched:** 2026-04-05
**Domain:** HTTP 数据获取、缓存策略、Obsidian 插件数据持久化
**Confidence:** HIGH

## Summary

本阶段将 HolidayService 从 chinese-days 静态数据升级为从 NateScarlet/holiday-cn GitHub 项目动态获取中国大陆法定节假日 JSON 数据。核心改动集中在三个方面：(1) 新增 HolidayFetcher 负责 HTTP 获取和解析 holiday-cn JSON；(2) 改造 HolidayService 为有状态服务，支持动态数据优先 + chinese-days 静态 fallback；(3) 在插件数据存储中新增假日缓存字段，搭载 SyncManager 同步时机触发更新。

数据源格式简单清晰——每年一个 JSON 文件，包含 `days` 数组，每条记录仅 `name`（节日名称）、`date`（YYYY-MM-DD）、`isOffDay`（布尔值）三个字段。现有 `getHolidayInfo()` 接口契约保持不变，CalendarView 无需任何修改。

**Primary recommendation:** 新增 `HolidayFetcher` 类处理网络请求和 JSON 解析，改造 `HolidayService` 接受缓存数据注入，在 `main.ts` 的 `triggerSync()` 中搭载假日数据更新检查。

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 使用 NateScarlet/holiday-cn GitHub 项目作为数据源，通过 raw URL 获取 JSON 文件
- **D-02:** 数据源 URL 硬编码在代码中，用户无需知道或配置数据源（完全透明）
- **D-03:** 搭载现有日历同步时机触发假日数据更新检查——每次 SyncManager 执行日历同步时，顺便检查假日数据是否需要更新；假日数据有独立的 24 小时间隔控制，仅当距上���假日获取超过 24 小时才实际发起网络请求，不阻塞日历同步流程
- **D-04:** 获取的假日数据缓存在 Obsidian 的 plugin data 存储中（复用已有的 saveData/loadData 模式）
- **D-05:** 动态获取当前年份 + 下一年的假日数据
- **D-06:** 动态数据优先，未获取到动态数据时 fall back 到 chinese-days 静态数据（getDayDetail），确保平滑过渡和��风险
- **D-07:** 获取失败时通过 Obsidian Notice 提示用户数据可能不是最新的，同时使用缓存或静态数据继续正常展示

### Claude's Discretion
- 具体的 HTTP 请求实现（Obsidian requestUrl vs fetch）
- 缓存数据结构设计
- 更新检查的具体时间阈值微调
- NateScarlet/holiday-cn JSON 数据的具体解析逻辑
- 重试策略细节

### Deferred Ideas (OUT OF SCOPE)
None

</user_constraints>

## Project Constraints (from CLAUDE.md)

- 必须同时支持 Obsidian 桌面和移动端
- Bundle size 约束：通过 esbuild 单文件打包，依赖最小化
- 离线必须可用：缓存事件供离线查看
- 遵循 Obsidian 插件 API 模式（生命周期、设置、视图）
- TypeScript strict mode，使用 `requestUrl` from obsidian 做 HTTP 请求
- 使用 `saveData()/loadData()` 做数据持久化
- DOM 元素引用后缀 `El`，camelCase 变量名，PascalCase 类名

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian (`requestUrl`) | latest | HTTP 请求 | 项目已建立模式，跨平台兼容（桌面+移动端），无需额外依赖 [VERIFIED: 项目 src/sync/ 中 12 处使用] |
| chinese-days | ^1.5.7 | 静态假日数据 fallback | 已有依赖，作为 fallback 保证零风险 [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| NateScarlet/holiday-cn | N/A (数据源) | 动态假日 JSON 数据 | 在线时获取最新数据 [VERIFIED: raw.githubusercontent.com 实际访问确认] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Obsidian `requestUrl` | 原生 `fetch` | requestUrl 在 Obsidian 移动端有更好的兼容性和 CORS 处理，项目已建立模式，应继续使用 requestUrl |
| NateScarlet/holiday-cn | 其他假日 API | D-01 锁定了数据源，不考虑替代方案 |

**无需安装新依赖。** 所有需要的库已在项目中。

## Architecture Patterns

### 数据源 URL 格式

NateScarlet/holiday-cn 通过 GitHub raw URL 提供每年一个 JSON 文件 [VERIFIED: 实际获取 2025.json 和 2026.json 确认]:

```
https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json
```

### JSON 数据结构

[VERIFIED: 通过 WebFetch 实际获取 2026.json 确认]

```typescript
interface HolidayCnResponse {
  $schema: string;
  $id: string;
  year: number;
  papers: string[];  // 国务院文件链接
  days: HolidayCnDay[];
}

interface HolidayCnDay {
  name: string;      // 节日中文名称，如 "元旦"、"春节"、"国庆节"
  date: string;      // YYYY-MM-DD 格式
  isOffDay: boolean;  // true=休息日, false=补班日
}
```

**关键特征：**
- `name` 直接是中文节日名（"元旦"、"春节"等），无需解析复合字符串
- `isOffDay: true` 对应 HolidayType `'rest'`，`isOffDay: false` 对应 `'work'`
- 一个假期的多天会有多条记录，name 相同
- 涵盖所有 7 个法定假日：元旦、春节、清明、劳动节、端午、中秋、国庆

### Recommended Project Structure

```
src/
├── lunar/
│   ├── HolidayService.ts    # 改造：支持动态数据注入 + 静态 fallback
│   ├── HolidayFetcher.ts    # 新增：HTTP 获取 + JSON 解析
│   ├── LunarService.ts      # 不变
│   └── index.ts             # 导出新增类型和类
├── models/
│   └── types.ts             # 扩展：添加 HolidayCache 接口
└── main.ts                  # 修改：集成假日更新到 triggerSync
```

### Pattern 1: HolidayFetcher — 数据获取与解析

**What:** 独立类负责从 holiday-cn 获取并解析 JSON 数据
**When to use:** 在 triggerSync 中检查是否需要更新时调用

```typescript
// 推荐实现模式 [ASSUMED: 基于项目已有 requestUrl 模式设计]
import { requestUrl } from 'obsidian';

const HOLIDAY_CN_BASE_URL = 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master';

interface HolidayCnDay {
  name: string;
  date: string;
  isOffDay: boolean;
}

export class HolidayFetcher {
  /**
   * 获取指定年份的假日数据。
   * 返回 Map<dateStr, { name, isOffDay }> 方便 O(1) 查询。
   */
  async fetchYear(year: number): Promise<Map<string, { name: string; isOffDay: boolean }>> {
    const url = `${HOLIDAY_CN_BASE_URL}/${year}.json`;
    const response = await requestUrl({ url });
    const data = response.json as { days: HolidayCnDay[] };

    const map = new Map<string, { name: string; isOffDay: boolean }>();
    for (const day of data.days) {
      map.set(day.date, { name: day.name, isOffDay: day.isOffDay });
    }
    return map;
  }
}
```

### Pattern 2: HolidayService 改造 — 动态优先 + 静态 Fallback

**What:** HolidayService 变为有状态，持有缓存数据的 Map，查询时先查 Map，miss 时 fallback 到 chinese-days
**When to use:** 整个生命周期中使用

```typescript
// 推荐模式 [ASSUMED: 基于现有 HolidayService 接口设计]
export class HolidayService {
  private dynamicData: Map<string, { name: string; isOffDay: boolean }> = new Map();

  /**
   * 从缓存加载动态数据（启动时调用）
   */
  loadDynamicData(data: Map<string, { name: string; isOffDay: boolean }>): void {
    this.dynamicData = data;
  }

  getHolidayInfo(dateStr: string): HolidayInfo {
    // 1. 优先查动态数据
    const dynamic = this.dynamicData.get(dateStr);
    if (dynamic) {
      return {
        type: dynamic.isOffDay ? 'rest' : 'work',
        name: dynamic.name,
      };
    }
    // 2. Fallback 到 chinese-days 静态数据（现有逻辑）
    return this.getStaticHolidayInfo(dateStr);
  }

  private getStaticHolidayInfo(dateStr: string): HolidayInfo {
    // 现有 getDayDetail 逻辑
  }
}
```

### Pattern 3: 缓存数据结构

**What:** 在 UniCalendarData 中新增假日缓存字段
**When to use:** saveData/loadData 时一并持久化

```typescript
// 扩展 types.ts [ASSUMED: 基于现有 UniCalendarData 模式设计]
export interface HolidayCache {
  lastFetchTime: number | null;      // Unix timestamp，用于 24h 间隔判断
  // 按年份存储，key 是年份字符串
  years: Record<string, HolidayCnDay[]>;
}

export interface UniCalendarData {
  settings: UniCalendarSettings;
  eventCache: EventCache;
  holidayCache: HolidayCache;        // 新增
}
```

### Pattern 4: 搭载 triggerSync 的更新逻辑

**What:** 在 main.ts 的 triggerSync 中非阻塞地检查和更新假日数据
**When to use:** 每次日历同步时

```typescript
// 在 main.ts triggerSync() 中 [ASSUMED: 基于现有 triggerSync 模式设计]
async triggerSync(): Promise<void> {
  try {
    // 现有同步逻辑
    this.eventStore.setSourceOrder(this.settings.sources.map(s => s.id));
    await this.syncManager.syncAll(this.settings.sources);
    await this.savePluginData();
    this.refreshCalendarViews();
  } catch (err) {
    // 现有错误处理
  }

  // 非阻塞：假日数据更新（不影响日历同步）
  this.checkAndUpdateHolidays().catch(err => {
    console.error('[UniCalendar] Holiday update failed:', err);
  });
}

private async checkAndUpdateHolidays(): Promise<void> {
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  if (this.holidayCache.lastFetchTime &&
      now - this.holidayCache.lastFetchTime < TWENTY_FOUR_HOURS) {
    return; // 24h 内已获取过，跳过
  }
  // 获取当前年 + 下一年
  // 更新缓存，保存，通知 HolidayService
}
```

### Anti-Patterns to Avoid

- **不要阻塞日历同步：** 假日获取必须是非阻塞的（fire-and-forget with catch），即使假日获取失败也不影响日历事件同步
- **不要 fetch 所有历史年份：** 只获取当前年 + 下一年（D-05），减少请求数和存储量
- **不要移除 chinese-days 依赖：** 它仍作为 fallback 数据源，在动态数据不可用时保证功能
- **不要在 CalendarView 中添加异步逻辑：** getHolidayInfo() 必须保持同步接口，数据预加载到内存 Map

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP 请求 | 自定义 fetch wrapper | `requestUrl` from obsidian | 移动端兼容、CORS 处理、项目已有模式 |
| JSON 解析 | 自定义解析器 | `response.json` | requestUrl 内置 JSON 解析 |
| 数据持久化 | 自定义文件存储 | `saveData()/loadData()` | Obsidian 标准模式，已在项目中使用 |
| 静态假日数据 | 自维护假日表 | chinese-days `getDayDetail()` | 已有依赖，覆盖 2004-2026 |

**Key insight:** 本阶段几乎不需要新依赖——利用 Obsidian 内置的 requestUrl 做网络请求，利用已有的 saveData/loadData 做缓存，利用 chinese-days 做 fallback。核心工作是数据流编排，不是底层能力构建。

## Common Pitfalls

### Pitfall 1: 年末跨年数据缺失
**What goes wrong:** 12 月底获取"当前年+下一年"时，下一年的国务院放假通知可能尚未发布（通常 11 月发布），导致 holiday-cn 对应年份 JSON 不存在，requestUrl 返回 404。
**Why it happens:** 国务院放假安排通常在前一年 10-11 月才发布。
**How to avoid:** 对每个年份独立 try-catch，404 时静默跳过该年份，不影响已成功获取的年份数据。
**Warning signs:** requestUrl 抛出异常，status 404。

### Pitfall 2: getHolidayInfo 接口变为异步
**What goes wrong:** 如果将 getHolidayInfo 改为 async，所有 CalendarView 调用点都需要 await，DOM 渲染逻辑变复杂。
**Why it happens:** 试图在查询时 lazy-load 数据。
**How to avoid:** 保持 getHolidayInfo 为同步方法。数据在 triggerSync 时预加载到内存 Map，查询时直接读 Map。CalendarView 无需任何改动。
**Warning signs:** CalendarView 的 renderMonthGrid 等方法需要添加 async/await。

### Pitfall 3: 缓存数据结构版本不兼容
**What goes wrong:** 升级后旧版插件的 loadData 缺少 holidayCache 字段，Object.assign 默认值不生效。
**Why it happens:** UniCalendarData 新增字段但没有默认值处理。
**How to avoid:** loadPluginData 中为 holidayCache 提供 DEFAULT_HOLIDAY_CACHE 默认值，与现有 DEFAULT_CACHE / DEFAULT_SETTINGS 模式一致。
**Warning signs:** `this.holidayCache` 为 undefined。

### Pitfall 4: 移动端网络限制
**What goes wrong:** Obsidian 移动端对外部 HTTP 请求可能有限制或超时更短。
**Why it happens:** 移动端网络环境不稳定，且 raw.githubusercontent.com 在中国大陆可能需要代理。
**How to avoid:** 设置合理的超时（如 10 秒），失败时优雅降级到缓存或静态数据。考虑使用 jsdelivr CDN 作为备选 URL（`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json`）。
**Warning signs:** 移动端持续获取失败。

### Pitfall 5: 并发获取冲突
**What goes wrong:** 多次快速触发 triggerSync 导致多个假日获取同时进行，重复写入缓存。
**Why it happens:** 用户快速切换视图或手动触发同步。
**How to avoid:** 在 checkAndUpdateHolidays 中加简单的 fetching 标志（`private isHolidayFetching = false`），防止并发。
**Warning signs:** 日志中出现重复的 holiday fetch 记录。

## Code Examples

### 完整的 requestUrl 使用模式（来自项目已有代码）

```typescript
// Source: src/sync/IcsSyncAdapter.ts [VERIFIED]
import { requestUrl } from 'obsidian';

const response = await requestUrl({ url: feedUrl });
// response.text — 文本内容
// response.json — 已解析的 JSON（如果响应是 JSON）
// response.status — HTTP 状态码
```

### requestUrl 带配置的使用模式

```typescript
// Source: src/sync/CalDavSyncAdapter.ts [VERIFIED]
const response = await requestUrl({
  url: serverUrl,
  method: 'GET',
  headers: {
    'Authorization': '...',
    'Content-Type': 'application/json',
  },
});
```

### 现有 loadPluginData 模式

```typescript
// Source: src/main.ts [VERIFIED]
async loadPluginData(): Promise<void> {
  const data = await this.loadData() as Partial<UniCalendarData> | null;
  this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
  this.eventCache = Object.assign({}, DEFAULT_CACHE, data?.eventCache);
  // 新增：this.holidayCache = Object.assign({}, DEFAULT_HOLIDAY_CACHE, data?.holidayCache);
}
```

### 现有 HolidayService 接口（必须保持兼容）

```typescript
// Source: src/lunar/HolidayService.ts [VERIFIED]
// CalendarView 调用方式（3 处调用，接口固定）：
const holidayInfo = this.holidayService.getHolidayInfo(dateStr);
// 返回 { type: 'rest' | 'work' | null, name?: string }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chinese-days 静态数据 | 保留作为 fallback | Phase 6 (当前) | 覆盖 2004-2026，Phase 8 后降级为备选 |
| 无在线获取 | holiday-cn 动态获取 | Phase 8 (本阶段) | 支持未来年份，自动获取最新数据 |

**注意事项：**
- holiday-cn 数据依赖国务院发布放假通知，通常每年 11 月左右更新下一年数据 [ASSUMED]
- chinese-days 的 getDayDetail 返回 `{ name, work }` 结构与 holiday-cn 的 `{ name, isOffDay }` 语义相反（work=true 表示上班 vs isOffDay=true 表示休息）[VERIFIED: 对比两个数据源]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | holiday-cn 每年 11 月左右更新下一年数据 | State of the Art | 低风险——即使时间不准确，404 处理逻辑可覆盖 |
| A2 | jsdelivr CDN 可作为 raw.githubusercontent.com 的备选 | Pitfalls | 中风险——如果 CDN 不支持此仓库，需要其他备选方案 |
| A3 | Obsidian 移动端 requestUrl 支持 raw.githubusercontent.com 访问 | Pitfalls | 中风险——中国大陆网络环境可能阻断 GitHub raw 域名 |

## Open Questions

1. **GitHub raw URL 在中国大陆的可访问性**
   - What we know: raw.githubusercontent.com 在中国大陆部分地区可能被墙或速度很慢
   - What's unclear: 用户是否都有代理环境
   - Recommendation: 优先使用 jsdelivr CDN（`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json`）作为主 URL，raw.githubusercontent.com 作为 fallback。或者两个都尝试，第一个失败时自动切换。这属于 Claude's Discretion 范围内的实现细节。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | vitest 默认配置（package.json 中） |
| Quick run command | `npx vitest run tests/lunar/HolidayService.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | 从 holiday-cn 获取 JSON 数据 | unit (mock requestUrl) | `npx vitest run tests/lunar/HolidayFetcher.test.ts` | Wave 0 |
| D-03 | 24 小时间隔控制 | unit | `npx vitest run tests/lunar/HolidayFetcher.test.ts` | Wave 0 |
| D-05 | 获取当前年+下一年 | unit | `npx vitest run tests/lunar/HolidayFetcher.test.ts` | Wave 0 |
| D-06 | 动态优先 + 静态 fallback | unit | `npx vitest run tests/lunar/HolidayService.test.ts` | 已存在，需扩展 |
| D-07 | 获取失败时优雅降级 | unit | `npx vitest run tests/lunar/HolidayFetcher.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lunar/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/lunar/HolidayFetcher.test.ts` — 测试网络获取、JSON 解析、404 处理、24h 间隔控制
- [ ] 扩展 `tests/lunar/HolidayService.test.ts` — 测试动态数据优先 + fallback 逻辑
- [ ] Mock requestUrl 的测试辅助设施（vi.mock('obsidian')）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | 验证 JSON 响应结构符合预期 schema |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 恶意 JSON 注入 | Tampering | 验证 response 是否符合 { days: [{ name, date, isOffDay }] } 结构，拒绝异常数据 |
| URL 劫持 | Spoofing | URL 硬编码在代码中，使用 HTTPS，requestUrl 自动验证 SSL |

## Sources

### Primary (HIGH confidence)
- NateScarlet/holiday-cn 2026.json — 通过 WebFetch 实际获取确认 JSON 结构
- NateScarlet/holiday-cn 2025.json — 通过 WebFetch 交叉验证数据格式一致性
- src/lunar/HolidayService.ts — 当前实现，确认接口契约
- src/main.ts — triggerSync 和 saveData/loadData 模式
- src/sync/*.ts — requestUrl 使用模式（12 处实例）
- src/models/types.ts — UniCalendarData 结构
- tests/lunar/HolidayService.test.ts — 现有测试覆盖

### Secondary (MEDIUM confidence)
- Phase 6 CONTEXT.md — 历史假日决策上下文

### Tertiary (LOW confidence)
- jsdelivr CDN 作为 GitHub raw 替代方案 — 未实际验证该仓库的 CDN 可用性

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 无新依赖，全部使用项目已有工具
- Architecture: HIGH - 数据源格式已验证，接口契约清晰
- Pitfalls: HIGH - 基于对项目代码的实际阅读和数据源的实际获取

**Research date:** 2026-04-05
**Valid until:** 2026-05-05（数据源结构稳定，30 天有效）
