# 样式指南（绿色主题）

本指南定义统计页面及相关组件的统一绿色主题规范，移除蓝色系并满足可访问性标准。

## 色彩规范
- 主色：`#4CAF50`（CSS变量：`--brand-primary`）
- 辅助色：
  - 成功：`#2E7D32`（`--success-color`）
  - 警告：`#FF9800`（`--warning-color`）
  - 错误：`#F44336`（`--error-color`）
  - 信息：`#89C9B8`（`--info-color`）
- 次级绿色：
  - `--brand-secondary-1`: `#43A047`
  - `--brand-secondary-2`: `#66BB6A`
  - `--brand-secondary-3`: `#81C784`
- 渐变：
  - `--green-gradient`: `linear-gradient(135deg, #4CAF50 0%, #66BB6A 50%, #2E7D32 100%)`

### 禁用颜色清单（蓝色系）
- `#2196F3`, `#4C6FFF`, `#2251FF` 及所有接近蓝色的色值
- 若需要信息色，请使用 `--info-color`（暖青色）替换蓝色

### 使用场景规范
- 主色（按钮、激活标签、图例强调、饼图高亮）
- 次级绿色（柱状/折线序列、边框、hover背景）
- 状态色（成功/警告/错误）用于提示与状态标记，不用于数据系列

## 对比度标准
- 文本与背景对比度至少 4.5:1（WCAG AA）
- 大号文本（≥18pt 或 ≥14pt 加粗）对比度至少 3:1
- 样例：
  - 主要文本：`--text-color` `#1F2937` 与 `--bg-color` `#FAFAFA`（约 12.6:1）
  - 图例文本：深灰（`#374151`）与白背景（≥ 7:1）

## 排版与间距
- 基础字体：`--font-family-base`: `Inter, system-ui, -apple-system, 'Segoe UI', Roboto`
- 图表字体：`--chart-font-family`: `Source Han Sans CN, Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif`
- 图表字体粗细：Medium（`font-weight: 500`）
- 统一圆角：`--radius-unified`: `8px`
- 统一阴影：`--shadow-unified`: `0 2px 10px rgba(0,0,0,0.08)`
- 间距系统：`--space-1`~`--space-5` 用于栅格与卡片内边距

## 动效设计
- 悬停与焦点采用 `--hover-transition`: `all 160ms ease-in-out`
- 图表交互（图例点击/双击）不使用过度动效，保持反馈即时与清晰

## 响应式断点
- 768px / 992px / 1200px 三个断点（`dashboard.css` 已实现）
- 在 992px 与 1200px 降低图表高度与数据密度，保证阅读性

## 图标（SVG）规范
- 使用 `viewBox` 定义，确保缩放质量
- 颜色使用 `currentColor` 继承父级色值
- 移除冗余 `metadata`、`title` 等非必要节点
- 输出 1x/2x 两套资源（或使用矢量统一输出）

## 实施说明
- 所有颜色由 CSS 变量管理并已在 `public/css/dashboard.css` 定义
- 图表默认字体由 JS 启动时调用 `i18nUtils.applyChartFont()` 设置
- Blue 禁用清单由变量 `--forbidden-blue-*` 保留在 CSS 仅用于文档说明，不用于任何实际样式

# 样式组件规范补充（按钮、卡片、控制区）

本文件补充全局按钮、卡片组件与模块控制区的统一规范，与 `docs/style-guide.md` 颜色与排版保持一致。

## 按钮规范（全局）
- 圆角：统一为 `4px`（变量 `--btn-radius`）。
- 尺寸：提供 `小/中/大` 三档（类名 `btn-sm`/`btn-md`/`btn-lg`）。
- 内边距：垂直 `8px` / 水平 `16px`（变量 `--btn-padding-y`/`--btn-padding-x`）。
- 字体：使用系统标准中文字体（思源黑体 Medium），字号遵循 `12/14/16px` 三档。
- 颜色：默认使用主色（`--primary-color`）作为背景与边框，文本为白色。
- 交互：
  - `:hover` 背景与边框使用 `--primary-hover`。
  - `:active` 背景与边框使用 `--primary-active` 并 `translateY(1px)`。
  - `:focus-visible` 无 `outline`，使用 3px 绿色聚焦阴影。

示例：
- 基础：`<button class="btn btn-md">提交</button>`
- 轮廓：`<button class="btn btn-outline btn-sm">取消</button>`

## 卡片规范（全局）
- 背景：白色 `#FFFFFF`。
- 圆角：统一 `8px`（变量 `--card-radius`）。
- 内边距：`16px`（变量 `--space-std`）。
- 阴影：`0 2px 8px rgba(0,0,0,0.1)`（变量 `--shadow-card`）。
- 间距：卡片间 `16px`（`.card + .card { margin-top: var(--space-std) }` 或父容器 `gap: var(--space-std)`）。

## 控制区（模块操作条）
- 统一容器最小高度：`56px`（变量 `--controls-min-height`）。
- 统一布局：`display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;`。
- 容器外观：背景浅灰、1px 边框、卡片圆角与阴影与卡片一致。
- 应用范围：`用户管理 .user-tabs`、`排课管理 .schedule-controls`、`统计 .statistics-controls`。

# 字体与排版规范（v1）

本规范用于统一系统的字体使用与排版尺度，提升跨设备可读性与一致性。

## 字体栈
- 基准：`var(--font-family-base)`，默认映射到 `"Source Han Sans CN", "PingFang SC", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", "Noto Sans", sans-serif`
- 图表：`var(--chart-font-family)`，用于 Chart.js 标题/图例/标签

## 尺度（字号）
- `--font-size-xs`: 12px（最小字号，用于标签/辅助文本）
- `--font-size-sm`: 13px（小字号，用于密集按钮与次要信息）
- `--font-size-base`: 14px（正文基准字号）
- `--font-size-md`: 16px（大号正文/卡片标题）
- `--font-size-lg`: 18px（次级标题/模块标题）
- `--font-size-xl`: 20px（小型主标题）
- `--font-size-2xl`: 24px（主标题）
- `--font-size-3xl`: 28px（页面级标题）

## 行距与字重
- 行距：`--line-height-tight: 1.2`、`--line-height-normal: 1.5`、`--line-height-relaxed: 1.6`、`--line-height-loose: 1.8`
- 字重：`--font-weight-regular: 400`、`--font-weight-medium: 500`、`--font-weight-semibold: 600`、`--font-weight-bold: 700`
- 字距：`--tracking-tight: -0.01em`、`--tracking-normal: 0em`、`--tracking-wide: 0.02em`

## 全局元素规则
- 标题：`h1`→3xl、`h2`→2xl、`h3`→xl、`h4`→lg、`h5`→md、`h6`→base；字重根据层级设置为 Medium/Semibold，行距 `tight/normal`。
- 正文：`p` 使用 `base` 与 `relaxed` 行距。
- 小字与提示：`small,.text-small` 使用 `sm` 与 `normal` 行距；`.text-muted` 使用灰色文本。

## 关键组件映射
- 按钮：默认 `font-size: var(--font-size-base)`，`line-height: var(--line-height-normal)`；小中大：`btn-sm→xs`、`btn-md→base`、`btn-lg→md`。
- 导航与模块标题：`h2/h3` 继承全局标题规则；`.statistics-tabs .tab-btn` 使用 `xs` 与 `normal` 行距。
- 表格：`th, td` 使用 `base` 字号；表头加粗。
- 图表标题：`var(--font-size-md)` + `var(--font-weight-semibold)`。

## Chart.js 字体集成
- 变量：`--chart-font-family`、`--chart-font-size`、`--chart-font-weight`
- 行为：在 `public/js/i18n-utils.js` 中统一读取并设置 `Chart.defaults.font`

## 设备与分辨率建议
- 移动端（≤414px）：正文不小于 14px；按钮建议 `xs/base`；标题 `h3/h4`。
- 平板（768–1024px）：正文 `base/md`；模块标题 `lg`；页面标题 `2xl`。
- 桌面（≥1200px）：正文 `base`；模块标题 `lg`；页面标题 `2xl/3xl`。

## 使用示例
```html
<h2 class="section-title">统计概览</h2>
<p class="text-muted">按周统计课程类别，支持区间筛选。</p>
<button class="btn btn-sm">筛选</button>
<div class="chart-card">
  <div class="chart-header">
    <span class="chart-title">课程类型分布</span>
  </div>
  <canvas id="lessonTypeChart"></canvas>
  </div>
```

## 兼容说明
- 保留了旧变量 `--font-size-sm/md/lg` 的映射以避免破坏既有用法。
- 渐进式替换硬编码字号，优先在按钮、表格、图表标题与标签区域完成。

