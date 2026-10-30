# 05-部署篇

本篇介绍如何将 HopeEquipment 系统部署到 Windows Server 服务器，使用 IIS 作为 Web 服务器。

## 1. 部署架构

```
浏览器 → IIS (HTTPS 443) → HttpPlatformHandler → uvicorn (FastAPI)
```

**组件说明**：
- **IIS**：托管前端静态文件（`wwwroot/`），处理 HTTPS
- **HttpPlatformHandler**：IIS 模块，自动启动和管理后端进程
- **uvicorn**：ASGI 服务器，运行 FastAPI 应用
- **SQLite**：数据库文件存储在 `db/HopeEquipment.db`

**目录结构**：

```
<部署目录>\
├── backend/              # 后端代码
│   ├── __init__.py
│   ├── main.py
│   ├── db.py
│   ├── auth.py
│   └── routers/
├── db/                   # 数据库
│   └── HopeEquipment.db
├── wwwroot/              # 前端静态文件
│   ├── index.html
│   ├── assets/
│   └── web.config        # IIS 配置
├── logs/                 # 日志目录
├── venv/                 # Python 虚拟环境（在服务器上创建，见 4.2）
├── run_server.py         # 后端启动脚本
└── requirements.txt      # Python 依赖
```

---

## 2. 服务器环境准备

### 2.1 安装 Python

1. 下载 Python 3.13+：[https://www.python.org/downloads/](https://www.python.org/downloads/)
2. 安装时勾选 **"Add Python to PATH"**
3. 验证安装：

```powershell
python --version
# 应输出：Python 3.13.x
```

### 2.2 安装 IIS

1. 打开 **服务器管理器**
2. 点击 **添加角色和功能**
3. 选择 **Web 服务器 (IIS)**
4. 在 **角色服务** 中，确保勾选：
   - **常见 HTTP 功能**
     - 静态内容
     - 默认文档
   - **应用程序开发**
     - WebSocket 协议（可选）
   - **健康和安全**
     - 请求筛选
   - **性能**
     - 静态内容压缩
   - **管理工具**
     - IIS 管理控制台

5. 完成安装

### 2.3 安装 HttpPlatformHandler

HttpPlatformHandler 是 IIS 的模块，用于代理请求到后端进程。

1. 下载 HttpPlatformHandler：[https://www.iis.net/downloads/microsoft/httpplatformhandler](https://www.iis.net/downloads/microsoft/httpplatformhandler)
2. 选择 **HttpPlatformHandler V1.2**（适用于 IIS 8+）
3. 运行安装程序
4. 安装完成后，重启 IIS：

```powershell
iisreset
```

---

## 3. 本地打包

### 3.1 使用打包脚本

项目提供了自动打包脚本 `deploy/package.py`，会自动完成以下步骤：

1. 构建前端（`npm run build`）
2. 收集后端代码、数据库、配置文件
3. 生成部署包 `HopeEquipment_deploy_YYYYMMDD.zip`

**运行打包**：

```powershell
# 在项目根目录
python deploy/package.py
```

**打包产物**：

```
deploy/HopeEquipment_deploy_20261029.zip
```

**脚本完整源码**：

```python
# deploy/package.py (L1-L84)
"""打包部署包：构建前端 + 组装 zip。"""

import subprocess
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"
DB = ROOT / "db" / "HopeEquipment.db"
DEPLOY_SERVER = ROOT / "deploy" / "server"
REQUIREMENTS = ROOT / "requirements.txt"


def build_frontend():
    print(">>> 构建前端...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=FRONTEND,
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit("前端构建失败")
    print(">>> 前端构建完成")


def copy_tree_to_zip(src: Path, zipf: zipfile.ZipFile, arc_prefix: str, ignore: set[str] | None = None):
    ignore = ignore or set()
    for path in src.rglob("*"):
        if any(part in ignore for part in path.parts):
            continue
        if path.is_file():
            rel = path.relative_to(src)
            zipf.write(path, f"{arc_prefix}/{rel.as_posix()}")


def main():
    build_frontend()

    dist = FRONTEND / "dist"
    if not dist.is_dir():
        raise SystemExit("frontend/dist 不存在，构建可能失败")

    if not DB.is_file():
        raise SystemExit(f"数据库文件不存在: {DB}")

    today = date.today().strftime("%Y%m%d")
    zip_name = ROOT / "deploy" / f"HopeEquipment_deploy_{today}.zip"

    print(f">>> 打包 → {zip_name.name}")
    with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zf:
        # backend/
        copy_tree_to_zip(BACKEND, zf, "backend", ignore={"__pycache__"})

        # db/
        zf.write(DB, "db/HopeEquipment.db")

        # requirements.txt
        zf.write(REQUIREMENTS, "requirements.txt")

        # run_server.py (项目根目录)
        zf.write(DEPLOY_SERVER / "run_server.py", "run_server.py")

        # wwwroot/web.config
        zf.write(DEPLOY_SERVER / "web.config", "wwwroot/web.config")

        # wwwroot/ ← frontend/dist/ 内容
        copy_tree_to_zip(dist, zf, "wwwroot")

        # logs/ 空目录（zip 中用占位文件表示）
        zf.writestr("logs/.gitkeep", "")

    print(f">>> 完成: {zip_name}")
    print(f"    将 zip 上传到服务器，解压到目标目录（如 D:\\Web\\HopeEquipment\\）即可部署")


if __name__ == "__main__":
    main()
```

**逐段说明**：

| 位置 | 作用 |
|------|------|
| `L8-L13` | `ROOT` 由 `Path(__file__).resolve().parent.parent` 推出，即 `deploy/` 的上一级＝项目根目录，所以脚本在任意工作目录下执行都能定位资源 |
| `L16-L30` | `build_frontend()` 用 `subprocess.run(["npm", "run", "build"], cwd=FRONTEND, shell=True)` 构建前端；`shell=True` 是 Windows 下 `npm` 实际是 `npm.cmd` 所需要的；返回码非 0 时打印 stdout/stderr 并 `SystemExit` 中止 |
| `L33-L40` | `copy_tree_to_zip()` 把整个目录递归写入 zip，`arc_prefix` 决定 zip 内的顶层目录名，`ignore` 用于跳过 `__pycache__`；`rel.as_posix()` 保证 zip 内路径使用 `/` 分隔符 |
| `L46-L51` | 打包前校验 `frontend/dist` 与 `db/HopeEquipment.db` 是否存在，缺失即中止 |
| `L53-L54` | zip 文件名带当天日期 `HopeEquipment_deploy_YYYYMMDD.zip`，落在 `deploy/` 下 |
| `L57-L77` | zip 内容共 6 类：`backend/`（整个目录）、`db/HopeEquipment.db`、`requirements.txt`、`run_server.py`（从 `deploy/server/` 提到根目录）、`wwwroot/web.config`、`wwwroot/`（= `frontend/dist/` 内容）；`logs/` 用空文件 `logs/.gitkeep` 占位，因为 zip 没有真正的目录条目 |

注意 `run_server.py` 和 `web.config` 在 zip 里的位置：前者被放到**根目录**，后者被放进 **`wwwroot/`**。这正是 4.6 节 `web.config` 中 `..\run_server.py` 相对路径成立的前提。

### 3.2 部署包内容

解压后的目录结构：

```
HopeEquipment_deploy_20261029/
├── backend/              # 后端代码
├── db/                   # 数据库文件
├── wwwroot/              # 前端静态文件
│   ├── index.html
│   ├── assets/
│   └── web.config
├── logs/                 # 日志目录
├── run_server.py         # 后端启动脚本
└── requirements.txt      # Python 依赖
```

### 3.3 手动打包（可选）

如果需要手动打包：

```powershell
# 1. 构建前端
cd frontend
npm install
npm run build
cd ..

# 2. 创建部署目录
$deployDir = "deploy\HopeEquipment_deploy"
New-Item -ItemType Directory -Force -Path $deployDir

# 3. 复制文件
Copy-Item -Recurse -Force backend $deployDir\backend
Copy-Item -Recurse -Force db $deployDir\db
Copy-Item -Recurse -Force frontend\dist\* $deployDir\wwwroot
Copy-Item -Force deploy\server\run_server.py $deployDir\run_server.py
Copy-Item -Force deploy\server\web.config $deployDir\wwwroot\web.config
Copy-Item -Force requirements.txt $deployDir\requirements.txt
New-Item -ItemType Directory -Force -Path $deployDir\logs

# 4. 压缩
Compress-Archive -Path $deployDir\* -DestinationPath "deploy\HopeEquipment_deploy.zip"
```

---

## 4. 服务器部署

### 4.1 上传部署包

1. 将 `HopeEquipment_deploy_YYYYMMDD.zip` 上传到服务器
2. 解压到目标目录，例如：`<部署目录>\`

### 4.2 创建虚拟环境并安装依赖

`web.config` 里的 `processPath="..\venv\Scripts\python.exe"` 要求部署目录下存在名为 `venv` 的虚拟环境，因此依赖必须装进这个虚拟环境，而不是全局 Python：

```powershell
cd <部署目录>

# 1. 用全局 Python 创建虚拟环境
python -m venv venv

# 2. 用虚拟环境的 pip 安装依赖
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

**依赖说明**：
- `fastapi` — Web 框架
- `uvicorn` — ASGI 服务器
- `pwdlib[argon2]` — 密码哈希

**为什么用虚拟环境**：服务器的 Python 往往是多个站点共用，全局安装会把依赖版本混在一起；虚拟环境把本项目锁在 `<部署目录>\venv\` 内，卸载即删目录。

### 4.3 测试后端启动

**启动脚本完整源码**（源文件在 `deploy/server/run_server.py`，打包时被放到部署包根目录）：

```python
# deploy/server/run_server.py (L1-L13)
import os
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent
os.chdir(project_root)
sys.path.insert(0, str(project_root))

port = int(os.environ.get("HTTP_PLATFORM_PORT", 8000))

import uvicorn

uvicorn.run("backend.main:app", host="127.0.0.1", port=port)
```

**脚本要点**：
- `L5-L7`：`Path(__file__).resolve().parent` 取脚本自身所在目录（即部署目录根），先 `os.chdir` 再把它插到 `sys.path` 首位。这两步让 `backend.main` 能被导入，同时让 `db/HopeEquipment.db` 这种相对路径无论从哪个工作目录被拉起都指向同一个位置。
- `L9`：端口从环境变量 `HTTP_PLATFORM_PORT` 读取，缺省 `8000`。`HTTP_PLATFORM_PORT` 由 HttpPlatformHandler 在启动进程时自动注入，运维不需要手动配置；IIS 分配到的端口每次回收可能变化，所以必须读环境变量而不能写死。
- `L13`：只监听 `127.0.0.1`，对外访问必须经由 IIS 转发，后端端口不暴露到网卡。

**手动试跑**：

```powershell
cd <部署目录>
.\venv\Scripts\python.exe run_server.py
```

如果启动成功，会看到：

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

按 `Ctrl+C` 停止服务。

### 4.4 配置 IIS 网站

1. 打开 **IIS 管理器**
2. 右键 **网站** → **添加网站**
3. 填写配置：
   - **网站名称**：`HopeEquipment`
   - **物理路径**：`<部署目录>\wwwroot`
   - **绑定**：
     - 类型：`https`
     - IP 地址：`全部未分配`（或指定 IP）
     - 端口：`443`
     - 主机名：`your-domain.com`（可选）
     - 勾选 **需要 SNI**（如果使用多个 HTTPS 站点）
   - **SSL 证书**：选择已安装的证书

4. 点击 **确定**

### 4.5 配置应用程序池

1. 在 IIS 管理器中，点击 **应用程序池**
2. 找到 `HopeEquipment` 应用程序池
3. 右键 → **高级设置**
4. 修改以下配置：
   - **.NET CLR 版本**：`无托管代码`（重要！）
   - **启动模式**：`AlwaysRunning`（保持后端进程常驻）
   - **空闲超时（分钟）**：`0`（禁用空闲回收）
   - **回收 - 固定时间间隔**：`0`（禁用定时回收）

### 4.6 配置 web.config

`wwwroot/web.config` 由打包脚本从 `deploy/server/web.config` 复制而来，无需手工编写。完整内容：

```xml
<!-- deploy/server/web.config (L1-L14) -->
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="httpPlatformHandler" path="*" verb="*"
           modules="httpPlatformHandler" resourceType="Unspecified" />
    </handlers>
    <httpPlatform processPath="..\venv\Scripts\python.exe"
                  arguments="..\run_server.py"
                  stdoutLogEnabled="true"
                  stdoutLogFile="..\logs\stdout"
                  startupTimeLimit="30" />
  </system.webServer>
</configuration>
```

**配置说明**（所有相对路径都以 `wwwroot/` 为基准，因此 `..\` 就是部署目录根）：

| 属性 | 值 | 说明 |
|------|----|------|
| `path="*" verb="*"` | 处理器匹配 | 任意路径、任意 HTTP 方法都交给 `httpPlatformHandler` 模块 |
| `processPath` | `..\venv\Scripts\python.exe` | 用部署目录下的虚拟环境 Python（见 4.2）；写成相对路径，换机器不用改 |
| `arguments` | `..\run_server.py` | 传给 Python 的参数，即部署包根目录的启动脚本（见 4.3） |
| `stdoutLogEnabled` | `true` | 捕获后端标准输出。日志会持续累积、不会自动清理，排障结束后可改为 `false` |
| `stdoutLogFile` | `..\logs\stdout` | 实际文件名形如 `stdout_<时间戳>_<进程id>.log` |
| `startupTimeLimit` | `30` | 30 秒内进程必须开始监听端口，否则 IIS 判定启动失败并返回 502.3 |

**这里没有 `<environmentVariables>` 段**：端口不需要手工传给应用，HttpPlatformHandler 会自动向子进程注入 `HTTP_PLATFORM_PORT`，由 `run_server.py` 自己读取（见 4.3 的 `L9`）。同理未写 `processesPerApplication`，使用模块默认值（单进程）——SQLite 是单文件库，多进程并发写会互相阻塞，保持单进程更稳妥。

### 4.7 设置文件夹权限

IIS 需要读写以下目录：

```powershell
# 授予 IIS_IUSRS 组读写权限
icacls "<部署目录>\logs" /grant "IIS_IUSRS:(OI)(CI)RW" /T
icacls "<部署目录>\db" /grant "IIS_IUSRS:(OI)(CI)RW" /T
```

**重要：Python 安装路径权限**

IIS 用户还需要对 Python 安装路径有读取和执行权限，否则 HttpPlatformHandler 无法启动 Python 进程。

```powershell
# 查找 Python 安装路径
$pythonPath = (Get-Command python).Path | Split-Path

# 授予 IIS_IUSRS 组读取和执行权限
icacls $pythonPath /grant "IIS_IUSRS:(OI)(CI)RX" /T

# 使用虚拟环境时（见 4.2），venv 里的 python.exe 仍会加载基础安装的运行库和标准库，
# 所以虚拟环境目录也要一并授权
icacls "<部署目录>\venv" /grant "IIS_IUSRS:(OI)(CI)RX" /T
```

**为什么需要这个权限？**

HttpPlatformHandler 以 IIS 应用程序池的身份（通常是 `IIS_IUSRS` 组）运行 Python 进程。如果 IIS 用户没有权限访问 Python 解释器和相关库，会导致：
- 网站启动缓慢（等待超时）
- 返回 502.3 错误
- 日志中显示"拒绝访问"

**常见的 Python 安装路径：**
- 系统级安装：`C:\Python313` 或 `C:\Program Files\Python313`
- 用户级安装：`C:\Users\<username>\AppData\Local\Programs\Python\Python313`
- Miniforge/Anaconda：`C:\Users\<username>\miniforge3` 或 `C:\ProgramData\miniforge3`

**验证权限设置：**

```powershell
# 检查权限是否设置成功
icacls $pythonPath
```

应该能看到 `IIS_IUSRS:(OI)(CI)RX` 在权限列表中。

### 4.8 启动网站

1. 在 IIS 管理器中，右键 `HopeEquipment` 网站
2. 点击 **启动**

---

## 5. 验证部署

### 5.1 访问前端

打开浏览器，访问：

```
https://your-domain.com
```

应该能看到登录页面。

### 5.2 首次初始化

1. 首次访问会自动跳转到初始化页面
2. 设置超级管理员密码
3. 登录系统

### 5.3 测试 API

```bash
# 检查后端是否正常运行
curl https://your-domain.com/api/auth/setup-status
# 应返回：{"setup_done":true}
```

### 5.4 查看日志

如果出现问题，查看日志：

```powershell
# 后端日志
Get-Content <部署目录>\logs\stdout_*.log -Tail 50

# IIS 日志
Get-Content C:\inetpub\logs\LogFiles\W3SVC*\*.log -Tail 50
```

---

## 6. 常见问题

### Q1: 访问网站返回 502 Bad Gateway

**原因**：后端进程启动失败

**排查步骤**：
1. 检查日志：`logs\stdout_*.log`
2. 确认 `venv\Scripts\python.exe` 存在（不存在说明 4.2 的虚拟环境没建，`web.config` 的 `processPath` 会指向空路径）
3. 确认依赖装在虚拟环境里：`.\venv\Scripts\python.exe -m pip install -r requirements.txt`
4. 手动测试启动：`.\venv\Scripts\python.exe run_server.py`
5. 仍失败则检查 4.7 的 Python 安装目录与 `venv` 目录权限

### Q2: 数据库无法写入

**原因**：权限不足

**解决方法**：
```powershell
icacls "<部署目录>\db" /grant "IIS_IUSRS:(OI)(CI)RW" /T
```

### Q3: 前端页面刷新后 404

**原因**：IIS 未正确处理 SPA 路由

**解决方法**：
确认 `web.config` 中的 HttpPlatformHandler 配置正确，所有请求都会代理到后端。

### Q4: HTTPS 证书错误

**原因**：证书未正确安装或绑定

**解决方法**：
1. 在 IIS 管理器中，点击服务器节点
2. 双击 **服务器证书**
3. 确认证书已安装
4. 在网站绑定中，选择正确的证书

### Q5: 后端进程频繁重启

**原因**：应用程序池回收设置

**解决方法**：
1. 应用程序池 → 高级设置
2. 设置：
   - 空闲超时：`0`
   - 固定时间间隔：`0`
   - 启动模式：`AlwaysRunning`

---

## 7. 更新部署

### 7.1 更新步骤

1. 在本地运行打包脚本：`python deploy/package.py`
2. 上传新的部署包到服务器
3. 解压覆盖原有文件
4. 重启 IIS 网站或应用程序池

```powershell
# 重启应用程序池
Restart-WebAppPool -Name "HopeEquipment"
```

### 7.2 备份数据库

更新前建议备份数据库：

```powershell
Copy-Item "<部署目录>\db\HopeEquipment.db" "<部署目录>\db\HopeEquipment_backup_$(Get-Date -Format 'yyyyMMdd').db"
```

---

## 8. 下一步

部署完成！你可以：

1. 配置域名和 SSL 证书
2. 设置自动备份
3. 配置监控和告警
4. 优化性能（调整 uvicorn 进程数、启用缓存等）

恭喜！HopeEquipment 系统已成功部署到生产环境。
