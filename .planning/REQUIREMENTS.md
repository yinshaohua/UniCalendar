# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R001 — Google 日历同步源允许配置代理地址，用代理访问 Google OAuth token 与 Calendar API 请求。

- Class: integration
- Status: active
- Description: Google 日历同步源允许配置代理地址，用代理访问 Google OAuth token 与 Calendar API 请求。
- Why it matters: 部分网络环境无法直连 Google Calendar；用户需要在插件内配置代理后完成授权、刷新 token、拉取日历列表和同步事件。
- Source: user request 2026-06-11
- Primary owning slice: Google calendar proxy milestone
- Validation: 用户可在 Google 日历源设置中填写代理地址；Google OAuth token exchange/refresh、日历列表发现、事件同步均通过代理访问，并在代理配置错误时显示可诊断错误且不影响未配置代理的现有直连行为。
- Notes: 需确认 Obsidian requestUrl 在插件环境内不能直接使用 Node 代理参数时，采用 URL 转发代理 contract，例如 proxyBaseUrl + encoded target URL 或兼容常见 HTTP CONNECT 代理的实现约束。

### R002 — 新增飞书日历 Calendar Open API 同步源，使用飞书官方 Calendar v4 API 拉取日历事件，避免依赖 CalDAV 巨型 ICS 下载。

- Class: integration
- Status: active
- Description: 新增飞书日历 Calendar Open API 同步源，使用飞书官方 Calendar v4 API 拉取日历事件，避免依赖 CalDAV 巨型 ICS 下载。
- Why it matters: 飞书 CalDAV 在 href+etag 变化时仍必须 multiget 巨型 ICS，无法根治性能问题；官方 Calendar Open API 提供 JSON 事件接口、分页和增量能力，更适合插件同步。
- Source: restored from prior REQUIREMENTS.md content and project memory after R001 numbering collision check on 2026-06-11
- Primary owning slice: Feishu Open API milestone
- Validation: 用户可新增飞书 Open API 日历源，授权后选择日历，并在配置的同步窗口内同步事件；常规同步不下载 CalDAV 的 117MB ICS payload。
- Notes: 现有 CalDAV 和飞书 CalDAV 自动兼容逻辑必须保留；Open API 作为新的来源类型或新连接方式实现。该需求原先在文件中显示为 R001，但当前 GSD 自动编号已被 Google proxy 需求占用，因此按工具规则恢复为新的自动编号。

## Validated

## Deferred

## Out of Scope

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | integration | active | Google calendar proxy milestone | none | 用户可在 Google 日历源设置中填写代理地址；Google OAuth token exchange/refresh、日历列表发现、事件同步均通过代理访问，并在代理配置错误时显示可诊断错误且不影响未配置代理的现有直连行为。 |
| R002 | integration | active | Feishu Open API milestone | none | 用户可新增飞书 Open API 日历源，授权后选择日历，并在配置的同步窗口内同步事件；常规同步不下载 CalDAV 的 117MB ICS payload。 |

## Coverage Summary

- Active requirements: 2
- Mapped to slices: 0
- Validated: 0
- Unmapped active requirements: 2
