# 02-数据库篇

本篇从零介绍 HopeEquipment 的数据库设计，包括选型理由、表结构、字段含义和表间关系。

## 1. 为什么选 SQLite

这是一个团队内部使用的设备管理系统，用户量小（通常 < 50 人），并发写入极少。SQLite 的优势完美匹配：

- **零配置**：不需要安装数据库服务器，没有端口、用户、权限配置
- **单文件部署**：整个数据库就是一个 `.db` 文件，备份 = 复制文件
- **Python 内置支持**：标准库 `sqlite3`，无需额外驱动
- **足够用**：对于小型系统，SQLite 的性能绰绰有余

当然，SQLite 也有局限：不支持高并发写入、不适合分布式部署。如果未来系统规模扩大，可以迁移到 MySQL/PostgreSQL。

## 2. 数据库文件组织

数据库相关文件都放在 `db/` 目录下：

```
db/
├── HopeEquipment.db           # SQLite 数据库文件（二进制）
├── HopeEquipment.sql          # Schema 导出（人类可读）
├── create_database_schema.py  # 建表脚本
└── get_database_schema.py     # Schema 导出工具
```

- **HopeEquipment.db** — 实际的数据库文件，SQLite 格式，二进制存储
- **HopeEquipment.sql** — 从 `.db` 文件导出的表结构定义，方便查看和版本控制
- **create_database_schema.py** — 建表脚本，用于生成 `.db` 文件
- **get_database_schema.py** — 导出工具脚本，用于生成 `.sql` 文件

## 3. 用户表 users

### 3.1 建表 SQL

```sql
-- db/HopeEquipment.sql (L54-L65)
CREATE TABLE users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
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

> 注意：`main.py` 启动时会用 `CREATE TABLE IF NOT EXISTS` 自动建表，所以首次运行后端就创建了 `users` 表。设备表则是在数据库初始化脚本中提前建好的。

### 3.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键，文本自增 ID，如 `users1`、`users2` |
| `name` | TEXT | 用户名，唯一，用于登录 |
| `student_id` | TEXT | 学号（可选） |
| `grade` | TEXT | 年级（可选） |
| `college` | TEXT | 学院（可选） |
| `password_hash` | TEXT | Argon2 哈希后的密码 |
| `role` | TEXT | 角色：`user` / `admin` / `super_admin` |
| `is_active` | INTEGER | 是否启用：`1` 启用，`0` 禁用 |
| `access_failed_count` | INTEGER | 连续登录失败次数 |
| `lockout_until` | TEXT | 锁定截止时间（ISO 格式），为空表示未锁定 |

### 3.3 设计决策

**为什么用文本 ID 而不是自增整数？**

系统中有 4 类设备，每类设备有独立的表，**并且设备数比较少**！如果用整数 ID，`camera1` 和 `lens1` 都是 `1`，在前端展示和调试时容易混淆。使用 `表名 + 序号` 的文本 ID（如 `camera1`、`lens3`），一眼就能看出属于哪张表。

**三级角色为什么用字符串而不是整数？**

虽然角色有层级关系（user < admin < super_admin），但用字符串存储更直观。在后端代码中通过 `ROLE_LEVEL` 字典映射为整数来比较：

```python
# backend/auth.py (L14)
ROLE_LEVEL = {'user': 1, 'admin': 2, 'super_admin': 3}
```

这个字典定义了三个角色的权限等级：
- `user` = 1（普通用户，只能查看和管理设备）
- `admin` = 2（管理员，可以管理用户和设备）
- `super_admin` = 3（超级管理员，拥有所有权限）

权限检查时，只需比较数字大小：`if user_level >= required_level`。这种设计让数据库存储直观（字符串易读），代码逻辑简洁（整数易比较）。

**登录失败锁定机制：**

- 每次登录失败，`access_failed_count` 加 1
- 达到 5 次，设置 `lockout_until` 为当前时间 + 15 分钟
- 锁定期间登录直接拒绝
- 锁定过期后自动解锁，重置失败计数

## 4. 设备表设计

系统管理 4 类设备，它们共享大量字段，但各有特殊字段。

### 4.1 共性字段

所有设备表都有以下基础字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键，如 `camera1`、`lens3` |
| `serial` | TEXT | 序列号 |
| `brand` | TEXT | 品牌（如 Sony、Canon） |
| `brand_id` | TEXT | 型号（如 A7M4、C75） |
| `hope_id` | TEXT | 厚朴编号（组织内部资产编号） |
| `location` | TEXT | 存放地点 |
| `fee_source` | TEXT | 经费来源 |
| `status` | TEXT | 状态：`正常` / `维修` / `退役` |

### 4.2 camera 表 — 相机

```sql
-- db/HopeEquipment.sql (L29-L39)
CREATE TABLE camera (
    id         TEXT PRIMARY KEY,
    serial     TEXT,
    brand      TEXT,
    brand_id   TEXT,
    hope_id    TEXT,
    location   TEXT,
    fee_source TEXT,
    status     TEXT,
    mount      TEXT
);
```

字段含义见 4.1 节的共性字段表；本表额外的 `mount` 是卡口类型（如 Sony E、Canon RF）。注意 SQLite 的表结构里没有 NOT NULL 与 DEFAULT 之外的约束，设备表所有列都可空。

### 4.3 camcorder 表 — 摄像机

```sql
-- db/HopeEquipment.sql (L17-L27)
CREATE TABLE camcorder (
    id         TEXT PRIMARY KEY,
    serial     TEXT,
    brand      TEXT,
    brand_id   TEXT,
    hope_id    TEXT,
    location   TEXT,
    fee_source TEXT,
    status     TEXT,
    mount      TEXT
);
```

结构与 `camera` 完全一致（列名、类型、顺序都相同），只是数据内容不同——摄像机同样有卡口信息。

### 4.4 lens 表 — 镜头

```sql
-- db/HopeEquipment.sql (L41-L52)
CREATE TABLE lens (
    id         TEXT PRIMARY KEY,
    serial     TEXT,
    brand      TEXT,
    brand_id   TEXT,
    hope_id    TEXT,
    location   TEXT,
    fee_source TEXT,
    status     TEXT,
    ref_id     TEXT,
    mount      TEXT
);
```

相比 camera/camcorder，多了：
- `ref_id` — 关联的相机或摄像机 ID（如 `camera1`）
- `mount` — 卡口类型

`ref_id` 表示这个镜头可以适配哪台机身。

### 4.5 accessory 表 — 配件

```sql
-- db/HopeEquipment.sql (L4-L15)
CREATE TABLE accessory (
    id         TEXT PRIMARY KEY,
    serial     TEXT,
    brand      TEXT,
    brand_id   TEXT,
    hope_id    TEXT,
    location   TEXT,
    fee_source TEXT,
    status     TEXT,
    acc_type   TEXT,
    ref_id     TEXT
);
```

相比其他设备表：
- `acc_type` — 配件类型（如"电池"、"充电器"、"存储卡"）
- `ref_id` — 关联的相机或摄像机 ID
- 没有 `mount`（配件不需要卡口信息）

四张设备表的列名在 `.sql` 里没有任何注释，字段的中文含义来自前端表格列定义与后端 Pydantic 模型（见 03/04 篇），SQL 只是结构真相。

### 4.6 状态值约定

所有设备的 `status` 字段统一使用三个值：

| 值 | 含义 | 前端颜色 |
|----|------|----------|
| `正常` | 设备可正常使用 | 绿色 |
| `维修` | 设备正在维修中 | 橙色 |
| `退役` | 设备已报废/退役 | 红色 |

这个约定贯穿前后端，在统计卡片、表格标签、详情展示中保持一致。

## 5. ID 生成策略

前面提到我们使用 `表名 + 序号` 的文本 ID。这不是 SQLite 的自增机制，而是在后端代码中手动实现的。

### 5.1 实现原理

```python
# backend/db.py (L49-L54)
def next_id(table: str) -> str:
    with get_connection() as conn:
        row = conn.execute(f'SELECT MAX(CAST(REPLACE(id, ?, "") AS INTEGER)) AS max_num FROM {table}',
                           (table,)).fetchone()
    num = (row['max_num'] or 0) + 1
    return f'{table}{num}'
```

**工作流程：**

1. 从表中取出所有 ID，去掉表名前缀（`REPLACE(id, 'camera', '')`）
2. 将剩余部分转为整数，取最大值（`MAX`）
3. 最大值 + 1，拼接表名，得到新 ID

**示例：**

- 表中已有 `camera1`、`camera2`、`camera3`
- `REPLACE` 后得到 `1`、`2`、`3`
- `MAX` = 3，+1 = 4
- 新 ID = `camera4`

**为什么不用 SQLite 的 AUTOINCREMENT？**

SQLite 的 `INTEGER PRIMARY KEY` 会自动递增，但我们的主键是 `TEXT` 类型。文本主键无法使用 SQLite 的自增机制，所以用 SQL 查询手动计算下一个 ID。

> 注意：这种方式在极高并发下可能产生重复 ID（两个请求同时读到相同的 MAX 值）。但对于我们的小型系统，写入并发极低，完全够用。

## 6. 表关系总览

### 6.1 ER 图

```
┌──────────────┐       ┌──────────────┐
│   camera     │       │  camcorder   │
│──────────────│       │──────────────│
│ id (PK)      │       │ id (PK)      │
│ serial       │       │ serial       │
│ brand        │       │ brand        │
│ ...          │       │ ...          │
│ mount        │       │ mount        │
└──────┬───────┘       └──────┬───────┘
       │                      │
       │    ┌─────────────────┘
       │    │
       │  ref_id (可选，指向 camera.id 或 camcorder.id)
       │    │
       ▼    ▼
┌──────────────┐       ┌──────────────┐
│    lens      │       │  accessory   │
│──────────────│       │──────────────│
│ id (PK)      │       │ id (PK)      │
│ serial       │       │ serial       │
│ brand        │       │ brand        │
│ ...          │       │ ...          │
│ ref_id (FK?) │       │ acc_type     │
│ mount        │       │ ref_id (FK?) │
└──────────────┘       └──────────────┘
```

### 6.2 关系说明

- **lens → camera / camcorder**：一个镜头关联一台机身（通过 `ref_id`），表示相机和镜头的固定搭配。
- **accessory → camera / camcorder**：一个配件关联一台机身（通过 `ref_id`），表示相机和配件的固定搭配。
- **一对多**：一台机身可以有多个镜头和配件
- **反向查询**：在仪表盘的详情抽屉中，通过 `lens.ref_id === camera.id` 过滤出关联的镜头

### 6.3 为什么没用外键约束？

SQLite 支持外键（`FOREIGN KEY`），但我们没有使用。原因：

1. **灵活性**：`ref_id` 可以指向 `camera` 或 `camcorder`，跨表外键在 SQLite 中不好定义
2. **简单性**：小型系统，数据一致性由应用层保证
3. **删除策略**：删除机身时，关联的镜头/配件的 `ref_id` 变成悬空引用，但不会报错。前端查询时自然过滤掉

如果未来需要更强的数据一致性，可以开启 SQLite 的外键支持并添加约束。

## 7. 数据库脚本

数据库文件是二进制格式，不方便直接查看和版本控制。我们提供了两个 Python 脚本来管理数据库：

### 7.1 建表脚本

`create_database_schema.py` 负责创建数据库文件并初始化所有表结构。运行 `python db/create_database_schema.py` 即可在 `db/` 目录下生成 `HopeEquipment.db`。

```python
# db/create_database_schema.py (L1-L119)
"""
创建 HopeEquipment 数据库表结构

使用方法：
    python db/create_database_schema.py

该脚本会在 db/ 目录下创建 HopeEquipment.db 文件（如果不存在），
并创建所有必要的表结构。
"""

import sqlite3
from pathlib import Path


def create_tables():
    """创建所有数据库表"""
    
    # 数据库文件路径
    db_path = Path(__file__).parent / "HopeEquipment.db"
    
    # 连接到数据库（如果文件不存在会自动创建）
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"正在创建数据库: {db_path}")
    
    # 创建 users 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            student_id TEXT,
            grade TEXT,
            college TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            is_active INTEGER NOT NULL DEFAULT 1,
            access_failed_count INTEGER NOT NULL DEFAULT 0,
            lockout_until TEXT
        )
    """)
    print("✓ 创建 users 表")
    
    # 创建 camera 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS camera (
            id TEXT PRIMARY KEY,
            serial TEXT,
            brand TEXT,
            brand_id TEXT,
            hope_id TEXT,
            location TEXT,
            fee_source TEXT,
            status TEXT,
            mount TEXT
        )
    """)
    print("✓ 创建 camera 表")
    
    # 创建 camcorder 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS camcorder (
            id TEXT PRIMARY KEY,
            serial TEXT,
            brand TEXT,
            brand_id TEXT,
            hope_id TEXT,
            location TEXT,
            fee_source TEXT,
            status TEXT,
            mount TEXT
        )
    """)
    print("✓ 创建 camcorder 表")
    
    # 创建 lens 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS lens (
            id TEXT PRIMARY KEY,
            serial TEXT,
            brand TEXT,
            brand_id TEXT,
            hope_id TEXT,
            location TEXT,
            fee_source TEXT,
            status TEXT,
            ref_id TEXT,
            mount TEXT
        )
    """)
    print("✓ 创建 lens 表")
    
    # 创建 accessory 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS accessory (
            id TEXT PRIMARY KEY,
            serial TEXT,
            brand TEXT,
            brand_id TEXT,
            hope_id TEXT,
            location TEXT,
            fee_source TEXT,
            status TEXT,
            acc_type TEXT,
            ref_id TEXT
        )
    """)
    print("✓ 创建 accessory 表")
    
    # 提交事务
    conn.commit()
    conn.close()
    
    print(f"\n数据库创建完成: {db_path}")
    print("所有表已成功创建！")


if __name__ == "__main__":
    create_tables()
```

脚本按顺序创建 5 张表：`users` → `camera` → `camcorder` → `lens` → `accessory`。每张表使用 `CREATE TABLE IF NOT EXISTS`，重复执行不会报错。


### 7.2 Schema 导出工具

`get_database_schema.py` 负责从 `.db` 文件导出可读的 SQL 表结构定义。

```python
# db/get_database_schema.py (L1-L32)
"""
从 HopeEquipment.db 提取数据库 schema 并生成格式化的 SQL 文件
"""
import sqlite3
from pathlib import Path


def get_table_schema(cursor, table_name):
    """获取单个表的 schema 定义"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()

    if not columns:
        return None

    lines = [f"CREATE TABLE {table_name} ("]
    col_defs = []

    for col in columns:
        col_name = col[1]
        col_type = col[2]
        not_null = " NOT NULL" if col[3] else ""
        default_value = f" DEFAULT {col[4]}" if col[4] is not None else ""
        pk = " PRIMARY KEY" if col[5] else ""

        col_def = f"    {col_name:10} {col_type}{pk}{not_null}{default_value}"
        col_defs.append(col_def)

    lines.append(",\n".join(col_defs))
    lines.append(");")

    return "\n".join(lines)
```

**列定义的对位**：`PRAGMA table_info(...)` 返回的每一行是固定 6 元组，所以脚本直接用下标取值——`col[1]` 列名、`col[2]` 类型、`col[3]` 是否 NOT NULL、`col[4]` 默认值、`col[5]` 是否主键。`{col_name:10}` 把列名补齐到 10 个字符宽，导出的 SQL 才对得整齐。

整个数据库的导出过程：

```python
# db/get_database_schema.py (L33-L62)


def extract_schema(db_path, output_path=None):
    """提取整个数据库的 schema"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = sorted([row[0] for row in cursor.fetchall()])

    schema_parts = ["-- HopeEquipment Database Schema", "-- Generated by get_database_schema.py\n"]

    for table in tables:
        table_schema = get_table_schema(cursor, table)
        if table_schema:
            schema_parts.append(table_schema)
            schema_parts.append("")

    conn.close()

    schema_text = "\n".join(schema_parts)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(schema_text)
        print(f"Schema 已保存到: {output_path}")
    else:
        print(schema_text)

    return schema_text
```

- 表清单来自 `sqlite_master`，并用 `name NOT LIKE 'sqlite_%'` 排除 SQLite 内部表；`sorted()` 保证每次导出的顺序一致，diff 才干净。
- `schema_parts` 里每个表后面追加一个空字符串，于是 `.sql` 文件里表与表之间有空行分隔。

命令行入口：

```python
# db/get_database_schema.py (L63-L73)


if __name__ == "__main__":
    db_file = Path(__file__).parent / "HopeEquipment.db"
    output_file = Path(__file__).parent / "HopeEquipment.sql"

    if not db_file.exists():
        print(f"错误: 数据库文件不存在: {db_file}")
        exit(1)

    extract_schema(db_file, output_file)
```

路径用 `Path(__file__).parent` 而不是当前工作目录，因此在项目任意位置执行 `python db/get_database_schema.py` 都能找到 `db/` 下的文件。

运行方式：

```bash
python db/get_database_schema.py
```

会自动从 `.db` 文件读取表结构，输出格式化的 SQL 到 `HopeEquipment.sql`。


## 8. 下一步

数据库设计完毕。建议继续阅读：

[数据库篇（Vibe Coding 实战）](./02-database-coding.md) — 看 AI 如何从零搭建数据库
