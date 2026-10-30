# 03-后端篇（Vibe Coding实战）

本篇展示如何使用 Qoder 从零搭建 HopeEquipment 的 FastAPI 后端。你将看到完整的提示词和 AI 回复的关键要点，可以直接复用到自己的项目中。

> 关于 Vibe Coding 的概念和工具介绍，请参见 [概况篇 - Vibe Coding 开发方式](./01-overview.md#6-vibe-coding-开发方式)。

> **注意**：以下对话仅为示范，展示如何通过 Vibe Coding 逐步搭建后端。实际开发中，每个功能模块都需要通过多轮对话、引导和调整才能完善。你可以根据自己的需求，灵活调整提示词和开发顺序。

> **本篇定位**：本篇展示的是「怎么用提示词把东西问出来」，而AI的回复可能差异比较大，因此只能作为参考，可能与仓库里的最终版本不同（字段、注释、实现都可能已经改过）。每个被概括的要点后面用 `> 对应源码：` 标出这部分内容落在原始文件的哪个位置；要看完整且权威的代码，请去 [03-后端篇（详细实现）](./03-backend-detail.md)。

---

## 1. 第一轮对话：项目初始化

### 提示词

```
我要用 FastAPI 搭建一个设备管理系统的后端。

技术栈：
- Python 3.13+
- FastAPI + uvicorn
- SQLite（数据库已在上一篇搭建好）

请帮我设计合理的目录结构和依赖文件。
```

### AI 回复要点

**目录结构**：

```
backend/
├── __init__.py           # 空文件，标记为 Python 包
├── main.py               # FastAPI 应用入口
└── db.py                 # 数据库操作封装
```

> 对应源码：[03-backend-detail.md §3.1](./03-backend-detail.md#_31-完整代码)（main.py）、[§2.1](./03-backend-detail.md#_21-完整代码)（db.py）——这一轮还没有 `auth.py` 和 `routers/`，它们在 §5、§4 才出现，优先搭建数据库和后端的桥梁，以及后端的启动脚本。

**依赖文件**：

```txt
# requirements.txt
fastapi
uvicorn
```

> 对应源码：[03-backend-detail.md §1.2](./03-backend-detail.md#_12-依赖)（最终多了一个 `pwdlib[argon2]`，见 §5）

**说明**：
- **fastapi** — Web 框架，提供路由、依赖注入、自动文档
- **uvicorn** — ASGI 服务器，运行 FastAPI 应用

> 对应源码：[03-backend-detail.md §1.2](./03-backend-detail.md#_12-依赖)

---

## 2. 第二轮对话：入口文件 main.py

### 提示词

```
请帮我创建 FastAPI 应用入口 main.py。

要求：
1. 允许前端开发服务器跨域访问（开发时前端运行在 localhost:5173）
2. 添加一个接口用来检查服务是否正常启动
3. 设置应用标题为 HopeEquipment
```

### AI 回复要点

- **FastAPI 实例**：`FastAPI(title='HopeEquipment')`
- **CORS 配置**：允许前端开发服务器 `http://localhost:5173` 访问
- **测试路由**：`/api/health` 返回 `{'status': 'ok'}`（最终版本没有保留）

> 对应源码：[03-backend-detail.md §3.1](./03-backend-detail.md#_31-完整代码)（`FastAPI(title=...)`、CORS）

---

## 3. 第三轮对话：数据库操作封装 db.py

### 提示词

```
现在需要操作数据库，帮我封装 db.py。

要求：
1. 封装通用的增删改查函数，所有函数接收表名作为参数，4 张设备表共用同一套代码
2. 查询结果要能通过列名访问，不能只用数字索引
3. 要防止 SQL 注入
4. 要自动管理数据库连接，用完自动关闭
5. 实现一个生成文本 ID 的函数（如 camera1、camera2）
```

### AI 回复要点

- **通用封装**：所有函数接收表名作为参数，4 张设备表共用同一套代码
- **连接管理**：`conn.row_factory = sqlite3.Row` 让查询结果可以通过列名访问（`row['name']`）
- **参数化查询**：使用 `?` 占位符，防止 SQL 注入
- **`with` 语句**：自动管理连接和事务

> 对应源码：[03-backend-detail.md §2.1](./03-backend-detail.md#_21-完整代码)

---

## 4. 第四轮对话：设备 CRUD 路由

### 提示词

```
现在帮我实现设备的增删改查接口。

要求：
1. 4 张设备表（camera、camcorder、lens、accessory）结构相似，请用一种通用的方式实现，避免重复代码
2. 要防止客户端伪造或修改不该修改的字段（比如 id）
3. 删除操作需要一定的权限
4. 每个表都要有完整的增删改查接口
```

### AI 回复要点

- **字段白名单**：`TABLE_FIELDS` 按表列出各自允许的字段，防止客户端注入 `id` 等受保护字段
- **工厂模式**：`create_router(table)` 传入表名，返回完整 CRUD 路由（5 个端点），避免重复代码
- **删除鉴权**：`delete_role` 参数控制删除操作需要的角色，默认为当前用户

> 对应源码：[03-backend-detail.md §6.1](./03-backend-detail.md#_61-完整代码)

---

## 5. 第五轮对话：引入认证需求

### 提示词

```
现在设备接口能用了，但是我想加上登录功能，只有登录用户才能访问设备接口。

要求：
1. 密码要安全存储，不能明文保存，要防止被破解
2. 实现登录状态管理，用户登录后一段时间内不需要重复登录
3. 如果用户长时间没操作，登录状态会自动过期
4. 如果用户一直在操作，登录状态会自动续期
5. 系统有三种角色：普通用户、管理员、超级管理员，不同角色有不同的权限
6. 要防止攻击者通过响应时间判断用户名是否存在
```

### AI 回复要点

- **密码哈希**：使用 `pwdlib[argon2]`（Argon2 算法），`dummy_hash()` 防止时序攻击
- **Session 管理**：内存字典存储，`create_session` / `get_session` / `delete_session` / `extend_session` 四个函数
- **Cookie 安全**：`httponly`（防 XSS）、`samesite='lax'`（防 CSRF）、`secure`（仅 HTTPS）
- **滑动窗口续期**：Session 剩余时间低于 5 分钟时自动续期 30 分钟
- **角色等级**：`ROLE_LEVEL = {'user': 1, 'admin': 2, 'super_admin': 3}`，`require_role(min_role)` 工厂函数做权限检查

> 对应源码：[03-backend-detail.md §4.1](./03-backend-detail.md#_41-完整代码)、[§1.2](./03-backend-detail.md#_12-依赖)

---

## 6. 第六轮对话：用户管理和登录路由

### 提示词

```
现在帮我实现登录、登出、还有用户管理接口。

要求：
1. 系统第一次使用时，需要创建一个超级管理员账号
2. 用户登录时，如果连续输错密码多次，账号要锁定一段时间
3. 管理员可以创建、编辑、删除用户
4. 管理员可以启用或禁用用户账号
5. 管理员只能管理级别比自己低的用户，不能管理同级或更高级别的用户
6. 用户可以修改自己的密码
7. 创建用户时，不允许创建新的超级管理员，最高只能到管理员
```

### AI 回复要点

- **Pydantic 请求体模型**：`LoginRequest`、`SetupRequest`、`CreateUserRequest`（后续还补了 `UpdateUserRequest` 和 `ChangePasswordRequest`）
- **认证路由**：`/setup-status`（检查是否已初始化）、`/setup`（首次初始化创建超级管理员）、`/login`（登录）、`/logout`（登出）、`/me`（获取当前用户）
- **用户管理路由**：`GET /api/users`（列表）、`POST /api/users`（创建）、`DELETE /api/users/{id}`（删除）；后续还增加了改密码、改资料、启用/禁用
- **登录失败锁定**：连续 5 次失败锁定 15 分钟，锁定期间直接拒绝，过期自动解锁
- **权限检查**：删除用户时检查当前用户等级是否高于目标用户，防止管理同级或更高级别用户

> 对应源码：[03-backend-detail.md §5.1](./03-backend-detail.md#_51-完整代码)

---

## 7. 第七轮对话：整合 main.py

### 提示词

```
现在把所有路由都注册到 main.py 里。

要求：
1. 把所有路由都注册到应用里
2. 设备相关的接口都需要登录后才能访问
3. 应用启动时自动创建用户表（如果不存在的话）
4. 生产环境下要能托管前端静态文件，并且支持前端路由（所有未匹配的路径都返回 index.html）
```

### AI 回复要点

- **路由注册**：`auth_router` 和 `users_router` 直接注册；4 张设备表用 `create_router(table, delete_role='admin')` 工厂函数生成，统一加 `Depends(get_current_user)` 鉴权
- **启动时建表**：`users` 表在启动时 `CREATE TABLE IF NOT EXISTS`，保证幂等
- **SPA 托管**：生产模式下 `StaticFiles` 挂载 `/assets`，`/{full_path:path}` 兜底返回 `index.html`

> 对应源码：[03-backend-detail.md §3.1](./03-backend-detail.md#_31-完整代码)

---

## 8. 第八轮对话：测试验证

### 提示词

```
后端代码已完成，请告诉我如何测试。

要求：
1. 给出启动服务的命令（开发模式和生产模式）
2. 说明如何查看自动生成的 API 文档
3. 给出完整的测试流程：检查初始化状态 → 初始化超级管理员 → 登录 → 创建设备 → 查询列表
4. 给出具体的测试命令，方便我直接复制执行
```

### AI 回复要点

- **启动服务**：`uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`（生产环境由 IIS 拉起 `run_server.py`）
- **查看 API 文档**：访问 `http://localhost:8000/docs`，FastAPI 自动生成 Swagger UI
- **测试流程**：检查初始化状态 → 初始化超级管理员 → 登录（保存 Cookie）→ 创建相机 → 查询列表

> 对应源码：[05-deploy.md §4.3](./05-deploy.md#_43-测试后端启动)（生产启动）、[03-backend-detail.md §3.1](./03-backend-detail.md#_31-完整代码)（`/docs` 自动生成）、[§5.1](./03-backend-detail.md#_51-完整代码)（setup/login）、[§6.1](./03-backend-detail.md#_61-完整代码)（CRUD 路由）

---

## 9. 关键技巧总结

### 9.1 按开发顺序逐步引入功能

后端开发有明确的依赖顺序：

| 轮次 | 模块 | 说明 |
|------|------|------|
| 第1轮 | 项目结构 | 创建目录和依赖文件 |
| 第2轮 | main.py | 创建应用入口 |
| 第3轮 | db.py | 数据库操作封装 |
| 第4轮 | 设备路由 | 实现 CRUD 接口 |
| 第5轮 | auth.py | 引入认证系统 |
| 第6轮 | 用户路由 | 登录和用户管理 |
| 第7轮 | 整合 | 注册所有路由 |
| 第8轮 | 测试 | 验证接口 |

### 9.2 让 AI 主动提出安全建议

不要一开始就要求完整的安全机制，而是先实现基本功能，然后让 AI 主动提出改进建议：

```
用户：我想加上登录功能
AI：建议使用 Argon2 哈希密码，并添加时序攻击防护
```

### 9.3 通过多轮对话逐步完善

实际开发中，每个模块都需要多轮对话：

```
第1轮：实现基本功能
第2轮：添加错误处理
第3轮：优化性能
第4轮：添加文档和注释
```

---

## 10. 下一步

后端搭建完毕。建议继续阅读：

1. [前端篇（详细实现）](./04-frontend-detail.md) — 用 Vue 3 构建用户界面
2. [前端篇（Vibe Coding 实战）](./04-frontend-coding.md) — 看 AI 如何从零搭建前端

完整的后端代码已保存在 `backend/` 目录，可以通过以下命令启动：

```bash
uvicorn backend.main:app --reload
```
