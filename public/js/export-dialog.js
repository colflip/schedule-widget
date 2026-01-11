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

window.ExportDialog = (function () {
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
        // 根据角色过滤导出类型
        const currentUser = window.currentUser || {};
        const userType = currentUser.userType || 'admin';

        let filteredTypes = Object.entries(EXPORT_TYPE_CONFIG);
        if (userType === 'teacher') {
            filteredTypes = filteredTypes.filter(([id]) => id === EXPORT_TYPES.TEACHER_SCHEDULE);
        } else if (userType === 'student') {
            filteredTypes = filteredTypes.filter(([id]) => id === EXPORT_TYPES.STUDENT_SCHEDULE);
        }

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
                                ${filteredTypes.map(([typeId, config]) => `
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
                                        <button type="button" class="export-preset-btn" data-preset="yesterday">昨天</button>
                                        <button type="button" class="export-preset-btn" data-preset="last-week">上周</button>
                                        <button type="button" class="export-preset-btn active" data-preset="last-month">上月</button>
                                        <button type="button" class="export-preset-btn" data-preset="last-quarter">上季度</button>
                                        <button type="button" class="export-preset-btn" data-preset="last-year">去年</button>
                                    </div>
                                </div>
                                <div class="export-date-validation" style="display: none;">
                                    <span class="material-icons-round">info</span>
                                    <span id="exportDateValidationMsg">日期范围有效</span>
                                </div>
                            </div>

                            <!-- (已移除 CSV 选项，默认仅支持 Excel) -->
                            <div class="export-format-section" style="display: none;">
                                <h4>导出格式</h4>
                                <div class="export-format-options">
                                    <label class="export-format-option">
                                        <input type="radio" name="exportFormat" value="excel" checked style="display: none;">
                                        <div class="export-format-card">
                                            <span class="material-icons-round">table_chart</span>
                                            <span>Excel (.xlsx)</span>
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

        // 默认选中上月
        setQuickSelectDate('last-month');

        // 绑定预设按钮事件
        document.querySelectorAll('.export-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                setQuickSelectDate(preset);
            });
        });

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
            setQuickSelectDate('month');
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
    function setQuickSelectDate(preset) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        let start, end;

        switch (preset) {
            case 'yesterday': {
                const yest = new Date(today);
                yest.setDate(today.getDate() - 1);
                start = end = yest.toISOString().split('T')[0];
                break;
            }
            case 'last-week': {
                // 上周：上周一到上周日
                // 获取今天是周几 (0是周日)
                const currentDay = today.getDay();
                // 计算本周一的日期 (如果今天是周日(0)，要减6天；如果是周一(1)，减0天)
                // JS getDay() 0=Sun, 1=Mon...
                const diffToMon = currentDay === 0 ? 6 : currentDay - 1;
                const thisMonday = new Date(today);
                thisMonday.setDate(today.getDate() - diffToMon);

                // 上周一 = 本周一 - 7天
                const lastWeekMon = new Date(thisMonday);
                lastWeekMon.setDate(thisMonday.getDate() - 7);

                // 上周日 = 上周一 + 6天
                const lastWeekSun = new Date(lastWeekMon);
                lastWeekSun.setDate(lastWeekMon.getDate() + 6);

                start = lastWeekMon.toISOString().split('T')[0];
                end = lastWeekSun.toISOString().split('T')[0];
                break;
            }
            case 'last-month': {
                // 上个月完整一月
                // 获取上个月的年份和月份
                let y = today.getFullYear();
                let m = today.getMonth(); // 0-11, happy with this for calculation

                if (m === 0) { // 如果是一月，上月是去年12月
                    y -= 1;
                    m = 11;
                } else {
                    m -= 1;
                }

                const lastMonthStart = new Date(y, m, 1);
                // 下个月第0天即为本月最后一天
                const lastMonthEnd = new Date(y, m + 1, 0);

                // 格式化 YYYY-MM-DD
                // 注意 Month+1 因为 Date 对象 Month 是 0-indexed，但 ISOString 或者手写格式需要准确
                // 简单点用 helper
                const formatDate = (d) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                start = formatDate(lastMonthStart);
                end = formatDate(lastMonthEnd);
                break;
            }
            case 'last-quarter': {
                // 上季度
                const currentMonth = today.getMonth(); // 0-11
                const currentQuarter = Math.floor(currentMonth / 3); // 0, 1, 2, 3

                let targetYear = year;
                let targetQuarter = currentQuarter - 1;

                if (targetQuarter < 0) {
                    targetYear -= 1;
                    targetQuarter = 3;
                }

                const qStartMonth = targetQuarter * 3;
                const qEndMonth = targetQuarter * 3 + 2;

                const qStartDate = new Date(targetYear, qStartMonth, 1);
                const qEndDate = new Date(targetYear, qEndMonth + 1, 0);

                const formatDate = (d) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                start = formatDate(qStartDate);
                end = formatDate(qEndDate);
                break;
            }
            case 'last-year':
                start = `${year - 1}-01-01`;
                end = `${year - 1}-12-31`;
                break;
            case 'month': // Current month
                start = `${year}-${month}-01`;
                end = new Date(year, today.getMonth() + 1, 0).toISOString().split('T')[0];
                break;
            case 'today': // Today
                start = end = today.toISOString().split('T')[0];
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
        if (!state.selectedType) {
            document.getElementById('exportConfigType').textContent = '-';
            document.getElementById('exportConfigRange').textContent = '-';
            document.querySelector('.export-summary-date').style.display = 'none';
            return;
        }

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
            if (!state.selectedType) {
                nextBtn.disabled = true;
                return;
            }
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
                setQuickSelectDate('month');
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
                // 兼容不同后端命名习惯 (camelCase 和 snake_case)
                params.append('startDate', startDateStr);
                params.append('endDate', endDateStr);
                params.append('start_date', startDateStr);
                params.append('end_date', endDateStr);
            }

            // 确保 type 也传对
            params.append('type_id', state.selectedType || '');



            // 确保类型数据已加载
            if (window.ScheduleTypesStore) {
                await window.ScheduleTypesStore.ensureLoaded();
            }

            updateProgress(20, '正在加载数据...');
            await new Promise(r => setTimeout(r, 300));

            // 调用导出 API
            // 调用导出 API
            // 根据角色判断调用哪个接口
            let apiUrl = `/admin/export-advanced?${params.toString()}`;
            const currentUser = window.currentUser || {};
            const userType = currentUser.userType || 'admin';

            if (userType === 'teacher') {
                apiUrl = `/api/teacher/export?${params.toString()}`;
            } else if (userType === 'student') {
                apiUrl = `/api/student/export?${params.toString()}`;
            }

            const response = await window.apiUtils.get(apiUrl);


            updateProgress(60, '正在生成文件...');
            await new Promise(r => setTimeout(r, 300));

            if (!response) {
                throw new Error('导出 API 返回为空');
            }

            // API 直接返回导出结果对象 {format, data, columns?, filename} 或直接返回数组
            const exportResult = response;

            // 5. 构建优化后的文件名
            // 5. 构建优化后的文件名
            // 格式要求：
            // 管理员: [教师/学生]授课记录指定时间[开始_结束]_当前[管理员名].xlsx
            // 教师/学生: [姓名]授课记录[开始_结束]_当前.xlsx

            const now = new Date();
            const yyyyMMdd = now.toISOString().slice(0, 10).replace(/-/g, '');
            const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '');
            const timestamp = `${yyyyMMdd}${hhmmss}`; // YYYYMMDDHHMMSS

            let dateRangeStr = '';
            if (state.startDate && state.endDate) {
                const s = state.startDate.toISOString().split('T')[0].replace(/-/g, '');
                const e = state.endDate.toISOString().split('T')[0].replace(/-/g, '');
                dateRangeStr = `[${s}_${e}]`;
            }

            let filename = '';

            // 优先使用后端返回的文件名
            if (exportResult && exportResult.filename) {
                filename = exportResult.filename;
            } else {
                if (userType === 'admin') {
                    // 管理员格式
                    // 授课记录指定时间 -> 这里的 typeConfig.label 可能是 "教师授课记录" 或 "学生授课记录"
                    // 去掉可能的 "导出" 字样，保持核心名词
                    let coreName = typeConfig.label || '数据导出';
                    // 如果是特定格式的需求，强制调整 coreName
                    if (state.selectedType === EXPORT_TYPES.TEACHER_SCHEDULE) coreName = '教师授课记录指定时间';
                    if (state.selectedType === EXPORT_TYPES.STUDENT_SCHEDULE) coreName = '学生授课记录指定时间';

                    // 管理员名称使用 username
                    const adminName = currentUser.username || currentUser.name || 'admin';
                    filename = `${coreName}${dateRangeStr}_${timestamp}[${adminName}]`;
                } else {
                    // 教师/学生格式
                    // [姓名]授课记录[开始_结束]_当前
                    const myName = currentUser.name || currentUser.username || '用户';

                    filename = `[${myName}]授课记录${dateRangeStr}_${timestamp}`;
                }

                filename += `.${format === EXPORT_FORMATS.EXCEL ? 'xlsx' : 'csv'}`;
            }

            // 生成文件 - 传递 filename 参数
            // 兼容直接返回数组，或嵌套在 data.data 中的情况
            let rawData = [];

            if (Array.isArray(exportResult)) {
                rawData = exportResult;
            } else if (exportResult && exportResult.data) {
                if (Array.isArray(exportResult.data)) {
                    rawData = exportResult.data;
                } else if (Array.isArray(exportResult.data.data)) {
                    rawData = exportResult.data.data;
                }
            }



            const transformedData = transformExportData(rawData);

            if (format === EXPORT_FORMATS.EXCEL) {
                await generateExcelFile(transformedData, filename);
            } else {
                // CSV 不支持多 Sheet，如果是多 Sheet 数据，默认仅导出 "总览表"
                let csvData = transformedData;

                if (!Array.isArray(transformedData)) {
                    if (transformedData['总览表']) {
                        csvData = transformedData['总览表'];
                    } else if (typeof transformedData === 'object') {
                        // 兜底：如果没找到"总览表"，取第一个是数组的值
                        const values = Object.values(transformedData);
                        const firstArray = values.find(v => Array.isArray(v));
                        if (firstArray) {
                            csvData = firstArray;
                        }
                    }
                }

                generateCsvFile(csvData, filename);
            }


            /**
             * 转换导出数据：映射列名，格式化类型和状态
             * @param {Array} originalData 原始数据数组
             * @returns {Array|Object} 转换后的数据数组或多 Sheet 对象
             */
            function transformExportData(originalData) {
                if (!Array.isArray(originalData)) return [];

                // 状态映射
                const statusMap = {
                    1: '正常',
                    0: '已取消',
                    2: '已完成',
                    'pending': '待确认',
                    'confirmed': '已确认',
                    'completed': '已完成',
                    'cancelled': '已取消'
                };

                // 获取类型名称的辅助函数
                const getTypeName = (typeIdOrName) => {
                    if (!typeIdOrName) return '';
                    // 如果是数字ID，尝试查找
                    if (window.ScheduleTypesStore) {
                        const type = window.ScheduleTypesStore.getById(typeIdOrName);
                        if (type) return type.name || type.description;
                    }
                    return String(typeIdOrName);
                };

                // 转换基础数据（第一张表：排课明细）
                const baseData = originalData.map(row => {
                    // 解析日期和时间
                    let dateStr = row.date || row.arr_date || row.class_date || row['日期'] || '';
                    if (dateStr && dateStr.includes('T')) {
                        dateStr = dateStr.split('T')[0];
                    }

                    // 计算星期
                    let weekStr = '';
                    if (dateStr) {
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) {
                            const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                            weekStr = days[date.getDay()];
                        }
                    }

                    // 3. 类型: 中文 (英文)
                    // 后端返回的 Keys 中包含 '类型' (值为英文 name, e.g. 'visit')
                    const rawTypeVal = row['类型'] || row.course_id || row.courseId || row.type || row.schedule_type || row.type_id;
                    let typeKey = '';
                    let typeDesc = '未知';

                    // 尝试从 Store 获取
                    if (window.ScheduleTypesStore && typeof window.ScheduleTypesStore.getAll === 'function') {
                        const allTypes = window.ScheduleTypesStore.getAll();
                        let t = null;

                        // 1. 尝试通过 name 匹配 (e.g. rawTypeVal === 'visit')
                        t = allTypes.find(item => item.name === rawTypeVal);

                        // 2. 如果没找到，尝试通过 ID 匹配
                        if (!t) {
                            t = allTypes.find(item => String(item.id) === String(rawTypeVal));
                        }

                        if (t) {
                            typeKey = t.name || '';         // e.g. visit
                            typeDesc = t.description || '未知'; // e.g. 入户
                        }
                    }

                    // 如果 Store 查找失败，但有原始值
                    if (typeDesc === '未知' && rawTypeVal) {
                        typeKey = String(rawTypeVal);
                    }

                    const typeStr = (typeDesc !== '未知' || (typeKey && typeKey !== '0')) ? `${typeDesc} (${typeKey})` : '未知';

                    // 4. 时间段 start_time-end_time
                    // 后端返回的 Keys 中包含 '时间'，或尝试 start_time
                    let timeStr = '';

                    // 优先检查 start_time / end_time (以防后端修正后返回这些字段)
                    let sTime = row.start_time || row.startTime || row.begin_time;
                    let eTime = row.end_time || row.endTime || row.finish_time;

                    if (sTime && eTime) {
                        const fmt = (t) => {
                            if (!t) return '';
                            const match = String(t).match(/(\d{1,2}:\d{2})/);
                            return match ? match[1].padStart(5, '0') : String(t);
                        };
                        timeStr = `${fmt(sTime)}-${fmt(eTime)}`;
                    } else if (row['时间']) {
                        // 如果后端直接返回 '时间' 字段
                        timeStr = row['时间'];
                    } else if (row.time_range && row.time_range !== 'undefined-undefined') {
                        timeStr = row.time_range;
                    }

                    // 格式化创建时间
                    let createdAtStr = row.created_at || row['创建时间'] || '';
                    if (createdAtStr) {
                        if (String(createdAtStr).includes('-') && String(createdAtStr).includes(':')) {
                            // 可能是已经格式化的，不做处理
                        } else {
                            try {
                                const d = new Date(createdAtStr);
                                if (!isNaN(d.getTime())) {
                                    createdAtStr = d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
                                }
                            } catch (e) { }
                        }
                    }

                    const statusVal = row.status || row['状态'];

                    return {
                        '教师名称': row.teacher_name || row.name || row['教师名称'] || '',
                        '学生名称': row.student_name || row['学生名称'] || '',
                        '类型': typeStr,
                        '日期': dateStr,
                        '星期': weekStr,
                        '时间段': timeStr,
                        '状态': statusMap[statusVal] || statusVal || '未知',
                        '创建时间': createdAtStr,
                        '排课ID': row.id || row.schedule_id || row['排课ID'] || '',
                        '教师ID': row.teacher_id || row['教师ID'] || '',
                        '学生ID': row.student_id || row['学生ID'] || '',
                        '备注': row.remark || row.notes || row['备注'] || ''
                    };
                });

                // 如果是老师排课记录导出，增加第二张表：分老师明细表
                if (state.selectedType === EXPORT_TYPES.TEACHER_SCHEDULE) {
                    const statsData = aggregateTeacherStats(originalData);
                    return {
                        '总览表': baseData,
                        '分老师明细表': statsData
                    };
                }

                // 如果是学生排课记录导出
                if (state.selectedType === EXPORT_TYPES.STUDENT_SCHEDULE) {
                    // 1. 交换第一列和第二列 (学生名称 <-> 教师名称)
                    const reorderedBaseData = baseData.map(row => {
                        // 创建新对象以保证键的顺序
                        return {
                            '学生名称': row['学生名称'],
                            '教师名称': row['教师名称'],
                            ...row // 展开剩余属性，注意：后续同名属性会覆盖前面的，但这里我们主要为了调整前两个 keys 的顺序
                        };
                        // 上面的写法其实不能保证 Key 的顺序（JS对象的Key是无序的，但在大多数导出库中，可能依赖 Key 添加顺序或者 columns定义）
                        // 为了保险起见，我们重新构造对象
                        const newRow = {};
                        newRow['学生名称'] = row['学生名称'];
                        newRow['教师名称'] = row['教师名称'];
                        Object.keys(row).forEach(k => {
                            if (k !== '学生名称' && k !== '教师名称') {
                                newRow[k] = row[k];
                            }
                        });
                        return newRow;
                    });

                    // 2. 生成学生统计表
                    const statsData = aggregateStudentStats(originalData);

                    return {
                        '总览表': reorderedBaseData,
                        '分学生明细表': statsData
                    };
                }

                return baseData;
            }

            /**
             * 聚合学生统计数据 (第二张表)
             * 逻辑：
             * 1. 按学生汇总
             * 2. 入户/评审 去重逻辑：同一日期和时间(start_time)的n个老师授课/评审，当作一次。
             */
            function aggregateStudentStats(rawData) {
                const statsMap = new Map();

                rawData.forEach(row => {
                    // 排除已取消
                    const statusVal = row.status || row['状态'] || '';
                    const status = String(statusVal).toLowerCase();
                    if (status === '0' || status === 'cancelled' || status === '已取消') return;

                    const studentName = row.student_name || row['学生名称'] || '未知学生';
                    if (!statsMap.has(studentName)) {
                        statsMap.set(studentName, {
                            name: studentName,
                            // trial: 0, // Removed per request
                            consultation: 0,
                            group_activity: 0,
                            others: 0,
                            // 用于去重计数: key = date + '_' + start_time
                            visitSet: new Set(),
                            reviewSet: new Set(),

                            dates: new Set()
                        });
                    }

                    const stat = statsMap.get(studentName);

                    // 记录日期
                    let dateStr = row.date || row.arr_date || row.class_date || row['日期'] || '';
                    if (dateStr && dateStr.includes('T')) dateStr = dateStr.split('T')[0];
                    if (dateStr) stat.dates.add(dateStr);

                    // 时间 Key 用于去重
                    let startTime = row.start_time || '';
                    if (startTime && startTime.length > 5) startTime = startTime.substring(0, 5);
                    const timeKey = `${dateStr}_${startTime}`; // e.g. "2023-01-01_10:00"

                    // 类型判断
                    let typeKey = '';
                    const typeVal = row.course_id || row.type || row.schedule_type || row['类型'];
                    if (window.ScheduleTypesStore && window.ScheduleTypesStore.getById) {
                        const t = window.ScheduleTypesStore.getById(typeVal);
                        typeKey = t ? t.name : String(typeVal);
                    } else {
                        typeKey = String(typeVal || '');
                    }
                    typeKey = typeKey.toLowerCase();

                    // 统计逻辑
                    if (typeKey === 'visit' || typeKey === 'half_visit' || /visit/i.test(typeKey)) {
                        stat.visitSet.add(timeKey);
                    } else if (typeKey === 'review' || typeKey === 'review_record' || /review/i.test(typeKey)) {
                        // 评审 和 评审记录 都算作评审，且去重
                        stat.reviewSet.add(timeKey);
                    } else if (typeKey === 'trial' || /trial/i.test(typeKey)) {
                        stat.trial++;
                    } else if (typeKey === 'consultation' || /consultation/i.test(typeKey)) {
                        stat.consultation++;
                    } else if (typeKey === 'group_activity' || /group/i.test(typeKey)) {
                        stat.group_activity++;
                    } else {
                        stat.others++;
                    }
                });

                const result = [];
                statsMap.forEach(stat => {
                    // 计算日期范围
                    let dateRangeStr = '';
                    if (state.startDate && state.endDate) {
                        const s = state.startDate.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                        const e = state.endDate.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                        dateRangeStr = `${s}至${e}`;
                    } else {
                        const sortedDates = Array.from(stat.dates).sort();
                        if (sortedDates.length > 0) {
                            dateRangeStr = sortedDates.length === 1 ? sortedDates[0] : `${sortedDates[0]}至${sortedDates[sortedDates.length - 1]}`;
                        }
                    }

                    const visitCount = stat.visitSet.size;
                    const reviewCount = stat.reviewSet.size;

                    // 备注：学生姓名，日期段，X次... (仅显示次数 > 0 的项)
                    const remarkParts = [stat.name, dateRangeStr];
                    if (visitCount > 0) remarkParts.push(`${visitCount}次入户`);
                    if (reviewCount > 0) remarkParts.push(`${reviewCount}次评审`);
                    if (stat.group_activity > 0) remarkParts.push(`${stat.group_activity}次集体活动`);
                    if (stat.consultation > 0) remarkParts.push(`${stat.consultation}次咨询`);

                    const remarks = remarkParts.join('，');

                    result.push({
                        '姓名': stat.name,
                        '入户': visitCount,
                        '评审': reviewCount,
                        '集体活动': stat.group_activity,
                        '咨询': stat.consultation,
                        '备注': remarks
                    });
                });

                return result;
            }

            /**
             * 聚合老师统计数据 (第二张表)
             * @param {Array} rawData 原始数据
             */
            function aggregateTeacherStats(rawData) {
                const statsMap = new Map();

                rawData.forEach(row => {
                    // 排除已取消的记录
                    const statusVal = row.status || row['状态'] || '';
                    const status = String(statusVal).toLowerCase();
                    if (status === '0' || status === 'cancelled' || status === '已取消') {
                        return;
                    }

                    const teacherName = row.teacher_name || row.name || row['教师名称'] || '未知老师';
                    if (!statsMap.has(teacherName)) {
                        statsMap.set(teacherName, {
                            name: teacherName,
                            trial: 0,        // 试教
                            home_visit: 0,   // 入户
                            half_visit: 0,   // 半次入户
                            review: 0,       // 评审
                            review_record: 0,// 评审记录
                            consultation: 0, // 咨询/advisory
                            group_activity: 0, // 集体活动
                            others: 0,
                            dates: new Set() // 用于记录日期范围
                        });
                    }

                    const stat = statsMap.get(teacherName);

                    // 记录日期
                    let dateStr = row.date || row.arr_date || row.class_date || row['日期'] || '';
                    if (dateStr && dateStr.includes('T')) dateStr = dateStr.split('T')[0];
                    if (dateStr) stat.dates.add(dateStr);

                    // 统计类型
                    let typeKey = ''; // english key: visit, review, etc.
                    // let typeName = ''; // localized name

                    const typeVal = row.course_id || row.type || row.schedule_type || row['类型'];

                    if (window.ScheduleTypesStore && window.ScheduleTypesStore.getById) {
                        const t = window.ScheduleTypesStore.getById(typeVal);
                        typeKey = t ? t.name : String(typeVal); // name is usually the english key
                    } else {
                        // Fallback if store not loaded
                        typeKey = String(typeVal || '');
                    }

                    // Normalize key
                    typeKey = typeKey.toLowerCase();

                    // Strict matching based on schedule_types table (image provided by user)
                    if (typeKey === 'visit') stat.home_visit++;
                    else if (typeKey === 'half_visit') stat.half_visit++;
                    else if (typeKey === 'review') stat.review++;
                    else if (typeKey === 'review_record') stat.review_record++;
                    else if (typeKey === 'trial') stat.trial++;
                    else if (typeKey === 'consultation' || typeKey === 'advisory') stat.consultation++;
                    else if (typeKey === 'group_activity') stat.group_activity++;
                    else {
                        // Regex fallbacks only if strict match fails
                        if (/half_visit/i.test(typeKey)) stat.half_visit++;
                        else if (/visit/i.test(typeKey)) stat.home_visit++;
                        else if (/review_record/i.test(typeKey)) stat.review_record++;
                        else if (/review/i.test(typeKey)) stat.review++;
                        else if (/trial/i.test(typeKey)) stat.trial++;
                        else if (/consultation|advisory/i.test(typeKey)) stat.consultation++;
                        else if (/group/i.test(typeKey)) stat.group_activity++;
                        else stat.others++;
                    }
                });

                const result = [];
                // 转换 Map 为数组并可以计算衍生字段
                statsMap.forEach(stat => {
                    // 计算日期范围字符串
                    let dateRangeStr = '';
                    if (state.startDate && state.endDate) {
                        const s = state.startDate.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                        const e = state.endDate.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                        dateRangeStr = `${s}至${e}`;
                    } else {
                        const sortedDates = Array.from(stat.dates).sort();
                        if (sortedDates.length > 0) {
                            dateRangeStr = sortedDates.length === 1 ? sortedDates[0] : `${sortedDates[0]}至${sortedDates[sortedDates.length - 1]}`;
                        }
                    }

                    // 计算备注中显示的合并数值
                    // 1次评审记录 = 0.5次入户 + 1次评审
                    // 半次入户 = 0.5次入户
                    const effectiveVisits = stat.home_visit + stat.half_visit * 0.5 + (stat.review_record * 0.5);
                    const effectiveReviews = stat.review + (stat.review_record * 1);

                    // 备注：姓名，导出日期段，a次试教，b次入户... (折算后，过滤 0 值)
                    const remarkParts = [stat.name, dateRangeStr];
                    if (stat.trial > 0) remarkParts.push(`${stat.trial}次试教`);
                    if (effectiveVisits > 0) remarkParts.push(`${effectiveVisits}次入户`);
                    if (effectiveReviews > 0) remarkParts.push(`${effectiveReviews}次评审`);
                    if (stat.group_activity > 0) remarkParts.push(`${stat.group_activity}次集体活动`);
                    if (stat.consultation > 0) remarkParts.push(`${stat.consultation}次咨询`);

                    const remarks = remarkParts.join('，');

                    result.push({
                        '姓名': stat.name,
                        '试教': stat.trial,
                        '入户': stat.home_visit,
                        '半次入户': stat.half_visit,
                        '评审': stat.review,
                        '评审记录': stat.review_record,
                        '集体活动': stat.group_activity,
                        '咨询': stat.consultation,
                        '备注': remarks
                    });
                });

                return result;
            }

            // 计算记录数用于显示
            const recordCount = rawData.length || 0;

            updateProgress(100, `导出完成！共 ${recordCount} 条记录`);

            // 显示成功信息
            setTimeout(() => {
                showToast(`导出成功，共 ${recordCount} 条记录`, 'success');
                // 延迟关闭对话框
                setTimeout(() => {
                    close();
                }, 800);
            }, 500);
        } catch (error) {
            console.error('导出失败:', error);
            updateProgress(0, '导出失败');

            // 显示错误提示并提供重试按钮
            const progressMsg = document.getElementById('exportProgressMsg');
            if (progressMsg) {
                progressMsg.innerHTML = `
                    <span style="color: #ef4444;">导出失败: ${error.message || '未知错误'}</span>
                    <button onclick="window.ExportDialog.retryExport()" style="
                        margin-left: 12px;
                        padding: 4px 12px;
                        background: #0ea5e9;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">重试</button>
                `;
            }
            showToast(`导出失败: ${error.message}`, 'error');
            state.isExporting = false;
        }
    }

    /**
     * 重试导出
     */
    function retryExport() {
        state.isExporting = false;
        performExport();
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
     * @param {Object|Array} exportData - 导出数据 (支持 { sheetName: [], ... } 多 Sheet 结构)
     * @param {string} filename - 文件名 (可选)
     */
    async function generateExcelFile(exportData, filename) {
        // 确保 XLSX 库已加载
        if (typeof XLSX === 'undefined') {
            await loadXLSXLibrary();
        }

        const workbook = XLSX.utils.book_new();

        // 统一处理成 { SheetName: DataArray } 格式
        let sheets = {};
        if (Array.isArray(exportData)) {
            sheets['数据'] = exportData;
        } else if (exportData && typeof exportData === 'object' && !exportData.data) {
            // 认为是多 Sheet 结构
            sheets = exportData;
        } else {
            // 兼容旧结构或错误结构
            let data = (exportData && exportData.data) ? exportData.data : [];
            sheets['数据'] = Array.isArray(data) ? data : [];
        }

        let hasData = false;
        Object.keys(sheets).forEach(sheetName => {
            const data = sheets[sheetName];
            if (Array.isArray(data) && data.length > 0) {
                const worksheet = XLSX.utils.json_to_sheet(data);

                // 1. 计算自适应列宽
                const colWidths = [];
                const headers = Object.keys(data[0]);

                // 预设宽度
                const minWidths = {
                    '时间段': 15,
                    '备注': 30, // 备注宽一点
                    '创建时间': 20
                };

                headers.forEach((key, i) => {
                    let maxLength = minWidths[key] || 10;
                    // 计算标题长度 (中文算2)
                    const headerLen = key.replace(/[\u4e00-\u9fa5]/g, 'aa').length;
                    if (headerLen > maxLength) maxLength = headerLen;

                    // 遍历前 50 行数据
                    const sampleSize = Math.min(data.length, 50);
                    for (let r = 0; r < sampleSize; r++) {
                        const val = data[r][key];
                        if (val) {
                            const strVal = String(val);
                            const len = strVal.replace(/[\u4e00-\u9fa5]/g, 'aa').length;
                            if (len > maxLength) maxLength = len;
                        }
                    }
                    // 限制最大宽度，避免过宽
                    colWidths[i] = { wch: Math.min(maxLength + 2, 60) };
                });
                worksheet['!cols'] = colWidths;

                // 2. 冻结首行
                worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

                // 3. 尝试设置样式（注意：标准 SheetJS 可能不支持，但加了不报错）
                // 设置第一行（标题）加粗
                // 遍历所有数据单元格，如果是备注列，设置自动换行
                const range = XLSX.utils.decode_range(worksheet['!ref']);
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                        if (!worksheet[cell_address]) continue;

                        // 首行加粗
                        if (R === 0) {
                            worksheet[cell_address].s = { font: { bold: true }, alignment: { horizontal: "center" } };
                        }

                        // 备注列自动换行
                        // 获取列名
                        const key = headers[C];
                        if (key === '备注') {
                            if (!worksheet[cell_address].s) worksheet[cell_address].s = {};
                            worksheet[cell_address].s.alignment = { wrapText: true, vertical: "top" };
                        }
                    }
                }

                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
                hasData = true;
            }
        });

        if (!hasData) {
            throw new Error('没有可导出的数据');
        }

        // 使用传入的文件名或默认文件名
        const finalFilename = filename || `export_${Date.now()}.xlsx`;
        XLSX.writeFile(workbook, finalFilename);
    }

    /**
     * 生成 CSV 文件
     * @param {Object|Array|string} exportData - 导出数据
     * @param {string} filename - 文件名 (可选)
     */
    function generateCsvFile(exportData, filename) {
        // 处理导出数据：可能是字符串或包含 data 字段的响应对象，或者是直接的数组
        let csvContent = null;

        if (Array.isArray(exportData)) {
            // 如果直接是数组 (Transformed data)
            const data = exportData;
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
        } else if (typeof exportData === 'string') {
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
        // 使用传入的文件名或默认文件名
        link.download = filename || `export_${Date.now()}.csv`;
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
     * 重置状态
     */
    function resetState() {
        state.selectedType = null;
        state.selectedFormat = EXPORT_FORMATS.EXCEL;
        state.isExporting = false;

        // 恢复单选框默认
        document.querySelectorAll('input[name="exportType"]').forEach(radio => radio.checked = false);
        document.querySelector(`input[value="${EXPORT_FORMATS.EXCEL}"]`).checked = true;

        // 默认设置为上月
        setQuickSelectDate('last-month');

        // 回到第一步
        goToStep(1);

        // 重置进度
        document.querySelector('.export-progress-message').style.display = 'flex';
        document.getElementById('exportProgressIcon').textContent = 'hourglass_empty';
        document.getElementById('exportProgressMsg').textContent = '准备导出...';
        document.getElementById('exportProgressMsg').parentElement.className = 'export-progress-message';
        document.getElementById('exportProgressFill').style.width = '0%';
        document.getElementById('exportProgressPercent').textContent = '0%';

        const details = document.getElementById('exportProgressDetails');
        details.innerHTML = '';
        details.style.display = 'none';

        updateConfigSummary();
    }

    /**
     * 显示对话框
     */
    function show() {
        init();
        resetState(); // 每次打开重置状态
        dialogElement.style.display = 'flex';
        modalOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    /**
     * 打开对话框
     */
    function open() {
        show(); // 调用新的 show 函数来处理初始化和状态重置
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
        retryExport,
        isOpen: () => state.isOpen,
        // 公开 applyDatePreset，供页面其它脚本调用以同步预设
        applyPreset: (preset) => {
            // ensure dialog created
            try { init(); } catch (_) { }
            try { applyDatePreset(preset); } catch (e) { console.warn('applyPreset failed', e); }
        }
    };
})();
