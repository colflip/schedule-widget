/**
 * 数据导出对话框模块
 * 提供灵活的导出配置界面，支持多种导出类型和文件格式
 * 
 * 导出类型：
 * 1. 老师信息数据 - 基本信息+统计数据
 * 2. 学生信息数据 - 基本信息+统计数据
 * 3. 指定时间段的老师排课记录 - 详细排课信息
 * 4. 指定时间段的学生排课记录 - 详细排课信息
 * 
 * 导出格式：Excel, CSV
 */

window.ExportDialog = (function() {
    // ============ 常量定义 ============
    const EXPORT_TYPES = {
        TEACHER_INFO: 'teacher_info',           // 老师信息数据
        STUDENT_INFO: 'student_info',           // 学生信息数据
        TEACHER_SCHEDULE: 'teacher_schedule',   // 老师排课记录
        STUDENT_SCHEDULE: 'student_schedule'    // 学生排课记录
    };

    const EXPORT_FORMATS = {
        EXCEL: 'excel',
        CSV: 'csv'
    };

    const EXPORT_TYPE_CONFIG = {
        [EXPORT_TYPES.TEACHER_INFO]: {
            label: '老师信息数据',
            description: '导出所有老师的基本信息及相关统计数据',
            requiresDateRange: false,
            icon: 'person'
        },
        [EXPORT_TYPES.STUDENT_INFO]: {
            label: '学生信息数据',
            description: '导出所有学生的基本信息及相关统计数据',
            requiresDateRange: false,
            icon: 'people'
        },
        [EXPORT_TYPES.TEACHER_SCHEDULE]: {
            label: '指定时间段的老师排课记录',
            description: '导出老师在指定时间范围内的排课详细记录',
            requiresDateRange: true,
            icon: 'event_note'
        },
        [EXPORT_TYPES.STUDENT_SCHEDULE]: {
            label: '指定时间段的学生排课记录',
            description: '导出学生在指定时间范围内的排课详细记录',
            requiresDateRange: true,
            icon: 'calendar_month'
        }
    };

    // ============ 状态管理 ============
    const state = {
        isOpen: false,
        selectedType: null,
        selectedFormat: EXPORT_FORMATS.EXCEL,
        startDate: null,
        endDate: null,
        isExporting: false
    };

    // ============ DOM 引用 ============
    let dialogElement = null;
    let modalOverlay = null;

    /**
     * 初始化对话框 HTML 结构
     */
    function createDialogHTML() {
        const html = `
            <div id="exportDialogOverlay" class="export-dialog-overlay" style="display: none;">
                <div id="exportDialog" class="export-dialog-container">
                    <!-- 对话框头部 -->
                    <div class="export-dialog-header">
                        <div class="export-dialog-title">
                            <span class="material-icons-round">file_download</span>
                            <h2>数据导出</h2>
                        </div>
                        <button class="export-dialog-close" aria-label="关闭导出对话框">
                            <span class="material-icons-round">close</span>
                        </button>
                    </div>

                    <!-- 对话框内容 -->
                    <div class="export-dialog-content">
                        <!-- 步骤指示器 -->
                        <div class="export-steps">
                            <div class="step active" data-step="1">
                                <span class="step-number">1</span>
                                <span class="step-label">选择类型</span>
                            </div>
                            <div class="step-connector"></div>
                            <div class="step" data-step="2">
                                <span class="step-number">2</span>
                                <span class="step-label">配置选项</span>
                            </div>
                            <div class="step-connector"></div>
                            <div class="step" data-step="3">
                                <span class="step-number">3</span>
                                <span class="step-label">确认导出</span>
                            </div>
                        </div>

                        <!-- 步骤 1：选择导出类型 -->
                        <div class="export-step-content active" data-step="1">
                            <h3>选择导出类型</h3>
                            <div class="export-type-selector">
                                ${Object.entries(EXPORT_TYPE_CONFIG).map(([typeId, config]) => `
                                    <label class="export-type-option" data-type="${typeId}">
                                        <input type="radio" name="exportType" value="${typeId}" style="display: none;">
                                        <div class="export-type-card">
                                            <div class="export-type-icon">
                                                <span class="material-icons-round">${config.icon}</span>
                                            </div>
                                            <div class="export-type-info">
                                                <h4>${config.label}</h4>
                                                <p>${config.description}</p>
                                            </div>
                                            <div class="export-type-check">
                                                <span class="material-icons-round">check_circle</span>
                                            </div>
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <!-- 步骤 2：配置选项 -->
                        <div class="export-step-content" data-step="2">
                            <h3>配置导出选项</h3>
                            
                            <!-- 日期范围选择（仅对需要的类型显示） -->
                            <div class="export-date-range-section" style="display: none;">
                                <div class="export-form-group">
                                    <label for="exportStartDate">开始日期</label>
                                    <input type="date" id="exportStartDate" required>
                                </div>
                                <div class="export-form-group">
                                    <label for="exportEndDate">结束日期</label>
                                    <input type="date" id="exportEndDate" required>
                                </div>
                                <div class="export-date-presets">
                                    <label>快速选择:</label>
                                    <div class="export-preset-buttons">
                                        <button type="button" class="export-preset-btn" data-preset="today">今日</button>
                                        <button type="button" class="export-preset-btn" data-preset="week">本周</button>
                                        <button type="button" class="export-preset-btn" data-preset="month">本月</button>
                                        <button type="button" class="export-preset-btn" data-preset="quarter">本季度</button>
                                        <button type="button" class="export-preset-btn" data-preset="year">本年</button>
                                    </div>
                                </div>
                                <div class="export-date-validation" style="display: none;">
                                    <span class="material-icons-round">info</span>
                                    <span id="exportDateValidationMsg">日期范围有效</span>
                                </div>
                            </div>

                            <!-- 文件格式选择 -->
                            <div class="export-format-section">
                                <h4>导出格式</h4>
                                <div class="export-format-options">
                                    <label class="export-format-option">
                                        <input type="radio" name="exportFormat" value="excel" checked style="display: none;">
                                        <div class="export-format-card">
                                            <span class="material-icons-round">table_chart</span>
                                            <span>Excel (.xlsx)</span>
                                        </div>
                                    </label>
                                    <label class="export-format-option">
                                        <input type="radio" name="exportFormat" value="csv" style="display: none;">
                                        <div class="export-format-card">
                                            <span class="material-icons-round">storage</span>
                                            <span>CSV (.csv)</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <!-- 导出信息汇总 -->
                            <div class="export-config-summary">
                                <h4>导出配置汇总</h4>
                                <div class="export-summary-items">
                                    <div class="export-summary-item">
                                        <span class="export-summary-label">导出类型:</span>
                                        <span class="export-summary-value" id="exportConfigType">-</span>
                                    </div>
                                    <div class="export-summary-item export-summary-date" style="display: none;">
                                        <span class="export-summary-label">时间范围:</span>
                                        <span class="export-summary-value" id="exportConfigRange">-</span>
                                    </div>
                                    <div class="export-summary-item">
                                        <span class="export-summary-label">导出格式:</span>
                                        <span class="export-summary-value" id="exportConfigFormat">Excel</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 步骤 3：导出进度 -->
                        <div class="export-step-content" data-step="3">
                            <h3>导出进度</h3>
                            <div class="export-progress-section">
                                <div class="export-progress-bar-container">
                                    <div class="export-progress-bar">
                                        <div class="export-progress-fill" id="exportProgressFill" style="width: 0%"></div>
                                    </div>
                                    <div class="export-progress-text">
                                        <span id="exportProgressPercent">0%</span>
                                    </div>
                                </div>
                                <div class="export-progress-message">
                                    <span class="material-icons-round" id="exportProgressIcon">hourglass_empty</span>
                                    <span id="exportProgressMsg">准备导出...</span>
                                </div>
                                <div class="export-progress-details" id="exportProgressDetails" style="display: none;">
                                    <!-- 详细进度信息 -->
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 对话框底部 -->
                    <div class="export-dialog-footer">
                        <div class="export-dialog-actions">
                            <button id="exportDialogPrevBtn" class="export-btn-secondary" style="display: none;">
                                <span class="material-icons-round">arrow_back</span>
                                上一步
                            </button>
                            <div class="export-dialog-spacer"></div>
                            <button id="exportDialogCancelBtn" class="export-btn-secondary">
                                取消
                            </button>
                            <button id="exportDialogNextBtn" class="export-btn-primary" disabled>
                                <span class="material-icons-round">arrow_forward</span>
                                下一步
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return html;
    }

    /**
     * 初始化对话框样式
     */
    function injectStyles() {
        if (document.getElementById('exportDialogStyles')) return;

        const style = document.createElement('style');
        style.id = 'exportDialogStyles';
        style.textContent = `
            /* ========== 对话框样式 ========== */
            .export-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .export-dialog-container {
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                animation: slideUp 0.3s ease;
            }

            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* ========== 头部 ========== */
            .export-dialog-header {
                padding: 24px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .export-dialog-title {
                display: flex;
                align-items: center;
                gap: 12px;
                margin: 0;
            }

            .export-dialog-title h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #1e293b;
            }

            .export-dialog-title .material-icons-round {
                color: #0ea5e9;
                font-size: 28px;
            }

            .export-dialog-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #64748b;
                cursor: pointer;
                padding: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s ease;
            }

            .export-dialog-close:hover {
                background-color: #f1f5f9;
                color: #1e293b;
            }

            /* ========== 内容区 ========== */
            .export-dialog-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
                min-height: 300px;
            }

            /* ========== 步骤指示器 ========== */
            .export-steps {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 32px;
                position: relative;
            }

            .step {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                flex: 1;
                position: relative;
            }

            .step-number {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: #e2e8f0;
                color: #64748b;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
            }

            .step.active .step-number {
                background-color: #0ea5e9;
                color: white;
            }

            .step-label {
                font-size: 12px;
                color: #64748b;
                font-weight: 500;
                white-space: nowrap;
            }

            .step.active .step-label {
                color: #1e293b;
            }

            .step-connector {
                flex: 1;
                height: 2px;
                background-color: #e2e8f0;
                margin: 0 12px;
                margin-top: -20px;
            }

            .step.active + .step-connector {
                background-color: #0ea5e9;
            }

            /* ========== 步骤内容 ========== */
            .export-step-content {
                display: none;
                animation: fadeIn 0.3s ease;
            }

            .export-step-content.active {
                display: block;
            }

            .export-step-content h3 {
                margin: 0 0 20px 0;
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
            }

            /* ========== 导出类型选择 ========== */
            .export-type-selector {
                display: grid;
                grid-template-columns: 1fr;
                gap: 12px;
            }

            .export-type-option {
                display: block;
                cursor: pointer;
            }

            .export-type-card {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                transition: all 0.3s ease;
            }

            .export-type-option input:checked + .export-type-card {
                border-color: #0ea5e9;
                background-color: #f0f9ff;
            }

            .export-type-option:hover .export-type-card {
                border-color: #cbd5e1;
            }

            .export-type-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 48px;
                height: 48px;
                background-color: #f1f5f9;
                border-radius: 8px;
                flex-shrink: 0;
                font-size: 24px;
                color: #0ea5e9;
            }

            .export-type-option input:checked + .export-type-card .export-type-icon {
                background-color: #cffafe;
            }

            .export-type-info {
                flex: 1;
            }

            .export-type-info h4 {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 600;
                color: #1e293b;
            }

            .export-type-info p {
                margin: 0;
                font-size: 13px;
                color: #64748b;
            }

            .export-type-check {
                display: none;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                color: #0ea5e9;
            }

            .export-type-option input:checked + .export-type-card .export-type-check {
                display: flex;
            }

            /* ========== 日期范围选择 ========== */
            .export-date-range-section {
                margin-bottom: 24px;
                padding: 16px;
                background-color: #f8fafc;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            }

            .export-form-group {
                margin-bottom: 16px;
            }

            .export-form-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #1e293b;
                font-size: 14px;
            }

            .export-form-group input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                font-size: 14px;
                box-sizing: border-box;
                transition: all 0.2s ease;
            }

            .export-form-group input:focus {
                outline: none;
                border-color: #0ea5e9;
                box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
            }

            .export-date-presets {
                margin: 16px 0;
                padding-top: 16px;
                border-top: 1px solid #e2e8f0;
            }

            .export-date-presets label {
                display: block;
                margin-bottom: 12px;
                font-weight: 500;
                color: #1e293b;
                font-size: 13px;
            }

            .export-preset-buttons {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .export-preset-btn {
                padding: 8px 12px;
                background-color: white;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                color: #475569;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .export-preset-btn:hover {
                border-color: #0ea5e9;
                color: #0ea5e9;
                background-color: #f0f9ff;
            }

            .export-preset-btn.active {
                background-color: #0ea5e9;
                color: white;
                border-color: #0ea5e9;
            }

            .export-date-validation {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px;
                border-radius: 6px;
                font-size: 13px;
                margin-top: 12px;
                background-color: #ecfdf5;
                color: #047857;
                border: 1px solid #d1fae5;
            }

            .export-date-validation.error {
                background-color: #fef2f2;
                color: #dc2626;
                border-color: #fecaca;
            }

            .export-date-validation .material-icons-round {
                font-size: 18px;
            }

            /* ========== 格式选择 ========== */
            .export-format-section {
                margin-bottom: 24px;
            }

            .export-format-section h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
                color: #1e293b;
            }

            .export-format-options {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .export-format-option {
                display: block;
                cursor: pointer;
            }

            .export-format-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 16px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                transition: all 0.3s ease;
                font-size: 14px;
                font-weight: 500;
                color: #64748b;
            }

            .export-format-option input:checked + .export-format-card {
                border-color: #0ea5e9;
                background-color: #f0f9ff;
                color: #0ea5e9;
            }

            .export-format-option:hover .export-format-card {
                border-color: #cbd5e1;
                background-color: #f8fafc;
            }

            .export-format-card .material-icons-round {
                font-size: 28px;
            }

            /* ========== 配置汇总 ========== */
            .export-config-summary {
                margin-top: 24px;
                padding: 16px;
                background-color: #f8fafc;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            }

            .export-config-summary h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
                color: #1e293b;
            }

            .export-summary-items {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .export-summary-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 0;
                font-size: 13px;
            }

            .export-summary-label {
                font-weight: 500;
                color: #475569;
            }

            .export-summary-value {
                color: #1e293b;
                font-weight: 600;
            }

            /* ========== 进度显示 ========== */
            .export-progress-section {
                display: flex;
                flex-direction: column;
                gap: 20px;
                padding: 20px 0;
            }

            .export-progress-bar-container {
                position: relative;
            }

            .export-progress-bar {
                width: 100%;
                height: 8px;
                background-color: #e2e8f0;
                border-radius: 4px;
                overflow: hidden;
                position: relative;
            }

            .export-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #0ea5e9, #06b6d4);
                border-radius: 4px;
                transition: width 0.5s ease;
            }

            .export-progress-text {
                position: absolute;
                top: -24px;
                right: 0;
                font-size: 12px;
                font-weight: 600;
                color: #0ea5e9;
            }

            .export-progress-message {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background-color: #f0f9ff;
                border: 1px solid #bae6fd;
                border-radius: 8px;
                color: #0369a1;
                font-size: 14px;
            }

            .export-progress-message .material-icons-round {
                font-size: 20px;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .export-progress-message.success {
                background-color: #ecfdf5;
                border-color: #d1fae5;
                color: #047857;
            }

            .export-progress-message.success .material-icons-round {
                animation: none;
            }

            .export-progress-details {
                font-size: 12px;
                color: #64748b;
                padding: 12px 16px;
                background-color: #f8fafc;
                border-radius: 6px;
                border-left: 3px solid #94a3b8;
                max-height: 150px;
                overflow-y: auto;
            }

            /* ========== 底部操作 ========== */
            .export-dialog-footer {
                padding: 20px 24px;
                border-top: 1px solid #e2e8f0;
                background-color: #f8fafc;
            }

            .export-dialog-actions {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .export-dialog-spacer {
                flex: 1;
            }

            .export-btn-primary,
            .export-btn-secondary {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }

            .export-btn-primary {
                background-color: #0ea5e9;
                color: white;
            }

            .export-btn-primary:hover:not(:disabled) {
                background-color: #0284c7;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
            }

            .export-btn-primary:disabled {
                background-color: #cbd5e1;
                cursor: not-allowed;
                opacity: 0.6;
            }

            .export-btn-secondary {
                background-color: white;
                color: #1e293b;
                border: 1px solid #cbd5e1;
            }

            .export-btn-secondary:hover {
                background-color: #f1f5f9;
                border-color: #94a3b8;
            }

            .export-btn-secondary:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .export-btn-primary .material-icons-round,
            .export-btn-secondary .material-icons-round {
                font-size: 20px;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * 初始化对话框
     */
    function init() {
        if (dialogElement) return;

        // 注入样式
        injectStyles();

        // 创建 HTML
        const html = createDialogHTML();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const element = tempDiv.firstElementChild;
        document.body.appendChild(element);

        modalOverlay = document.getElementById('exportDialogOverlay');
        dialogElement = document.getElementById('exportDialog');

        // 绑定事件
        bindEvents();
    }

    /**
     * 绑定事件处理
     */
    function bindEvents() {
        // 关闭按钮
        document.querySelector('.export-dialog-close').addEventListener('click', close);

        // 导出类型选择
        document.querySelectorAll('.export-type-option').forEach(option => {
            option.addEventListener('click', () => {
                const typeId = option.getAttribute('data-type');
                selectExportType(typeId);
            });
        });

        // 格式选择
        document.querySelectorAll('.export-format-option').forEach(option => {
            option.addEventListener('click', () => {
                const format = option.querySelector('input').value;
                selectFormat(format);
            });
        });

        // 日期预设按钮
        document.querySelectorAll('.export-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => applyDatePreset(btn.getAttribute('data-preset')));
        });

        // 日期输入变化
        document.getElementById('exportStartDate').addEventListener('change', validateDateRange);
        document.getElementById('exportEndDate').addEventListener('change', validateDateRange);

        // 步骤导航
        document.getElementById('exportDialogNextBtn').addEventListener('click', nextStep);
        document.getElementById('exportDialogPrevBtn').addEventListener('click', prevStep);
        document.getElementById('exportDialogCancelBtn').addEventListener('click', close);

        // 点击背景关闭
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                close();
            }
        });
    }

    /**
     * 选择导出类型
     */
    function selectExportType(typeId) {
        // 防御性检查，确保类型存在于配置中
        const typeConfig = EXPORT_TYPE_CONFIG[typeId];
        if (!typeConfig) {
            console.warn('Unknown export type selected:', typeId);
            state.selectedType = null;

            // 更新单选框
            document.querySelectorAll('input[name="exportType"]').forEach(radio => {
                radio.checked = false;
            });

            // 隐藏日期范围
            const dateSection = document.querySelector('.export-date-range-section');
            if (dateSection) dateSection.style.display = 'none';

            updateConfigSummary();
            updateNextButtonState();
            return;
        }

        state.selectedType = typeId;

        // 更新单选框
        document.querySelectorAll('input[name="exportType"]').forEach(radio => {
            radio.checked = radio.value === typeId;
        });

        // 显示/隐藏日期范围
        const requiresDateRange = typeConfig.requiresDateRange;
        const dateSection = document.querySelector('.export-date-range-section');
        if (dateSection) dateSection.style.display = requiresDateRange ? 'block' : 'none';

        // 如果该类型需要日期范围但尚未设置，默认设置为本月
        if (requiresDateRange && (!state.startDate || !state.endDate)) {
            applyDatePreset('month');
        }

        // 更新汇总
        updateConfigSummary();

        // 启用下一步按钮
        updateNextButtonState();
    }

    /**
     * 选择导出格式
     */
    function selectFormat(format) {
        state.selectedFormat = format;
        document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
            radio.checked = radio.value === format;
        });
        updateConfigSummary();
    }

    /**
     * 应用日期预设
     */
    function applyDatePreset(preset) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        let start, end;

        switch (preset) {
            case 'today':
                start = end = `${year}-${month}-${day}`;
                break;
            case 'week': {
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                const startStr = weekStart.toISOString().split('T')[0];
                const endStr = today.toISOString().split('T')[0];
                start = startStr;
                end = endStr;
                break;
            }
            case 'month':
                start = `${year}-${month}-01`;
                end = `${year}-${month}-${day}`;
                break;
            case 'quarter': {
                const quarter = Math.floor(today.getMonth() / 3);
                const quarterStart = new Date(year, quarter * 3, 1);
                const quarterEnd = new Date(today);
                start = quarterStart.toISOString().split('T')[0];
                end = quarterEnd.toISOString().split('T')[0];
                break;
            }
            case 'year':
                start = `${year}-01-01`;
                end = `${year}-${month}-${day}`;
                break;
        }

        document.getElementById('exportStartDate').value = start;
        document.getElementById('exportEndDate').value = end;

        // 更新预设按钮状态
        document.querySelectorAll('.export-preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-preset') === preset);
        });

        validateDateRange();
    }

    /**
     * 验证日期范围
     */
    function validateDateRange() {
        const startInput = document.getElementById('exportStartDate');
        const endInput = document.getElementById('exportEndDate');
        const validationDiv = document.querySelector('.export-date-validation');
        const msgSpan = document.getElementById('exportDateValidationMsg');

        if (!startInput.value || !endInput.value) return;

        const start = new Date(startInput.value);
        const end = new Date(endInput.value);

        let isValid = true;
        let message = '日期范围有效';

        if (start > end) {
            isValid = false;
            message = '开始日期不能晚于结束日期';
        } else {
            const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
            if (daysDiff > 365) {
                isValid = false;
                message = '日期范围不能超过 365 天';
            }
        }

        state.startDate = isValid ? start : null;
        state.endDate = isValid ? end : null;

        msgSpan.textContent = message;
        validationDiv.classList.toggle('error', !isValid);
        validationDiv.style.display = 'flex';

        updateNextButtonState();
        updateConfigSummary();
    }

    /**
     * 更新配置汇总
     */
    function updateConfigSummary() {
        const typeConfig = EXPORT_TYPE_CONFIG[state.selectedType];
        document.getElementById('exportConfigType').textContent = typeConfig ? typeConfig.label : '-';

        const formatText = state.selectedFormat === EXPORT_FORMATS.EXCEL ? 'Excel (.xlsx)' : 'CSV (.csv)';
        document.getElementById('exportConfigFormat').textContent = formatText;

        const dateContainer = document.querySelector('.export-summary-date');
        if (typeConfig?.requiresDateRange && state.startDate && state.endDate) {
            const startStr = state.startDate.toLocaleDateString('zh-CN');
            const endStr = state.endDate.toLocaleDateString('zh-CN');
            document.getElementById('exportConfigRange').textContent = `${startStr} 至 ${endStr}`;
            dateContainer.style.display = 'flex';
        } else {
            dateContainer.style.display = 'none';
        }
    }

    /**
     * 更新下一步按钮状态
     */
    function updateNextButtonState() {
        const nextBtn = document.getElementById('exportDialogNextBtn');
        const currentStep = getCurrentStep();

        if (currentStep === 1) {
            nextBtn.disabled = !state.selectedType;
        } else if (currentStep === 2) {
            const typeConfig = EXPORT_TYPE_CONFIG[state.selectedType];
            if (typeConfig?.requiresDateRange) {
                nextBtn.disabled = !state.startDate || !state.endDate;
            } else {
                nextBtn.disabled = false;
            }
        } else if (currentStep === 3) {
            nextBtn.disabled = false;
        }
    }

    /**
     * 获取当前步骤
     */
    function getCurrentStep() {
        const activeContent = document.querySelector('.export-step-content.active');
        return parseInt(activeContent.getAttribute('data-step'));
    }

    /**
     * 下一步
     */
    function nextStep() {
        const currentStep = getCurrentStep();
        if (currentStep === 3) {
            // 执行导出
            performExport();
            return;
        }

        if (currentStep < 3) {
            goToStep(currentStep + 1);
        }
    }

    /**
     * 上一步
     */
    function prevStep() {
        const currentStep = getCurrentStep();
        if (currentStep > 1) {
            goToStep(currentStep - 1);
        }
    }

    /**
     * 跳转到指定步骤
     */
    function goToStep(stepNum) {
        // 更新内容
        document.querySelectorAll('.export-step-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`[data-step="${stepNum}"].export-step-content`).classList.add('active');

        // 更新步骤指示器
        document.querySelectorAll('.export-steps .step').forEach((step, idx) => {
            step.classList.toggle('active', idx + 1 <= stepNum);
        });

        // 更新按钮
        const prevBtn = document.getElementById('exportDialogPrevBtn');
        const nextBtn = document.getElementById('exportDialogNextBtn');

        prevBtn.style.display = stepNum > 1 ? 'flex' : 'none';

        if (stepNum === 3) {
            nextBtn.textContent = '';
            nextBtn.innerHTML = '<span class="material-icons-round">check</span>导出';
        } else {
            nextBtn.innerHTML = '<span class="material-icons-round">arrow_forward</span>下一步';
        }

        // 如果跳到第 2 步，且所选类型需要日期范围，但尚未设置，则默认设置为本月
        if (stepNum === 2) {
            const typeConfig = EXPORT_TYPE_CONFIG[state.selectedType];
            if (typeConfig?.requiresDateRange && (!state.startDate || !state.endDate)) {
                applyDatePreset('month');
            }
        }

        updateNextButtonState();

        // 步骤 3 时自动开始导出
        if (stepNum === 3) {
            setTimeout(performExport, 500);
        }
    }

    /**
     * 执行导出
     */
    async function performExport() {
        if (state.isExporting) return;
        state.isExporting = true;

        const typeConfig = EXPORT_TYPE_CONFIG[state.selectedType];
        const format = state.selectedFormat;

        try {
            // 更新 UI
            updateProgress(5, '验证参数...');
            await new Promise(r => setTimeout(r, 300));

            // 构建请求参数
            const params = new URLSearchParams({
                type: state.selectedType,
                format: format
            });

            if (typeConfig.requiresDateRange) {
                if (!state.startDate || !state.endDate) {
                    throw new Error('需要有效的导出日期范围');
                }
                const startDateStr = state.startDate.toISOString().split('T')[0];
                const endDateStr = state.endDate.toISOString().split('T')[0];
                params.append('startDate', startDateStr);
                params.append('endDate', endDateStr);
            }

            updateProgress(20, '正在加载数据...');
            await new Promise(r => setTimeout(r, 300));

            // 调用导出 API
            const response = await window.apiUtils.get(`/admin/export-advanced?${params.toString()}`);

            updateProgress(60, '正在生成文件...');
            await new Promise(r => setTimeout(r, 300));

            if (!response) {
                throw new Error('导出 API 返回为空');
            }

            // API 直接返回导出结果对象 {format, data, columns?, filename}
            const exportResult = response;

            // 生成文件
            if (format === EXPORT_FORMATS.EXCEL) {
                await generateExcelFile(exportResult.data);
            } else {
                generateCsvFile(exportResult.data);
            }

            updateProgress(100, '导出完成！');

            // 显示成功信息
            setTimeout(() => {
                showToast('导出成功', 'success');
                // 延迟关闭对话框
                setTimeout(() => {
                    close();
                }, 800);
            }, 500);
        } catch (error) {
            console.error('导出失败:', error);
            updateProgress(0, '导出失败');
            showToast(`导出失败: ${error.message}`, 'error');
            state.isExporting = false;
        }
    }

    /**
     * 更新导出进度
     */
    function updateProgress(percent, message) {
        const fill = document.getElementById('exportProgressFill');
        const percentSpan = document.getElementById('exportProgressPercent');
        const msgSpan = document.getElementById('exportProgressMsg');

        fill.style.width = percent + '%';
        percentSpan.textContent = percent + '%';
        msgSpan.textContent = message;
    }

    /**
     * 生成 Excel 文件
     */
    async function generateExcelFile(exportData) {
        // 确保 XLSX 库已加载
        if (typeof XLSX === 'undefined') {
            await loadXLSXLibrary();
        }

        // 处理导出数据：可能是对象数组或包含 data 字段的响应对象
        let data = Array.isArray(exportData) ? exportData : (exportData && exportData.data ? exportData.data : []);
        
        // 确保 data 是数组
        if (!Array.isArray(data)) {
            console.error('导出数据格式不正确:', exportData);
            throw new Error('导出数据格式不正确');
        }

        if (data.length === 0) {
            throw new Error('没有可导出的数据');
        }

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);

        // 调整列宽
        const maxWidth = 20;
        const colWidth = {};
        Object.keys(data[0] || {}).forEach(key => {
            colWidth[key] = Math.min(maxWidth, Math.max(key.length, 10));
        });
        worksheet['!cols'] = Object.values(colWidth).map(w => ({ wch: w }));

        XLSX.utils.book_append_sheet(workbook, worksheet, '数据');
        XLSX.writeFile(workbook, `export_${Date.now()}.xlsx`);
    }

    /**
     * 生成 CSV 文件
     */
    function generateCsvFile(exportData) {
        // 处理导出数据：可能是字符串或包含 data 字段的响应对象
        let csvContent = null;
        
        if (typeof exportData === 'string') {
            // 如果已经是 CSV 字符串
            csvContent = exportData;
        } else if (exportData && typeof exportData === 'object') {
            // 如果是响应对象，尝试获取 data 字段
            if (typeof exportData.data === 'string') {
                csvContent = exportData.data;
            } else if (Array.isArray(exportData.data)) {
                // 如果 data 是数组，转换为 CSV
                const data = exportData.data;
                if (data.length === 0) {
                    throw new Error('没有可导出的数据');
                }
                const headers = Object.keys(data[0]);
                const rows = data.map(row =>
                    headers.map(header => {
                        const value = row[header];
                        if (value === null || value === undefined) return '""';
                        return `"${String(value).replace(/"/g, '""')}"`;
                    }).join(',')
                );
                csvContent = [
                    headers.map(h => `"${h}"`).join(','),
                    ...rows
                ].join('\n');
            }
        }

        if (!csvContent) {
            console.error('导出数据格式不正确:', exportData);
            throw new Error('导出数据格式不正确');
        }

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `export_${Date.now()}.csv`;
        link.click();
    }

    /**
     * 加载 XLSX 库
     */
    async function loadXLSXLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof XLSX !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 显示提示信息（需要 admin.js 中的 showToast 函数）
     */
    function showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }

    /**
     * 打开对话框
     */
    function open() {
        init();
        state.isOpen = true;
        modalOverlay.style.display = 'flex';

        // 重置到第一步
        goToStep(1);
        state.selectedType = null;
        state.startDate = null;
        state.endDate = null;
        state.isExporting = false;
    }

    /**
     * 关闭对话框
     */
    function close() {
        if (!dialogElement) return;
        state.isOpen = false;
        modalOverlay.style.display = 'none';
    }

    /**
     * 公共 API
     */
    return {
        open,
        close,
        init,
        isOpen: () => state.isOpen,
        // 公开 applyDatePreset，供页面其它脚本调用以同步预设
        applyPreset: (preset) => {
            // ensure dialog created
            try { init(); } catch(_) {}
            try { applyDatePreset(preset); } catch (e) { console.warn('applyPreset failed', e); }
        }
    };
})();
