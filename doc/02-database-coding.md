# 02-数据库篇（Vibe Coding实战）

本篇展示如何使用 Qoder 从零搭建 HopeEquipment 的数据库。你将看到完整的提示词和 AI 回复的关键要点，可以直接复用到自己的项目中。

> 关于 Vibe Coding 的概念和工具介绍，请参见 [概况篇 - Vibe Coding 开发方式](./01-overview.md#6-vibe-coding-开发方式)。

> **本篇定位**：本篇展示的是「怎么用提示词把东西问出来」，而AI的回复可能差异比较大，因此只能作为参考，可能与仓库里的最终版本不同（字段、注释、实现都可能已经改过）。每个被概括的要点后面用 `> 对应源码：` 标出这部分内容落在原始文件的哪个位置；要看完整代码，请去 [02-数据库篇（详细实现）](./02-database-detail.md)。

## 1. 第一轮对话：描述整体需求

### 提示词

```
我要做一个设备管理系统，管理相机、摄像机、镜头和配件。

技术栈：
- 后端：Python + FastAPI + SQLite
- 前端：Vue 3 + TypeScript

数据库需求：
1. 用户表：存储用户信息，支持三级角色（user/admin/super_admin）
2. 设备表：4类设备（camera/camcorder/lens/accessory），共享基础字段
3. 设备之间有关联关系（镜头关联机身，配件关联机身）

请帮我设计数据库表结构，给出：
- 每张表的字段定义
- 字段类型和约束
- 表之间的关系
- 为什么这样设计
```

### AI 回复要点

**1. 用户表设计**

```sql
CREATE TABLE users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    student_id TEXT,
    grade      TEXT,
    college    TEXT,
    password_hash TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'user',
    is_active  INTEGER NOT NULL DEFAULT 1,
    access_failed_count INTEGER NOT NULL DEFAULT 0,
    lockout_until TEXT
);
```

> 对应源码：[03-backend-detail.md §3.1](./03-backend-detail.md#_3-1-完整代码)（main.py 运行时建表）、[02-database-detail.md §3.1](./02-database-detail.md#_3-1-建表-sql)（users 表最终结构）

**2. 设备表设计**

4 类设备共享基础字段，但各有特殊字段：

| 表名 | 特殊字段 | 说明 |
|------|----------|------|
| camera | `mount` | 卡口类型 |
| camcorder | `mount` | 卡口类型 |
| lens | `ref_id`, `mount` | 关联机身 + 卡口 |
| accessory | `ref_id`, `acc_type` | 关联机身 + 配件类型 |

> 对应源码：[02-database-detail.md §4.2-§4.5](./02-database-detail.md#_4-2-camera-表--相机)（四张设备表的特殊列：`mount` / `ref_id` / `acc_type`）

**3. 表关系**

```
camera/camcorder ←── lens (ref_id)
camera/camcorder ←── accessory (ref_id)
```

- 一台机身可以有多个镜头和配件（一对多）
- `ref_id` 存储关联的机身 ID

> 对应源码：[02-database-detail.md §4.5](./02-database-detail.md#_4-5-accessory-表--配件)（`accessory.ref_id`）、[§4.4](./02-database-detail.md#_4-4-lens-表--镜头)（`lens.ref_id`）、[04-frontend-detail.md §7.3](./04-frontend-detail.md#_7-3-dashboardvue--仪表盘)（按 `ref_id` 筛出关联镜头与配件）

**4. 设计决策**

- **文本 ID**：使用 `表名+序号` 格式（如 `camera1`），调试时一眼看出属于哪张表
- **分表存储**：4 类设备分开存储，避免大量 NULL 字段
- **字符串角色**：角色用字符串存储（`'user'`），代码中映射为整数比较

> 对应源码：[02-database-detail.md §5.1](./02-database-detail.md#_5-1-实现原理)（文本 ID 生成）、[§4.2-§4.5](./02-database-detail.md#_4-2-camera-表--相机)（分表存储）、[03-backend-detail.md §4.1](./03-backend-detail.md#_4-1-完整代码)（`ROLE_LEVEL` 常量）、§4.2（等级比较）

---

## 2. 第二轮对话：细化设计决策

### 提示词

```
关于用户表，我有几个问题：
1. 为什么用文本ID（如users1）而不是自增整数？
2. 角色用字符串存储，查询时怎么比较权限等级？
3. 登录失败锁定机制怎么实现？

关于设备表：
1. 4类设备字段很相似，是分开4张表还是一张大表？
2. 镜头和配件的ref_id怎么处理跨表关联？
```

### AI 回复要点

**1. 文本 ID vs 自增整数**

| 方案 | 优点 | 缺点 |
|------|------|------|
| 自增整数 | 简单、高效 | 多表时容易混淆（camera1 和 lens1 都是 1） |
| 文本 ID | 一眼看出属于哪张表 | 需要手动生成 |

对于我们的场景（4 类设备、少量数据），文本 ID 更友好。

> 对应源码：[02-database-detail.md §5.1](./02-database-detail.md#_5-1-实现原理)（`next_id` 用 `表名 + 序号` 拼出主键）

**2. 角色权限比较**

数据库存储字符串，代码中映射为整数：

```python
ROLE_LEVEL = {'user': 1, 'admin': 2, 'super_admin': 3}

# 权限检查
if ROLE_LEVEL[user['role']] >= ROLE_LEVEL[required_role]:
    # 允许访问
```

> 对应源码：[03-backend-detail.md §4.1](./03-backend-detail.md#_4-1-完整代码)（`ROLE_LEVEL` 常量）、§4.2（`require_role` 里的等级比较）

**3. 登录失败锁定**

```
每次失败：access_failed_count += 1
达到 5 次：设置 lockout_until = now + 15分钟
锁定期间：直接拒绝登录
锁定过期：自动解锁，重置计数
```

> 对应源码：[03-backend-detail.md §5.1](./03-backend-detail.md#_5-1-完整代码)（锁定期直接拒绝、过期自动解锁、失败计数 +1、满 5 次写入 `lockout_until`、登录成功清零）

**4. 分表 vs 合表**

| 方案 | 优点 | 缺点 |
|------|------|------|
| 合表 | 查询简单 | 大量 NULL、字段混乱 |
| 分表 | 结构清晰、易于扩展 | 需要分别处理 |

选择分表：4 类设备差异明显，分表更清晰。

> 对应源码：[02-database-detail.md §4.2-§4.5](./02-database-detail.md#_4-2-camera-表--相机)、[03-backend-detail.md §6.1](./03-backend-detail.md#_6-1-完整代码)（`TABLE_FIELDS` 按表列出各自允许的字段）

**5. 跨表关联**

`ref_id` 可以指向 `camera` 或 `camcorder`，不使用外键约束：

- **灵活性**：一个字段关联两张表
- **简单性**：应用层保证一致性
- **删除策略**：机身删除后，镜头的 `ref_id` 变成悬空引用，前端过滤掉即可

> 对应源码：[03-backend-detail.md §6.1](./03-backend-detail.md#_6-1-完整代码)（`ref_id` 只是普通字段，没有外键约束）、[04-frontend-detail.md §7.3](./04-frontend-detail.md#_7-3-dashboardvue--仪表盘)（悬空的 `ref_id` 匹配不到机身，自然被过滤掉）

---

## 3. 第三轮对话：生成建表脚本

### 提示词

```
请生成一个Python脚本，用sqlite3创建所有表。要求：
1. 使用CREATE TABLE IF NOT EXISTS，重复执行不报错
2. 自动创建db/HopeEquipment.db文件
3. 按顺序创建：users → camera → camcorder → lens → accessory
4. 每创建一张表打印确认信息
5. 添加详细的中文注释
```

### AI 回复要点

- **脚本结构**：按提示词要求，按顺序创建 5 张表（users → camera → camcorder → lens → accessory），每张表创建后打印确认信息
- **关键实现**：使用 `CREATE TABLE IF NOT EXISTS` 保证幂等性；数据库文件路径用 `Path(__file__).parent / "HopeEquipment.db"` 自动定位

> 对应源码：[02-database-detail.md §7.1](./02-database-detail.md#_7-1-建表脚本)

**运行方式**：

```bash
python db/create_database_schema.py
```

---

## 4. 第四轮对话：实现 ID 生成函数

### 提示词

```
我需要实现一个next_id函数，生成格式为"表名+序号"的文本ID。

例如：
- camera表已有camera1、camera2、camera3
- 调用next_id('camera')应返回camera4

要求：
1. 用SQL查询实现，不用Python循环
2. 处理空表情况（第一个ID应该是camera1）
3. 给出完整的函数代码
```

### AI 回复要点

- **核心思路**：用 SQL 的 `REPLACE(id, 'camera', '')` 去掉表名前缀，`CAST(... AS INTEGER)` 转为整数，`MAX(...)` 取最大值，然后 +1 拼接表名
- **空表处理**：`MAX` 返回 `NULL` 时用 `or 0` 兜底，得到 `表名1`
- **并发风险**：读取 `MAX` 与写入新行不在同一事务里，极高并发下可能重复 ID；本项目并发极低，完全够用

> 对应源码：[02-database-detail.md §5.1](./02-database-detail.md#_5-1-实现原理)（最终实现）、[03-backend-detail.md §6.1](./03-backend-detail.md#_6-1-完整代码)（新增记录时先 `db.next_id(table)` 再 `db.insert`）

---

## 5. 第五轮对话：测试和验证

### 提示词

```
请给出测试代码：
1. 插入几条测试数据，验证ID生成是否正确
2. 查询示例：如何查询相机及其关联的镜头
3. 边界情况：空表、删除中间记录后的ID生成
```

### AI 回复要点

- **插入测试数据**：用 `next_id` 生成 ID，`INSERT` 语句用 `?` 占位符防止 SQL 注入；镜头的 `ref_id` 关联到相机的 ID
- **查询关联数据**：用 `LEFT JOIN` 按 `ref_id` 关联；本项目实际在前端用 `filter` 组装（不做 SQL JOIN）
- **边界情况**：空表时 `MAX` 返回 `NULL`，`or 0` 兜底得到 `表名1`；删除中间记录后仍按当前最大值递增（基于 `MAX`，不是计数）

> 对应源码：[03-backend-detail.md §6.1](./03-backend-detail.md#_6-1-完整代码)（插入）、[§2.1](./03-backend-detail.md#_2-1-完整代码)（`insert` 实现）、[04-frontend-detail.md §7.3](./04-frontend-detail.md#_7-3-dashboardvue--仪表盘)（前端关联查询）

---

## 6. 关键技巧总结

### 6.1 分步骤提问

不要一次性要求所有代码，分模块逐步生成：

| 步骤 | 内容 |
|------|------|
| 第1轮 | 整体设计（表结构、关系） |
| 第2轮 | 细化决策（为什么这样设计） |
| 第3轮 | 生成建表脚本 |
| 第4轮 | 实现辅助函数 |
| 第5轮 | 测试和验证 |

### 6.2 提供上下文

告诉 AI 你的约束条件：

```
技术栈：Python + FastAPI + SQLite
用户量：< 50
并发：极低
ID格式：文本（如 camera1）
```

### 6.3 明确输出格式

要求 AI 给出：

- 详细的中文注释
- 可运行的示例代码
- 边界情况处理
- 测试代码

### 6.4 验证和迭代

1. **运行代码**：不要只看，要实际运行
2. **发现问题**：把错误信息复制给 AI
3. **反馈修复**：让 AI 解释并修复

### 6.5 保存对话记录

- 保存成功的提示词，方便复用
- 记录 AI 的解释，加深理解
- 整理成文档，供团队参考

---

## 7. 常见问题

### Q1: AI 生成的代码有 bug 怎么办？

**A**: 把错误信息完整复制给 AI，让它修复：

```
运行报错：
Traceback (most recent call last):
  File "db/create_database_schema.py", line 45, in <module>
    create_tables()
  ...
sqlite3.OperationalError: table users has no column named student_id

请修复这个问题。
```

### Q2: 如何让 AI 理解我的业务逻辑？

**A**: 用具体的例子说明：

```
例如：
- camera1 是一台 Sony A7M4
- lens1 和 lens2 都可以适配 camera1
- accessory1（电池）属于 camera1

请根据这个例子设计表关系。
```

### Q3: 生成的代码质量不高怎么优化？

**A**: 明确要求：

```
请生成生产级代码，要求：
1. 添加完整的错误处理
2. 遵循 PEP 8 规范
3. 添加类型注解
4. 包含详细的文档字符串
```

### Q4: 如何避免 AI "幻觉"（生成不存在的 API）？

**A**: 

1. 要求 AI 给出文档链接
2. 明确说"只用 Python 标准库"
3. 对不确定的 API，要求 AI 解释原理
4. 运行代码验证

### Q5: 对话太长，AI 忘了之前的内容怎么办？

**A**: 

1. 定期总结已确定的设计决策
2. 在新的对话中重复关键约束
3. 使用支持长上下文的 AI 工具

---

## 8. 下一步

数据库搭建完毕。建议继续阅读：

1. [后端篇（详细实现）](./03-backend-detail.md) — 用 FastAPI 搭建 API 服务
2. [后端篇（Vibe Coding 实战）](./03-backend-coding.md) — 看 AI 如何从零搭建后端

