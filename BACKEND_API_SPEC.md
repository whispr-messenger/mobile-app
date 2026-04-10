# 🔧 Backend API — 前端对接需求文档

## 项目背景
Whispr 是一个端到端加密的即时通讯应用。前端（React Native / Expo）已经完成了所有 API 服务的集成。以下是前端实际调用的所有 API endpoints，请检查后端是否全部实现，并补全缺失的功能。

**Base URL**: `https://whispr-api.roadmvn.com`

---

## 1. AUTH-SERVICE (`/auth/v1/...`)

### ✅ 已确认调用的 endpoints：
| Method | Path | 前端调用位置 | 说明 |
|--------|------|-------------|------|
| POST | `/auth/v1/verify/register/request` | AuthService.ts | 发送注册验证码 SMS |
| POST | `/auth/v1/verify/register/confirm` | AuthService.ts | 确认注册验证码 |
| POST | `/auth/v1/verify/login/request` | AuthService.ts | 发送登录验证码 SMS |
| POST | `/auth/v1/verify/login/confirm` | AuthService.ts | 确认登录验证码 |
| POST | `/auth/v1/register` | AuthService.ts | 注册 (含 deviceInfo + signalKeyBundle) |
| POST | `/auth/v1/login` | AuthService.ts | 登录 (含 deviceInfo + signalKeyBundle) |
| POST | `/auth/v1/logout` | AuthService.ts | 登出 `{ deviceId, userId }` |
| POST | `/v1/tokens/refresh` | AuthService.ts | 刷新 token (尝试多个路径 + body 格式) |

### 🆕 新增 endpoints（前端已集成，需要后端实现）：

#### 2FA 双因素认证
| Method | Path | Request Body | Response | 说明 |
|--------|------|-------------|----------|------|
| POST | `/auth/v1/2fa/setup` | — | `{ secret, qr_code_url, backup_codes? }` | 初始化 2FA，返回 TOTP secret + QR |
| POST | `/auth/v1/2fa/enable` | `{ code }` | 204 | 用首次 TOTP code 确认启用 |
| POST | `/auth/v1/2fa/verify` | `{ code }` | `{ access_token, refresh_token }` | 登录时验证 2FA code |
| POST | `/auth/v1/2fa/disable` | `{ code }` | 204 | 用 TOTP code 关闭 2FA |
| POST | `/auth/v1/2fa/backup-codes` | — | `{ backup_codes: string[] }` | 重新生成备份码 |
| GET | `/auth/v1/2fa/status` | — | `{ enabled, setup_at? }` | 查询 2FA 状态 |

#### 设备管理
| Method | Path | Response | 说明 |
|--------|------|----------|------|
| GET | `/auth/v1/device` | `DeviceInfo[]` | 列出当前用户所有已注册设备 |
| DELETE | `/auth/v1/device/:deviceId` | 204 | 远程撤销某个设备 |

**DeviceInfo 结构**：
```json
{
  "id": "string",
  "name": "string",
  "platform": "string",
  "last_active": "ISO datetime",
  "is_current": true
}
```

#### Signal Protocol 密钥
| Method | Path | Request/Response | 说明 |
|--------|------|-----------------|------|
| GET | `/auth/v1/signal/keys/:userId/devices/:deviceId` | → `SignalKeyBundle` | 获取某用户某设备的 key bundle (用于 E2E session 建立) |
| POST | `/auth/v1/signal/keys/signed-prekey` | `{ signed_prekey: { key_id, public_key, signature } }` | 上传新的 signed prekey (轮换) |
| POST | `/auth/v1/signal/keys/prekeys` | `{ prekeys: [{ key_id, public_key }] }` | 批量上传 one-time prekeys |
| GET | `/auth/v1/signal/health` | `{ prekeys_remaining, signed_prekey_age_days, needs_replenishment }` | 检查密钥健康状态 |

---

## 2. USER-SERVICE (`/user/v1/...`)

### ✅ 已确认调用的 endpoints：
| Method | Path | 说明 |
|--------|------|------|
| GET | `/user/v1/profile/:id` | 获取用户 profile |
| PATCH | `/user/v1/profile/:id` | 更新 profile (firstName, lastName, username, biography, profilePictureUrl) |
| GET | `/user/v1/privacy/:userId` | 获取隐私设置 |
| PATCH | `/user/v1/privacy/:userId` | 更新隐私设置 |
| PATCH | `/user/v1/account/:id/last-seen` | 更新 last seen |
| PATCH | `/user/v1/account/:id/deactivate` | 停用账户 |
| DELETE | `/user/v1/account/:id` | 删除账户 |

### 🔍 搜索 endpoints（前端并行调用这三个来实现模糊搜索）：
| Method | Path | Query Params | 说明 |
|--------|------|-------------|------|
| GET | `/user/v1/search/username` | `?username=xxx` | **精确匹配** username，返回单个用户对象 |
| GET | `/user/v1/search/name` | `?query=xxx&limit=20` | **模糊搜索** firstName/lastName，返回数组 |
| GET | `/user/v1/search/phone` | `?phoneNumber=xxx` | 按手机号搜索，返回单个或数组 |

⚠️ **重要**：前端期望 `/search/name` 支持**部分匹配**（如搜 "joh" 能匹配 "John"），请确认后端 SQL 是否使用 `ILIKE '%query%'` 或类似逻辑。

### 联系人
| Method | Path | Body | 说明 |
|--------|------|------|------|
| GET | `/user/v1/contacts/:ownerId` | — | 获取用户的联系人列表 |
| POST | `/user/v1/contacts/:ownerId` | `{ contactId, nickname? }` | 添加联系人 |
| PATCH | `/user/v1/contacts/:ownerId/:contactId` | `{ nickname }` | 更新联系人备注 |
| DELETE | `/user/v1/contacts/:ownerId/:contactId` | — | 删除联系人 |

### 分组
| Method | Path | Body | 说明 |
|--------|------|------|------|
| GET | `/user/v1/groups/:ownerId` | — | 获取用户的分组列表 |
| POST | `/user/v1/groups/:ownerId` | `{ name, description?, picture_url?, member_ids? }` | 创建分组 |
| PATCH | `/user/v1/groups/:ownerId/:groupId` | `{ name?, description? }` | 更新分组 |
| DELETE | `/user/v1/groups/:ownerId/:groupId` | — | 删除分组 |

### 拉黑
| Method | Path | Body | 说明 |
|--------|------|------|------|
| GET | `/user/v1/blocked-users/:blockerId` | — | 获取拉黑列表 |
| POST | `/user/v1/blocked-users/:blockerId` | `{ blockedId }` | 拉黑用户 |
| DELETE | `/user/v1/blocked-users/:blockerId/:blockedId` | — | 取消拉黑 |

---

## 3. MEDIA-SERVICE (`/media/v1/...`) — 🆕 需要后端实现

| Method | Path | Content-Type | Response | 说明 |
|--------|------|-------------|----------|------|
| POST | `/media/v1/upload` | `multipart/form-data` (field: `file`) | `{ id, url, thumbnail_url?, filename, mime_type, size }` | 上传文件 |
| GET | `/media/v1/:id` | — | `MediaMetadata` | 获取文件元信息 |
| GET | `/media/v1/:id/blob` | — | binary file | 下载文件原始内容 |
| GET | `/media/v1/:id/thumbnail` | — | binary image | 下载缩略图 |
| DELETE | `/media/v1/:id` | — | 204 | 删除文件 |

**MediaMetadata 结构**：
```json
{
  "id": "string",
  "filename": "string",
  "mime_type": "string",
  "size": 12345,
  "width": 1920,
  "height": 1080,
  "duration": null,
  "url": "string",
  "thumbnail_url": "string",
  "created_at": "ISO datetime",
  "uploaded_by": "userId"
}
```

---

## 4. MESSAGING-SERVICE (`/messaging/api/v1/...`)

### ✅ 已有 endpoints：
| Method | Path | 说明 |
|--------|------|------|
| GET | `/messaging/api/v1/conversations` | 列出会话 |
| POST | `/messaging/api/v1/conversations` | 创建会话 `{ type: "direct", user_ids: [...] }` |
| GET | `/messaging/api/v1/conversations/:id` | 会话详情 |
| DELETE | `/messaging/api/v1/conversations/:id` | 删除会话 |
| GET | `/messaging/api/v1/conversations/:id/messages` | 获取消息列表 |
| POST | `/messaging/api/v1/conversations/:id/messages` | 发送消息 |
| PUT | `/messaging/api/v1/messages/:id` | 编辑消息 |
| DELETE | `/messaging/api/v1/messages/:id` | 删除消息 |

### 🆕 新增 endpoints（前端已集成）：
| Method | Path | Body | 说明 |
|--------|------|------|------|
| PUT | `/messaging/api/v1/conversations/:id` | `{ name?, description?, picture_url? }` | 更新会话信息 |
| POST | `/messaging/api/v1/conversations/:id/pin` | — | 置顶会话 |
| DELETE | `/messaging/api/v1/conversations/:id/pin` | — | 取消置顶 |
| GET | `/messaging/api/v1/conversations/search` | `?q=xxx` | 搜索会话 |
| POST | `/messaging/api/v1/conversations/:id/members` | `{ user_id }` | 添加成员 |
| DELETE | `/messaging/api/v1/conversations/:id/members/:user_id` | — | 移除成员 |
| PATCH | `/messaging/api/v1/conversations/:id/members/:user_id/role` | `{ role }` | 修改成员角色 (`admin`/`moderator`/`member`) |
| POST | `/messaging/api/v1/messages/:id/delivered` | — | 标记消息已送达 |
| POST | `/messaging/api/v1/messages/:id/read` | — | 标记消息已读 |
| POST | `/messaging/api/v1/attachments/upload` | `multipart/form-data` | 上传附件 → `{ id, url, name, size, mime_type }` |
| GET | `/messaging/api/v1/attachments/:id/download` | — | 下载附件 |

---

## 5. SCHEDULING-SERVICE (`/scheduling/...`) — 🆕 完全需要后端实现

| Method | Path | Body | Response | 说明 |
|--------|------|------|----------|------|
| POST | `/scheduling/api/v1/scheduled-messages` | `{ conversation_id, content, message_type?, scheduled_at, metadata? }` | `ScheduledMessage` | 创建定时消息 |
| GET | `/scheduling/api/v1/scheduled-messages` | `?conversation_id=&status=&limit=&offset=` | `ScheduledMessage[]` | 列出定时消息 |
| PATCH | `/scheduling/api/v1/scheduled-messages/:id` | `{ content?, scheduled_at?, metadata? }` | `ScheduledMessage` | 修改定时消息 |
| DELETE | `/scheduling/api/v1/scheduled-messages/:id` | — | 204 | 取消定时消息 |
| GET | `/scheduling/api/v1/monitoring/health` | — | `{ status, uptime, timestamp }` | 健康检查 |
| GET | `/scheduling/api/v1/monitoring/metrics` | — | `{ total_scheduled, total_sent, total_failed, pending_count }` | 统计 |
| GET | `/scheduling/api/v1/monitoring/queues` | — | `QueueStats[]` | 队列状态 |

**ScheduledMessage 结构**：
```json
{
  "id": "string",
  "conversation_id": "string",
  "sender_id": "string",
  "content": "string",
  "message_type": "text",
  "scheduled_at": "2026-04-05T10:00:00Z",
  "status": "pending",
  "metadata": {},
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

---

## 6. NOTIFICATION-SERVICE (`/notification/...`) — 🆕 完全需要后端实现

| Method | Path | Body | Response | 说明 |
|--------|------|------|----------|------|
| GET | `/notification/api/settings/:userId` | — | `NotificationSettings` | 获取通知设置 |
| PUT | `/notification/api/settings/:userId` | `Partial<NotificationSettings>` | `NotificationSettings` | 更新通知设置 |
| POST | `/notification/api/conversations/:id/mute` | `{ duration? }` (秒, 可选) | 204 | 静音会话 |
| DELETE | `/notification/api/conversations/:id/mute` | — | 204 | 取消静音 |

**NotificationSettings 结构**：
```json
{
  "push_enabled": true,
  "message_previews": true,
  "sound_enabled": true,
  "vibration_enabled": true,
  "show_sender_name": true,
  "quiet_hours_enabled": false,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "07:00"
}
```

---

## ⚠️ 后端注意事项

### 1. CORS
前端 web 端测试时从 `localhost:8081/8084` 发起请求，后端需要返回：
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Authorization, Content-Type, Accept
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```
并且对 `OPTIONS` preflight 请求返回 `204`。

### 2. 认证
所有 endpoints（除 verify/register/login）都需要 `Authorization: Bearer <accessToken>` header。

### 3. Response 格式
- messaging-service 的 response 可能被包在 `{ data: ... }` 里，前端已有 `unwrap()` 处理
- user-service 的 profile 返回 camelCase (`firstName`, `profilePictureUrl` 等)
- 404 不应该直接报错，部分场景前端会 catch 404 当作"不存在"

### 4. 搜索功能
`/user/v1/search/name` 必须支持模糊搜索（部分匹配）。前端搜索流程：
1. 用户输入 → debounce 350ms
2. 并行发送 `/search/username` + `/search/name` + `/search/phone`（如果是手机号格式）
3. 合并去重结果

### 5. 文件上传
media-service 和 attachments/upload 都使用 `multipart/form-data`，field name 为 `file`。
