# 04-前端篇（Vibe Coding实战）

本篇展示如何使用 Qoder 从零搭建 HopeEquipment 的 Vue 3 前端。你将看到完整的提示词和 AI 回复的关键要点，可以直接复用到自己的项目中。

> 关于 Vibe Coding 的概念和工具介绍，请参见 [概况篇 - Vibe Coding 开发方式](./01-overview.md#6-vibe-coding-开发方式)。

> **注意**：以下对话仅为示范，展示如何通过 Vibe Coding 逐步搭建前端。实际开发中，每个功能模块都需要通过多轮对话、引导和调整才能完善。你可以根据自己的需求，灵活调整提示词和开发顺序。

> **本篇定位**：本篇展示的是「怎么用提示词把东西问出来」，而AI的回复可能差异比较大，因此只能作为参考，可能与仓库里的最终版本不同（字段、注释、实现都可能已经改过）。每个被概括的要点后面用 `> 对应源码：` 标出这部分内容落在原始文件的哪个位置；要看完整且权威的代码，请去 [04-前端篇（详细实现）](./04-frontend-detail.md)。

---

## 1. 第一轮对话：项目初始化

### 提示词

```
我要用 Vue 3 搭建一个设备管理系统的前端。

技术栈：
- Vue 3 + TypeScript
- Ant Design Vue（UI 组件库）
- Vue Router（路由）
- Pinia（状态管理）

请帮我创建项目并安装所有依赖。
```

### AI 回复要点

**创建项目**：

```bash
npm create vite@latest frontend -- --template vue-ts
cd frontend
npm install
```

> 对应源码：[04-frontend-detail.md §1.2](./04-frontend-detail.md#_1-2-安装依赖)（初始化产物的最终形态，`devDependencies` 里还多了 `unplugin-vue-components`、`vue-tsc`）

**安装依赖**：

```bash
npm install vue-router pinia ant-design-vue @ant-design/icons-vue axios
npm install -D unplugin-vue-components
```

> 对应源码：[04-frontend-detail.md §1.2](./04-frontend-detail.md#_1-2-安装依赖)（`dependencies`、`devDependencies`）

**Vite 配置**：

```typescript
// frontend/vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      dts: 'src/components.d.ts',
      resolvers: [AntDesignVueResolver({ importStyle: false })],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

> 对应源码：[04-frontend-detail.md §1.3](./04-frontend-detail.md#_1-3-vite-配置)

---

## 2. 第二轮对话：入口文件

### 提示词

```
请帮我创建前端入口文件。

要求：
1. 设置中文语言环境
2. 添加全局样式，让表格偶数行显示蓝色斑马纹
3. 设置页面标题为"设备管理系统"
```

### AI 回复要点

- **main.ts**：注册 Vue、Pinia、Router、Ant Design Vue（全量导入 `reset.css`）
- **App.vue**：`<a-config-provider :locale="zhCN">` 设置中文，全局样式加表格偶数行蓝色斑马纹

> 对应源码：[04-frontend-detail.md §2.1](./04-frontend-detail.md#_2-1-maints)、[§2.2](./04-frontend-detail.md#_2-2-appvue)

---

## 3. 第三轮对话：路由定义

### 提示词

```
请帮我定义路由结构。

要求：
1. 有两个公开页面：系统初始化页面和登录页面（只有未登录用户才能访问）
2. 其他页面都需要登录后才能访问，并且包裹在统一的布局框架中
3. 需要登录的页面包括：
   - 首页（仪表盘）
   - 四类设备的管理页面（相机、摄像机、镜头、配件）
   - 用户管理页面（只有管理员才能访问）
4. 所有页面都要懒加载，提高首次加载速度
5. 添加导航守卫：检查登录状态、验证权限，未登录自动跳转到登录页
```

### AI 回复要点

- **路由结构**：`/setup` 和 `/login` 是公开页面（`meta.guest: true`）；其余包裹在 `MainLayout` 中，需要登录（`meta.requiresAuth: true`）
- **懒加载**：所有页面用 `() => import('./pages/xxx.vue')`
- **导航守卫**：`beforeEach` 里先 `loadUser()`，然后按 `guest` / `requiresAuth` / `minRole` 三个条件分支放行或重定向

> 对应源码：[04-frontend-detail.md §3.1](./04-frontend-detail.md#_3-1-路由定义)

---

## 4. 第四轮对话：状态管理

### 提示词

```
请帮我实现用户状态管理。

要求：
1. 保存当前登录用户的信息，以及是否已经加载过用户状态
2. 提供计算属性：是否已登录、当前角色、是否可以删除设备、是否可以管理用户
3. 提供方法：加载用户信息（从后端获取）、登录、登出
4. 实现角色等级判断：普通用户 < 管理员 < 超级管理员
```

### AI 回复要点

- **Pinia store**：`defineStore('auth', () => { ... })` 组合式 API 风格
- **状态**：`user`（当前用户信息）、`authLoaded`（是否已加载）
- **计算属性**：`isAuthenticated`、`role`、`roleLevel`、`canDelete`、`canManageUsers`
- **方法**：`loadUser()`（从 `/api/auth/me` 加载）、`login()`、`logout()`、`hasRole(minRole)`

> 对应源码：[04-frontend-detail.md §4.1](./04-frontend-detail.md#_4-1-完整代码)

---

## 5. 第五轮对话：API 层

### 提示词

```
请帮我封装 API 请求。

要求：
1. 请求要自动携带登录凭证（Cookie）
2. 设置合理的超时时间
3. 如果后端返回 401 未授权，自动跳转到登录页
4. 定义 TypeScript 接口：用户信息、设备记录
5. 封装认证相关的 API 函数（检查系统是否已初始化、登录、登出、获取当前用户）
6. 封装设备增删改查的 API 函数（通用，接收表名参数）
7. 封装一个统一的请求反馈函数，成功时显示成功提示，失败时显示错误提示
```

### AI 回复要点

- **Axios 实例**：`withCredentials: true` 携带 Cookie，`timeout: 15000`
- **响应拦截器**：401 时自动跳转 `/login?redirect=...`
- **TypeScript 接口**：`UserInfo`（用户信息）、`EquipmentRecord`（设备记录，含可选字段 `mount` / `ref_id` / `acc_type`）
- **API 函数**：认证相关（`getSetupStatus` / `login` / `logout` / `getMyInfo`）、设备 CRUD（`listEquipments` / `createEquipment` / `updateEquipment` / `deleteEquipment`，通用接收表名）
- **请求反馈封装**：`requestWithFeedback(action, successText)` 统一处理成功提示和错误提示

> 对应源码：[04-frontend-detail.md §5.1-§5.5](./04-frontend-detail.md#_5-1-axios-实例)

---

## 6. 第六轮对话：布局框架

### 提示词

```
请帮我实现整体布局框架。

要求：
1. 左侧边栏：
   - 可以折叠/展开
   - 顶部显示 Logo 和系统名称
   - 导航菜单包括：总览、相机、摄像机、镜头、配件、用户
   - 用户管理菜单只有管理员及以上角色才能看到

2. 顶部栏：
   - 左侧有折叠/展开按钮
   - 显示面包屑导航
   - 右侧显示当前用户信息（头像、姓名、角色标签）
   - 点击用户信息可以下拉，选择退出登录

3. 内容区：
   - 显示当前路由对应的页面
   - 只有内容区可以滚动，侧边栏和顶栏固定不动

4. 整体布局占满整个视口，不出现页面滚动条
```

### AI 回复要点

- **侧边栏**：`<a-layout-sider v-model:collapsed="collapsed">`，顶部 Logo + 系统名称，导航菜单按角色动态显示（`menuItems` computed）
- **顶栏**：折叠按钮、面包屑、用户信息（头像 + 姓名 + 角色标签）、下拉菜单（修改密码、退出登录）
- **内容区**：`<RouterView />`，外层 `overflow-y: auto`，侧边栏和顶栏 `overflow: hidden`
- **整体布局**：`height: 100vh`，`<a-layout class="layout">` 包裹

> 对应源码：[04-frontend-detail.md §6.1-§6.3](./04-frontend-detail.md#_6-1-模板结构)

---

## 7. 第七轮对话：登录页

### 提示词

```
请帮我实现登录页面。

要求：
1. 页面中央显示一个卡片，包含账号、密码输入框和登录按钮
2. 页面加载时检查系统是否已初始化，如果未初始化则跳转到初始化页面
3. 登录成功后跳转到用户之前访问的页面（如果 URL 中有 redirect 参数）
4. 登录成功或失败时显示相应的提示信息
5. 页面要有美观的背景效果
```

### AI 回复要点

- **页面结构**：居中卡片布局，`<a-card>` 包含账号、密码输入框和登录按钮
- **初始化检查**：`onMounted` 时调用 `getSetupStatus()`，未初始化则跳转 `/setup`
- **登录逻辑**：`authStore.login()` 后从 `route.query.redirect` 读取跳转目标（需校验是否以 `/` 开头防开放重定向）
- **样式**：浮动粒子背景 + 居中卡片，粒子用 CSS 动画实现

> 对应源码：[04-frontend-detail.md §7.1](./04-frontend-detail.md#_7-1-loginvue--登录页)

---

> 对应源码：[04-frontend-detail.md §7.1](./04-frontend-detail.md#_7-1-loginvue--登录页)

---

## 8. 第八轮对话：仪表盘

### 提示词

```
请帮我实现仪表盘页面。

要求：
1. 顶部有 4 张统计卡片，分别对应 4 类设备（相机、摄像机、镜头、配件）
   - 每张卡片展示：正常数量 + 维修数量 + 退役数量 = 总数量
   - 点击卡片可以跳转到对应的设备管理页面

2. 下方是设备卡片网格：
   - 按设备类型分组展示（相机和摄像机）
   - 每张卡片显示：设备照片、状态标签、品牌、厚朴编号、卡口、存放地点
   - 响应式布局：大屏 4 列、中屏 3 列、小屏 2 列、手机 1 列

3. 页面加载时并行请求 4 类设备的数据，按状态分类统计
```

### AI 回复要点

- **统计卡片**：4 张（相机、摄像机、镜头、配件），每张展示「正常 + 维修 + 退役 = 总计」，点击跳转对应设备页
- **设备卡片网格**：按设备类型分组（相机、摄像机），每张卡片显示状态标签、品牌、厚朴编号、卡口、地点
- **响应式布局**：`<a-row :gutter="16">` + `<a-col :xs="24" :sm="12" :md="8" :lg="6">`
- **数据加载**：`Promise.all` 并行请求 4 类设备，按状态分类统计

> 对应源码：[04-frontend-detail.md §7.3](./04-frontend-detail.md#_7-3-dashboardvue--仪表盘)

---

## 9. 第九轮对话：设备管理页

### 提示词

```
请帮我实现相机管理页面。

要求：
1. 页面顶部有"新增相机"按钮
2. 用表格展示所有相机，列包括：序列号、品牌、型号、厚朴编号、卡口、存放地点、状态、操作
3. 状态列用彩色标签显示（正常=绿色、维修=橙色、退役=红色）
4. 操作列有"编辑"和"删除"按钮
   - 删除需要管理员权限
   - 删除前要有二次确认弹窗
5. 点击"新增"或"编辑"时弹出表单弹窗，包含以下字段：
   - 序列号、品牌、型号、厚朴编号、卡口、存放地点、经费来源
   - 状态（下拉选择：正常、维修、退役）
6. 表单提交后显示成功/失败提示，并刷新列表
```

### AI 回复要点

- **页面结构**：顶部新增按钮 + 表格 + 弹窗（`EquipmentFormModal`）
- **表格列**：ID、序列号、品牌、型号、厚朴编号、卡口、地点、经费来源、状态、操作
- **状态列**：`<a-tag :color="getStatusColor(record.status)">`（正常=绿、维修=橙、退役=红）
- **操作列**：编辑、删除（`authStore.canDelete` 控制显示，`<a-popconfirm>` 二次确认）
- **CRUD 逻辑**：`loadItems()` / `openCreate()` / `openEdit()` / `handleSave()` / `handleDelete()`，统一用 `requestWithFeedback` 提示

> 对应源码：[04-frontend-detail.md §7.4](./04-frontend-detail.md#_7-4-cameravue--设备管理页)

---

## 10. 第十轮对话：通用表单组件

### 提示词

```
请帮我实现一个通用的设备表单弹窗组件。

要求：
1. 接收一个字段配置数组，根据配置自动生成表单
2. 支持两种字段类型：普通输入框和下拉选择框
3. 新增模式：表单为空
4. 编辑模式：自动填充现有数据
5. 提交时将表单数据传给父组件
6. 组件要通用，可以被相机、摄像机、镜头、配件页面复用
```

### AI 回复要点

- **Props**：`open`（弹窗开关）、`editing`（编辑的设备记录，`null` 表示新增）、`submitting`（提交中）、`label`（设备类型名称）、`formFields`（表单字段配置数组）
- **表单字段**：支持 `input` 和 `select` 两种类型，`select` 需要传 `options` 数组
- **数据填充**：`watch(() => props.open)` 监听弹窗打开，编辑模式填充 `editing` 数据，新增模式初始化为空
- **提交**：`handleSubmit()` 时 `emit('submit', formValues)`

> 对应源码：[04-frontend-detail.md §8.1](./04-frontend-detail.md#_8-1-equipmentformmodalvue--通用设备表单弹窗)

---

## 11. 关键技巧总结

### 11.1 按开发顺序提问

前端开发有明确的依赖顺序：

| 轮次 | 模块 | 说明 |
|------|------|------|
| 第1轮 | 项目初始化 | 创建项目、安装依赖 |
| 第2轮 | 入口文件 | main.ts、App.vue |
| 第3轮 | 路由定义 | 页面结构 |
| 第4轮 | 状态管理 | 用户状态 |
| 第5轮 | API 层 | 封装请求 |
| 第6轮 | 布局框架 | 顶栏 + 侧栏 |
| 第7轮 | 登录页 | 内容页 |
| 第8轮 | 仪表盘 | 内容页 |
| 第9轮 | 设备管理页 | 内容页 |
| 第10轮 | 通用组件 | 复用组件 |

### 11.2 先做布局，再做内容

开发习惯是先搭建整体框架（顶栏、侧栏），再逐步填充内容页面。

### 11.3 通过多轮对话逐步完善

实际开发中，每个模块都需要多轮对话来完善细节。

---

## 12. 下一步

恭喜你！到这里你已经完成了整个 HopeEquipment 项目的 Vibe Coding 实战教程。

建议继续阅读：

[部署篇](./05-deploy.md) — 将系统部署到 Windows Server
