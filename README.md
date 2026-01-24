<div align="center">
  <h2>Schedule Widget</h2>
  <p>
    智能化 • 可视化 • 全栈式
    <br />
    <br />
    <a href="https://github.com/colflip/schedule-widget/issues">报告 Bug</a>
    ·
    <a href="https://github.com/colflip/schedule-widget/issues">提出新功能</a>
  </p>
  
  <p>
    <img src="https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square" alt="Version">
    <img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License">
    <img src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg?style=flat-square" alt="Node">
    <img src="https://img.shields.io/badge/express-4.18.2-000000.svg?style=flat-square" alt="Express">
    <img src="https://img.shields.io/badge/postgresql-latest-336791.svg?style=flat-square" alt="PostgreSQL">
  </p>
</div>

---

## 核心功能

### 教师端
- **仪表盘**: 实时查看日程与统计。
- **时间管理**: 拖拽设置可用时间，自动同步。
- **数据分析**: 教学工时可视化。
- **账户安全**: 完善的资料与安全管理。

### 学生端
- **日程查看**: 多视图（日/周/月）课表。
- **时间规划**: 自主设定学习空闲时段。
- **学习统计**: 学习时长与轨迹追踪。

### 管理端
- **排课引擎**: 实时冲突检测，支持批量排课/锁定。
- **人员管理**: 账户生命周期与权限控制。
- **数据看板**: 系统级报表与 Excel 导出。
- **系统配置**: 学期、课程类型等参数设置。

## 技术架构

采用**前后端分离**逻辑架构，兼顾开发效率与性能。

| 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **Backend** | **Node.js + Express** | 轻量级 RESTful API 服务 |
| **Database** | **PostgreSQL** | 云原生关系型数据库 |
| **Auth** | **JWT + Bcrypt** | 无状态认证与安全加密 |
| **Frontend** | **Native JS (ES6+)** | 无框架依赖，高性能 |
| **UI** | **CSS3 + Glassmorphism** | 现代化拟态设计 |
| **Validation** | **Joi** | 严谨的数据校验 |

## 目录结构

```text
schedule-widget/
├── public/                  # 前端静态资源
│   ├── css/                 # 样式文件
│   ├── js/                  # 业务逻辑
│   │   ├── components/      # UI组件 (Modal, Toast)
│   │   ├── core/            # 核心库 (Auth, ApiClient)
│   │   └── modules/         # 业务模块
│   └── index.html           # 应用入口
├── src/
│   └── server/              # 后端核心
│       ├── controllers/     # 控制层
│       ├── services/        # 业务层
│       ├── middleware/      # 中间件
│       ├── routes/          # API路由
│       ├── db/              # 数据库层
│       └── app.js           # 服务入口
├── docs/                    # 项目文档
└── package.json             # 依赖配置
```

## 快速开始

### 1. 环境准备
*   Node.js v16+
*   npm v8+

### 2. 安装配置
```bash
git clone https://github.com/colflip/schedule-widget.git
cd schedule-widget
npm install
cp .env.example .env
# 编辑 .env 填入数据库信息
```

### 3. 初始化
```bash
npm run db:migrate:restructure
```

### 4. 启动
```bash
# 开发模式
npm run dev
# 生产模式
npm start
```
访问: `http://localhost:3001`

## 版权说明

基于 [MIT License](./LICENSE) 开源。
