# 设备管理系统 (HopeEquipment)

面向摄影器材（相机 / 摄像机 / 镜头 / 配件）的管理系统，提供完整增删改查、三级角色权限、Cookie Session 认证与数据可视化仪表盘。

本仓库为**教程文档站**，包含从零搭建整个系统的完整教程。

## 1. 在线阅读

文档托管在 GitHub Pages：

**https://jcchan23.github.io/hopeequipment/**

## 2. 本地阅读

```bash
npm install
npm run docs:dev
```

然后访问 http://localhost:5173/hopeequipment/

## 3. 项目结构

```
.
├── doc/                # 教程文档（8 篇）
├── assets/             # 图片资源
├── .vitepress/         # VitePress 配置
├── index.md            # 文档首页
├── package.json        # 文档站依赖
├── LICENSE
└── README.md
```

## 4. 文档索引

| 编号 | 篇名 | 说明 |
|------|------|------|
| 01 | [概况篇](doc/01-overview.md) | 项目简介、技术栈与整体架构 |
| 02-1 | [数据库 - 详细实现](doc/02-database-detail.md) | 表结构、字段语义、建库脚本 |
| 02-2 | [数据库 - Vibe Coding](doc/02-database-coding.md) | 用 AI 从零搭建数据库 |
| 03-1 | [后端 - 详细实现](doc/03-backend-detail.md) | FastAPI 路由、认证与 Session |
| 03-2 | [后端 - Vibe Coding](doc/03-backend-coding.md) | 用 AI 从零搭建后端 |
| 04-1 | [前端 - 详细实现](doc/04-frontend-detail.md) | Vue 3 页面、路由与状态管理 |
| 04-2 | [前端 - Vibe Coding](doc/04-frontend-coding.md) | 用 AI 从零搭建前端 |
| 05 | [部署篇](doc/05-deploy.md) | IIS + HttpPlatformHandler 上线 |

每篇教程分为两种：
- **详细实现（Detail）**：完整源码 + 逐段讲解，适合学习实现细节
- **Vibe Coding（Coding）**：提示词示范 + 关键要点，适合学习如何用 AI 辅助开发

## 5. 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3.5、TypeScript 6、Vite 8、Ant Design Vue 4.2、Pinia 4 |
| 后端 | FastAPI、Uvicorn、pwdlib[argon2] |
| 数据库 | SQLite |
| 部署 | IIS + HttpPlatformHandler（Windows Server） |

## 6. 许可

[MIT](LICENSE) © 2026 HopeEquipment
