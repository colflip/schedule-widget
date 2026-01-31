# 代码风格与开发规范指南 (Style Guide)

为了保证项目的可维护性与代码质量，所有贡献者请严格遵守本指南。

## 一、 核心原则

1.  **KISS (Keep It Simple, Stupid)**: 避免过度设计，代码应直观易读。
2.  **中文优先**: 所有注释、文档、Git Commit Message 必须使用**简体中文**。
3.  **单一职责**: 每个函数、类、模块只做一件事。

## 二、 注释规范 (JSDoc)

所有函数、类、复杂逻辑块**必须**包含 JSDoc 格式的中文注释。

### 1. 函数注释
必须包含 `@description` (描述做什么), `@param` (参数), `@returns` (返回值)。

**示例**:
```javascript
/**
 * 计算两个时间段的重叠时长
 * @description 用于检测课程安排是否冲突，返回重叠的分钟数。
 * @param {string} start1 - 时间段1开始时间 (HH:mm)
 * @param {string} end1   - 时间段1结束时间 (HH:mm)
 * @param {string} start2 - 时间段2开始时间 (HH:mm)
 * @param {string} end2   - 时间段2结束时间 (HH:mm)
 * @returns {number} 重叠的分钟数，如果没有重叠则返回 0
 */
function calculateOverlap(start1, end1, start2, end2) {
    // ... implementation
}
```

### 2. 关键逻辑注释
对于复杂的算法或非直观的逻辑，使用单行注释 `//` 解释 **"为什么这么做"** (Why)，而不仅仅是 "做什么" (What)。

```javascript
// 数据库存储的时间为 UTC，但前端展示需要转为用户本地时区
const localTime = convertToLocal(dbTime);
```

## 三、 命名规范

*   **变量/函数**: 小驼峰命名法 (`camelCase`)
    *   `const currentUser = ...`
    *   `function getUserData() { ... }`
*   **类/组件**: 大驼峰命名法 (`PascalCase`)
    *   `class ScheduleService { ... }`
    *   `class ModalComponent { ... }`
*   **常量**: 全大写下划线 (`UPPER_SNAKE_CASE`)
    *   `const MAX_RETRY_COUNT = 3;`
*   **文件名**: 小写烤串命名法 (`kebab-case`) 或 小驼峰 (`camelCase`)
    *   推荐后端文件使用 `camelCase`: `userController.js`
    *   推荐前端组件使用 `kebab-case`: `confirm-dialog.js` (视具体框架习惯统一定义) -> **本作统一约定**: 
        *   后端: `camelCase` (e.g., `scheduleService.js`)
        *   前端模块: `kebab-case` (e.g., `api-client.js`)

## 四、 架构规范

### 1. 后端分层 (MVC-S)
*   **Routes**: 定义 URL 路由，仅包含路由分发。
*   **Controllers**: 处理 HTTP 请求，参数解析，响应格式化。**严禁包含核心业务逻辑**。
*   **Services**: 包含所有业务逻辑、数据库交互、算法。**可复用，不依赖 HTTP 上下文**。
*   **Validators**: 独立的 Joi 验证 Schema。

### 2. 前端模块化
*   严禁使用全局变量 (Global Scoped Variables)。
*   使用 ES6 Modules (`import`/`export`) 进行代码组织。
*   UI 操作与数据请求分离 (`api-client.js` 负责数据, UI 组件负责渲染)。

## 五、 Git 提交规范

Commit Message 格式: `<Type>: <Subject>`

**Type 列表**:
*   `feat`: 新功能 (Feature)
*   `fix`: 修复 Bug
*   `docs`: 文档变动
*   `style`: 格式调整 (不影响逻辑，如空格、缩进)
*   `refactor`: 代码重构 (即不是新增功能，也不是修改bug的代码变动)
*   `perf`: 性能优化
*   `test`: 测试相关
*   `chore`: 构建过程或辅助工具的变动

**示例**:
*   `feat: 添加教师可用时间设置功能`
*   `fix: 修复排课冲突检测失效的问题`
*   `docs: 更新 README 安装步骤`
