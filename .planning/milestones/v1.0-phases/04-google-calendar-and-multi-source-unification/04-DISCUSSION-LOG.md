# Phase 4: Google Calendar and Multi-Source Unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 04-google-calendar-and-multi-source-unification
**Areas discussed:** OAuth2 认证流程, Token 管理策略, Google API 集成方式, 多源事件去重

---

## OAuth2 认证流程

| Option | Description | Selected |
|--------|-------------|----------|
| 浏览器授权 + 手动粘贴码 | 打开系统浏览器进入 Google 授权页，用户授权后得到授权码，手动复制回 Obsidian 粘贴。桌面/移动通用，最简单可靠 | ✓ |
| 本地回调服务器 | 桌面端启动 localhost HTTP 服务器接收回调，自动完成授权。体验更好但移动端无法用，需要双路径处理 | |
| 你来决定 | Claude 根据技术可行性选择最佳方案 | |

**User's choice:** 浏览器授权 + 手动粘贴码
**Notes:** 无额外说明

### OAuth 凭据来源

| Option | Description | Selected |
|--------|-------------|----------|
| 用户自己创建 | 用户在 Google Cloud Console 创建自己的 OAuth 应用，在设置中填入 Client ID 和 Secret。无服务器成本，但用户门槛较高 | |
| 插件内置 | 插件内置预设的 Client ID/Secret，用户只需点"授权"。体验好但需要维护服务器端或接受安全风险 | |
| 两者都支持 | 默认用户自己填，但也预留内置凭据的位置（未来可以加） | ✓ |

**User's choice:** 两者都支持
**Notes:** 无额外说明

---

## Token 管理策略

| Option | Description | Selected |
|--------|-------------|----------|
| data.json 明文存储 | 沿用 Phase 3 的做法，access_token + refresh_token + 过期时间存在 data.json 中。简单一致，Obsidian 插件标准做法 | ✓ |
| 单独 token 文件 | token 信息单独存文件，不和 settings 混在一起。可以 .gitignore 保护 | |
| 你来决定 | Claude 根据实际情况选择 | |

**User's choice:** data.json 明文存储
**Notes:** 无额外说明

### Token 刷新失败处理

| Option | Description | Selected |
|--------|-------------|----------|
| 提示重新授权 | Refresh token 失效时，在同步状态显示错误并提示用户重新进行 OAuth 授权流程 | ✓ |
| 静默禁用源 | 刷新失败后自动禁用该 Google 源，下次用户手动开启时触发重新授权 | |
| 你来决定 | Claude 根据技术实现选择最佳方案 | |

**User's choice:** 提示重新授权
**Notes:** 无额外说明

---

## Google API 集成方式

| Option | Description | Selected |
|--------|-------------|----------|
| 直接 REST API | 类似 CalDAV 的自实现方式，用 Obsidian requestUrl 调用 Google Calendar REST API。零依赖，与现有架构一致 | ✓ |
| googleapis 库 | 用 Google 官方 Node.js SDK。功能完整但增加 bundle size，且可能有移动端兼容性问题 | |
| 你来决定 | Claude 根据 bundle size 和兼容性选择 | |

**User's choice:** 直接 REST API
**Notes:** 无额外说明

### Google Calendar 日历选择

| Option | Description | Selected |
|--------|-------------|----------|
| 与 CalDAV 相同模式 | 授权后自动发现所有日历，用户勾选要同步的日历。与 Phase 3 的 CalDAV 发现流程保持一致 | ✓ |
| 同步所有日历 | 授权后自动同步用户所有 Google Calendar，无需选择 | |
| 你来决定 | Claude 决定最佳方案 | |

**User's choice:** 与 CalDAV 相同模式
**Notes:** 无额外说明

---

## 多源事件去重

| Option | Description | Selected |
|--------|-------------|----------|
| 不去重，都显示 | 每个源独立显示其事件，即使重复也同时显示。简单可靠，用户可以通过禁用源来避免重复 | |
| 智能去重 | 基于标题+时间匹配自动去重，只显示一次。体验更好但实现复杂，可能误判 | ✓ |
| 用户手动标记 | 用户可以手动标记某个事件为重复并隐藏。灵活但增加用户负担 | |

**User's choice:** 智能去重
**Notes:** 无额外说明

### 去重匹配规则

| Option | Description | Selected |
|--------|-------------|----------|
| UID 优先 + 时间标题回退 | ICS/CalDAV/Google 事件都有 UID，先按 UID 去重；无 UID 时按开始时间+标题精确匹配。保留第一个源的事件 | ✓ |
| 仅按时间+标题 | 统一按开始时间+标题精确匹配去重，简单但可能误判同名事件 | |
| 你来决定 | Claude 选择最佳策略 | |

**User's choice:** UID 优先 + 时间标题回退
**Notes:** 无额外说明

---

## Claude's Discretion

- OAuth2 PKCE 实现细节
- Google API 错误处理和速率限制
- Token 刷新时机策略
- CalendarEvent `uid` 字段提取逻辑
- 去重性能优化
- Settings UI 中 Google 授权按钮的布局

## Deferred Ideas

None — discussion stayed within phase scope.
