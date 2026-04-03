# 📋 Backend 联系人相关 API 对接需求

## Base URL: `https://whispr-api.roadmvn.com/user/v1`

所有请求需要 `Authorization: Bearer <accessToken>` header。

---

## 1. 联系人 CRUD

| Method | Path | Body | Response | 说明 |
|--------|------|------|----------|------|
| GET | `/contacts/:ownerId` | — | `Contact[]` | 获取用户的联系人列表 |
| POST | `/contacts/:ownerId` | `{ contactId, nickname? }` | `Contact` | 添加联系人 |
| PATCH | `/contacts/:ownerId/:contactId` | `{ nickname }` | `Contact` | 更新联系人备注 |
| DELETE | `/contacts/:ownerId/:contactId` | — | 204 | 删除联系人 |

**Contact 结构**（后端返回）:
```json
{
  "id": "string",
  "ownerId": "string",
  "contactId": "string",
  "nickname": "string | null",
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

前端通过 JWT token 的 `sub` 字段获取 `ownerId`。

---

## 2. 用户搜索 ⚠️ 重点

前端搜索流程：用户输入关键词 → debounce 350ms → **并行调用以下 3 个 endpoint** → 合并去重。

| Method | Path | Query Params | Response | 说明 |
|--------|------|-------------|----------|------|
| GET | `/search/username` | `?username=xxx` | 单个用户对象 | 精确匹配 username |
| GET | `/search/name` | `?query=xxx&limit=20` | 用户数组 | **模糊搜索** firstName/lastName |
| GET | `/search/phone` | `?phoneNumber=xxx` | 单个用户对象或数组 | 按手机号搜索 |

### ⚠️ `/search/name` 必须支持模糊匹配

前端期望输入 `"joh"` 能匹配到 `"John"`、`"Johnny"` 等。后端 SQL 需要类似：
```sql
WHERE LOWER(first_name) LIKE LOWER('%query%')
   OR LOWER(last_name) LIKE LOWER('%query%')
```

### 返回格式

三个 endpoint 返回的用户对象结构需统一（camelCase）：
```json
{
  "id": "uuid",
  "username": "john_doe",
  "phoneNumber": "+33612345678",
  "firstName": "John",
  "lastName": "Doe",
  "profilePictureUrl": "https://...",
  "lastSeen": "ISO datetime",
  "isActive": true
}
```

- `/search/username` → 返回单个对象，找不到返回 404
- `/search/name` → 返回数组，没结果返回 `[]`
- `/search/phone` → 返回单个对象或数组，找不到返回 404

---

## 3. 拉黑

| Method | Path | Body | Response | 说明 |
|--------|------|------|----------|------|
| GET | `/blocked-users/:blockerId` | — | `BlockedUser[]` | 获取拉黑列表 |
| POST | `/blocked-users/:blockerId` | `{ blockedId }` | `BlockedUser` | 拉黑用户 |
| DELETE | `/blocked-users/:blockerId/:blockedId` | — | 204 | 取消拉黑 |

**BlockedUser 结构**:
```json
{
  "id": "string",
  "blockerId": "string",
  "blockedId": "string",
  "createdAt": "ISO datetime"
}
```

---

## 4. CORS

后端需要对所有 endpoint 返回：
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Authorization, Content-Type, Accept
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```
`OPTIONS` preflight 请求返回 `204`。
