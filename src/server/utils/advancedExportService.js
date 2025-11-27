/**
 * 高级数据导出处理模块
 * 支持：
 * 1. 老师信息数据
 * 2. 学生信息数据
 * 3. 指定时间段的老师排课记录
 * 4. 指定时间段的学生排课记录
 */

class AdvancedExportService {
    constructor(db) {
        this.db = db;
        this.MAX_RECORDS = 50000;
        this.MAX_DATE_RANGE = 365; // 天
    }

    /**
     * 导出类型配置
     */
    static EXPORT_TYPES = {
        TEACHER_INFO: 'teacher_info',
        STUDENT_INFO: 'student_info',
        TEACHER_SCHEDULE: 'teacher_schedule',
        STUDENT_SCHEDULE: 'student_schedule'
    };

    /**
     * 列映射配置（用于 CSV/Excel 列名）
     */
    static COLUMN_CONFIG = {
        teacher_info: [
            { key: 'id', header: '教师ID', width: 12 },
            { key: 'username', header: '用户名', width: 15 },
            { key: 'name', header: '姓名', width: 12 },
            { key: 'profession', header: '职业', width: 15 },
            { key: 'contact', header: '联系方式', width: 15 },
            { key: 'work_location', header: '工作地点', width: 20 },
            { key: 'home_address', header: '家庭地址', width: 25 },
            { key: 'last_login', header: '最后登录', width: 18 },
            { key: 'created_at', header: '创建时间', width: 18 },
            { key: 'total_schedules', header: '总排课数', width: 10 },
            { key: 'confirmed_schedules', header: '已确认', width: 10 },
            { key: 'pending_schedules', header: '待确认', width: 10 },
            { key: 'completion_rate', header: '完成率', width: 10 }
        ],
        student_info: [
            { key: 'id', header: '学生ID', width: 12 },
            { key: 'username', header: '用户名', width: 15 },
            { key: 'name', header: '姓名', width: 12 },
            { key: 'profession', header: '职业', width: 15 },
            { key: 'contact', header: '联系方式', width: 15 },
            { key: 'visit_location', header: '探访地点', width: 20 },
            { key: 'home_address', header: '家庭地址', width: 25 },
            { key: 'last_login', header: '最后登录', width: 18 },
            { key: 'created_at', header: '创建时间', width: 18 },
            { key: 'total_schedules', header: '总排课数', width: 10 },
            { key: 'confirmed_schedules', header: '已确认', width: 10 },
            { key: 'pending_schedules', header: '待确认', width: 10 },
            { key: 'participation_rate', header: '参课率', width: 10 }
        ],
        teacher_schedule: [
            { key: 'schedule_id', header: '排课ID', width: 12 },
            { key: 'teacher_id', header: '教师ID', width: 12 },
            { key: 'teacher_name', header: '教师名称', width: 15 },
            { key: 'student_id', header: '学生ID', width: 12 },
            { key: 'student_name', header: '学生名称', width: 15 },
            { key: 'date', header: '日期', width: 15 },
            { key: 'time', header: '时间', width: 15 },
            { key: 'location', header: '地点', width: 20 },
            { key: 'type', header: '类型', width: 12 },
            { key: 'status', header: '状态', width: 12 },
            { key: 'notes', header: '备注', width: 25 },
            { key: 'created_at', header: '创建时间', width: 18 }
        ],
        student_schedule: [
            { key: 'schedule_id', header: '排课ID', width: 12 },
            { key: 'student_id', header: '学生ID', width: 12 },
            { key: 'student_name', header: '学生名称', width: 15 },
            { key: 'teacher_id', header: '教师ID', width: 12 },
            { key: 'teacher_name', header: '教师名称', width: 15 },
            { key: 'date', header: '日期', width: 15 },
            { key: 'time', header: '时间', width: 15 },
            { key: 'location', header: '地点', width: 20 },
            { key: 'type', header: '类型', width: 12 },
            { key: 'status', header: '状态', width: 12 },
            { key: 'notes', header: '备注', width: 25 },
            { key: 'created_at', header: '创建时间', width: 18 }
        ]
    };

    /**
     * 验证导出类型
     */
    validateExportType(type) {
        if (!Object.values(AdvancedExportService.EXPORT_TYPES).includes(type)) {
            throw new Error('无效的导出类型');
        }
    }

    /**
     * 验证文件格式
     */
    validateFormat(format) {
        if (!['excel', 'csv'].includes(format)) {
            throw new Error('不支持的文件格式');
        }
    }

    /**
     * 验证日期范围
     */
    validateDateRange(startDate, endDate) {
        if (!startDate || !endDate) {
            throw new Error('开始日期和结束日期不能为空');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error('日期格式无效');
        }

        if (start > end) {
            throw new Error('开始日期不能晚于结束日期');
        }

        const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        if (daysDiff > this.MAX_DATE_RANGE) {
            throw new Error(`日期范围不能超过 ${this.MAX_DATE_RANGE} 天`);
        }
    }

    /**
     * 验证数据量
     */
    validateDataSize(count) {
        if (count > this.MAX_RECORDS) {
            const error = new Error(`导出数据量超过限制 (${count}/${this.MAX_RECORDS})`);
            error.status = 413;
            throw error;
        }
    }

    /**
     * 脱敏处理
     */
    sanitizeValue(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // 移除危险的脚本标签和事件处理器
        return str
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    /**
     * 获取日期表达式（兼容多种日期列名）
     */
    async getDateExpression() {
        try {
            const result = await this.db.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_arrangement'
                AND column_name IN ('arr_date', 'class_date', 'date')
                ORDER BY column_name DESC
            `);
            
            const columns = (result.rows || []).map(r => r.column_name);
            
            if (columns.length === 0) {
                throw new Error('course_arrangement 表中找不到日期列');
            }
            
            // 使用 COALESCE 或单列，优先级：arr_date > class_date > date
            if (columns.length === 1) {
                return `ca.${columns[0]}`;
            }
            
            const parts = [];
            ['arr_date', 'class_date', 'date'].forEach(col => {
                if (columns.includes(col)) parts.push(`ca.${col}`);
            });
            
            return parts.length > 1 ? `COALESCE(${parts.join(', ')})` : parts[0];
        } catch (error) {
            console.error('获取日期表达式失败:', error);
            // 降级方案：使用最常见的列
            return 'ca.class_date';
        }
    }

    /**
     * 导出教师信息
     */
    async exportTeacherInfo() {
        const query = `
            SELECT 
                t.id,
                t.username,
                t.name,
                t.profession,
                t.contact,
                t.work_location,
                t.home_address,
                t.last_login,
                t.created_at,
                COALESCE(COUNT(ca.id), 0) as total_schedules,
                COALESCE(SUM(CASE WHEN ca.status = 'confirmed' THEN 1 ELSE 0 END), 0) as confirmed_schedules,
                COALESCE(SUM(CASE WHEN ca.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_schedules
            FROM teachers t
            LEFT JOIN course_arrangement ca ON t.id = ca.teacher_id
            GROUP BY t.id, t.username, t.name, t.profession, t.contact, 
                     t.work_location, t.home_address, t.last_login, t.created_at
            ORDER BY t.created_at DESC
        `;

        const result = await this.db.query(query);
        const rows = result.rows || [];

        // 验证数据量
        this.validateDataSize(rows.length);

        // 数据转换
        return rows.map(row => ({
            ...row,
            completion_rate: row.total_schedules > 0 
                ? ((row.confirmed_schedules / row.total_schedules) * 100).toFixed(2) + '%'
                : '0%',
            created_at: this.formatDateTime(row.created_at),
            last_login: this.formatDateTime(row.last_login)
        }));
    }

    /**
     * 导出学生信息
     */
    async exportStudentInfo() {
        const query = `
            SELECT 
                s.id,
                s.username,
                s.name,
                s.profession,
                s.contact,
                s.visit_location,
                s.home_address,
                s.last_login,
                s.created_at,
                COALESCE(COUNT(ca.id), 0) as total_schedules,
                COALESCE(SUM(CASE WHEN ca.status = 'confirmed' THEN 1 ELSE 0 END), 0) as confirmed_schedules,
                COALESCE(SUM(CASE WHEN ca.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_schedules
            FROM students s
            LEFT JOIN course_arrangement ca ON s.id = ca.student_id
            GROUP BY s.id, s.username, s.name, s.profession, s.contact, 
                     s.visit_location, s.home_address, s.last_login, s.created_at
            ORDER BY s.created_at DESC
        `;

        const result = await this.db.query(query);
        const rows = result.rows || [];

        // 验证数据量
        this.validateDataSize(rows.length);

        // 数据转换
        return rows.map(row => ({
            ...row,
            participation_rate: row.total_schedules > 0 
                ? ((row.confirmed_schedules / row.total_schedules) * 100).toFixed(2) + '%'
                : '0%',
            created_at: this.formatDateTime(row.created_at),
            last_login: this.formatDateTime(row.last_login)
        }));
    }

    /**
     * 导出指定时间段的教师排课记录
     */
    async exportTeacherSchedule(startDate, endDate) {
        this.validateDateRange(startDate, endDate);

        // 获取动态日期表达式
        const dateExpr = await this.getDateExpression();

        const query = `
            SELECT 
                ca.id as schedule_id,
                t.id as teacher_id,
                t.name as teacher_name,
                s.id as student_id,
                s.name as student_name,
                ${dateExpr}::date as date,
                TO_CHAR(${dateExpr}, 'HH24:MI') as time,
                ca.location,
                st.name as type,
                ca.status,
                ca.teacher_comment as notes,
                ca.created_at
            FROM course_arrangement ca
            JOIN teachers t ON ca.teacher_id = t.id
            JOIN students s ON ca.student_id = s.id
            LEFT JOIN schedule_types st ON ca.course_id = st.id
            WHERE ${dateExpr}::date BETWEEN $1 AND $2
            ORDER BY ${dateExpr} DESC
        `;

        const result = await this.db.query(query, [startDate, endDate]);
        const rows = result.rows || [];

        // 验证数据量
        this.validateDataSize(rows.length);

        // 数据转换和脱敏
        return rows.map(row => ({
            schedule_id: row.schedule_id,
            teacher_id: row.teacher_id,
            teacher_name: this.sanitizeValue(row.teacher_name),
            student_id: row.student_id,
            student_name: this.sanitizeValue(row.student_name),
            date: row.date,
            time: row.time,
            location: this.sanitizeValue(row.location),
            type: this.sanitizeValue(row.type),
            status: row.status,
            notes: this.sanitizeValue(row.notes),
            created_at: this.formatDateTime(row.created_at)
        }));
    }

    /**
     * 导出指定时间段的学生排课记录
     */
    async exportStudentSchedule(startDate, endDate) {
        this.validateDateRange(startDate, endDate);

        // 获取动态日期表达式
        const dateExpr = await this.getDateExpression();

        const query = `
            SELECT 
                ca.id as schedule_id,
                s.id as student_id,
                s.name as student_name,
                t.id as teacher_id,
                t.name as teacher_name,
                ${dateExpr}::date as date,
                TO_CHAR(${dateExpr}, 'HH24:MI') as time,
                ca.location,
                st.name as type,
                ca.status,
                ca.student_comment as notes,
                ca.created_at
            FROM course_arrangement ca
            JOIN students s ON ca.student_id = s.id
            JOIN teachers t ON ca.teacher_id = t.id
            LEFT JOIN schedule_types st ON ca.course_id = st.id
            WHERE ${dateExpr}::date BETWEEN $1 AND $2
            ORDER BY ${dateExpr} DESC
        `;

        const result = await this.db.query(query, [startDate, endDate]);
        const rows = result.rows || [];

        // 验证数据量
        this.validateDataSize(rows.length);

        // 数据转换和脱敏
        return rows.map(row => ({
            schedule_id: row.schedule_id,
            student_id: row.student_id,
            student_name: this.sanitizeValue(row.student_name),
            teacher_id: row.teacher_id,
            teacher_name: this.sanitizeValue(row.teacher_name),
            date: row.date,
            time: row.time,
            location: this.sanitizeValue(row.location),
            type: this.sanitizeValue(row.type),
            status: row.status,
            notes: this.sanitizeValue(row.notes),
            created_at: this.formatDateTime(row.created_at)
        }));
    }

    /**
     * 将数据转换为 Excel 格式的列数组
     */
    toExcelFormat(data, type) {
        const config = AdvancedExportService.COLUMN_CONFIG[type];
        if (!config) throw new Error('不支持的导出类型配置');

        return data.map(row => {
            const excelRow = {};
            config.forEach(col => {
                excelRow[col.header] = row[col.key] !== undefined ? row[col.key] : '';
            });
            return excelRow;
        });
    }

    /**
     * 获取 Excel 列宽配置
     */
    getExcelColumnWidths(type) {
        const config = AdvancedExportService.COLUMN_CONFIG[type];
        return config.map(col => ({ wch: col.width }));
    }

    /**
     * 将数据转换为 CSV 格式
     */
    toCsvFormat(data, type) {
        const config = AdvancedExportService.COLUMN_CONFIG[type];
        if (!config) throw new Error('不支持的导出类型配置');

        const headers = config.map(col => col.header);
        const rows = data.map(row =>
            config.map(col => {
                const value = row[col.key];
                if (value === null || value === undefined) return '';
                // CSV 转义：双引号和换行符
                const strValue = String(value);
                if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                    return `"${strValue.replace(/"/g, '""')}"`;
                }
                return strValue;
            }).join(',')
        );

        return [
            headers.join(','),
            ...rows
        ].join('\n');
    }

    /**
     * 格式化日期时间
     */
    formatDateTime(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        } catch {
            return dateStr;
        }
    }

    /**
     * 执行导出
     */
    async execute(type, format, startDate, endDate) {
        // 验证参数
        this.validateExportType(type);
        this.validateFormat(format);

        let data;

        // 获取数据
        switch (type) {
            case AdvancedExportService.EXPORT_TYPES.TEACHER_INFO:
                data = await this.exportTeacherInfo();
                break;
            case AdvancedExportService.EXPORT_TYPES.STUDENT_INFO:
                data = await this.exportStudentInfo();
                break;
            case AdvancedExportService.EXPORT_TYPES.TEACHER_SCHEDULE:
                data = await this.exportTeacherSchedule(startDate, endDate);
                break;
            case AdvancedExportService.EXPORT_TYPES.STUDENT_SCHEDULE:
                data = await this.exportStudentSchedule(startDate, endDate);
                break;
            default:
                throw new Error('未知的导出类型');
        }

        // 格式化数据
        if (format === 'excel') {
            return {
                format: 'excel',
                data: this.toExcelFormat(data, type),
                columns: this.getExcelColumnWidths(type),
                filename: `${this.getExportFilename(type)}.xlsx`
            };
        } else {
            return {
                format: 'csv',
                data: this.toCsvFormat(data, type),
                filename: `${this.getExportFilename(type)}.csv`
            };
        }
    }

    /**
     * 获取导出文件名
     */
    getExportFilename(type) {
        const now = new Date().toISOString().split('T')[0];
        const typeNames = {
            [AdvancedExportService.EXPORT_TYPES.TEACHER_INFO]: `教师信息_${now}`,
            [AdvancedExportService.EXPORT_TYPES.STUDENT_INFO]: `学生信息_${now}`,
            [AdvancedExportService.EXPORT_TYPES.TEACHER_SCHEDULE]: `教师排课记录_${now}`,
            [AdvancedExportService.EXPORT_TYPES.STUDENT_SCHEDULE]: `学生排课记录_${now}`
        };
        return typeNames[type] || '导出数据';
    }
}

module.exports = AdvancedExportService;
