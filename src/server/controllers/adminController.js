/**
 * 管理员控制器
 * @description 处理管理员端的用户管理、排课管理、统计和数据导出等操作
 */

const db = require('../db/db');
const bcrypt = require('bcrypt');
const { standardResponse } = require('../middleware/validation');
const { recordAudit } = require('../middleware/audit');
const ExportUtils = require('../utils/exportUtils');
const AdvancedExportService = require('../utils/advancedExportService');
const ExportLogService = require('../utils/exportLogService');

const adminController = {
    /**
     * 获取用户列表
     * @description 根据用户类型返回对应的用户列表（管理员/教师/学生）
     * @param {string} req.params.userType - 用户类型
     */
    async getUsers(req, res) {
        try {
            const { userType } = req.params;
            let table;
            let selectColumns;

            switch (userType) {
                case 'admin':
                    table = 'administrators';
                    // administrators 表包含权限级别和邮箱
                    selectColumns = 'id, username, name, email, permission_level, last_login, created_at';
                    break;
                case 'teacher':
                    table = 'teachers';
                    selectColumns = 'id, username, name, profession, contact, work_location, home_address, last_login, created_at';
                    break;
                case 'student':
                    table = 'students';
                    selectColumns = 'id, username, name, profession, contact, visit_location, home_address, last_login, created_at';
                    break;
                default:
                    return res.status(400).json({ message: '无效的用户类型' });
            }

            // 若存在 status 列，则动态追加到返回字段
            try {
                if (table === 'teachers' || table === 'students') {
                    const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='status'`);
                    if ((cols.rows || []).length > 0) {
                        selectColumns = selectColumns.replace('last_login, created_at', 'status, last_login, created_at');
                    }
                }
            } catch (_) { }

            // 开发离线模式：返回示例数据以便预览UI
            if (process.env.OFFLINE_DEV === 'true') {
                const now = new Date();
                if (userType === 'admin') {
                    return res.json([
                        { id: 1, username: 'admin', name: '系统管理员', permission_level: 1, last_login: now, created_at: now }
                    ]);
                }
                if (userType === 'teacher') {
                    return res.json([
                        { id: 101, username: 'teach1', name: '张老师', profession: '数学', contact: '13800138001', work_location: '一号校区', home_address: '海淀区', last_login: now, created_at: now }
                    ]);
                }
                if (userType === 'student') {
                    return res.json([
                        { id: 201, username: 'stu1', name: '李同学', profession: '一年级', contact: '13900139001', visit_location: '家访点A', home_address: '朝阳区', last_login: now, created_at: now }
                    ]);
                }
            }

            const result = await db.query(
                `SELECT ${selectColumns} FROM ${table} ORDER BY created_at DESC`
            );

            const rows = (result && result.rows) ? result.rows : (Array.isArray(result) ? result : []);
            res.json(standardResponse(true, rows, '获取用户列表成功'));
        } catch (error) {
            console.error('获取用户列表错误:', error);
            res.status(500).json(standardResponse(false, null, '获取用户列表失败'));
        }
    },

    /**
     * 获取单个用户详情
     * @description 根据用户类型和ID返回用户详情
     * @param {string} req.params.userType - 用户类型
     * @param {string} req.params.id - 用户ID
     */
    async getUserById(req, res) {
        try {
            const { userType, id } = req.params;
            let table;
            let selectColumns;
            switch (userType) {
                case 'admin':
                    table = 'administrators';
                    selectColumns = 'id, username, name, email, permission_level, last_login, created_at';
                    break;
                case 'teacher':
                    table = 'teachers';
                    selectColumns = 'id, username, name, profession, contact, work_location, home_address, last_login, created_at';
                    break;
                case 'student':
                    table = 'students';
                    selectColumns = 'id, username, name, profession, contact, visit_location, home_address, last_login, created_at';
                    break;
                default:
                    return res.status(400).json(standardResponse(false, null, '无效的用户类型'));
            }

            // 若存在 status 列，则动态追加到返回字段
            try {
                if (table === 'teachers' || table === 'students') {
                    const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='status'`);
                    if ((cols.rows || []).length > 0) {
                        selectColumns = selectColumns.replace('last_login, created_at', 'status, last_login, created_at');
                    }
                }
            } catch (_) { }

            if (process.env.OFFLINE_DEV === 'true') {
                const now = new Date();
                const mock = { id: Number(id), username: 'mock', name: '模拟用户', last_login: now, created_at: now };
                return res.json(standardResponse(true, mock, '获取用户成功(离线)'));
            }

            const result = await db.query(`SELECT ${selectColumns} FROM ${table} WHERE id = $1`, [id]);
            const rows = (result && result.rows) ? result.rows : [];
            if (!rows[0]) {
                return res.status(404).json(standardResponse(false, null, '用户不存在'));
            }
            res.json(standardResponse(true, rows[0], '获取用户成功'));
        } catch (error) {
            console.error('获取用户详情错误:', error);
            res.status(500).json(standardResponse(false, null, '服务器错误'));
        }
    },

    async createUser(req, res) {
        try {
            const { userType, username, password, name, email, ...additionalInfo } = req.body;
            let table;

            switch (userType) {
                case 'admin':
                    table = 'administrators';
                    break;
                case 'teacher':
                    table = 'teachers';
                    break;
                case 'student':
                    table = 'students';
                    break;
                default:
                    return res.status(400).json({ message: '无效的用户类型' });
            }

            // 开发离线模式：直接返回模拟创建结果
            if (process.env.OFFLINE_DEV === 'true') {
                return res.status(201).json({ id: Date.now(), username, name, email, ...additionalInfo });
            }

            // 基础字段校验
            if (!username || !password || !name) {
                return res.status(400).json({ message: '缺少必要字段：username, password, name' });
            }

            // 管理员必须提供合法的权限级别(1-3)与合法邮箱
            if (userType === 'admin') {
                const lvl = parseInt(additionalInfo.permission_level, 10);
                if (!Number.isInteger(lvl) || lvl < 1 || lvl > 3) {
                    return res.status(400).json({ message: '权限级别必须在1到3之间' });
                }
                additionalInfo.permission_level = lvl;
                if (!email) {
                    return res.status(400).json({ message: '管理员必须提供 email' });
                }
                const emailRe = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i;
                if (!emailRe.test(email)) {
                    return res.status(400).json({ message: '邮箱格式不合法' });
                }
            }

            // 仅允许写入合法字段，避免前端携带无效字段导致 SQL 错误
            const allowedAdditionalByType = {
                admin: ['permission_level'],
                teacher: ['profession', 'contact', 'work_location', 'home_address', 'status'],
                student: ['profession', 'contact', 'visit_location', 'home_address', 'status']
            };
            const allowedAdditional = allowedAdditionalByType[userType] || [];
            const filteredAdditional = Object.fromEntries(
                Object.entries(additionalInfo).filter(([key]) => allowedAdditional.includes(key))
            );

            // 若教师/学生表不存在 status 列，则忽略该字段，防止 SQL 错误
            try {
                if ((userType === 'teacher' || userType === 'student') && Object.prototype.hasOwnProperty.call(filteredAdditional, 'status')) {
                    const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='status'`);
                    const hasStatus = (cols.rows || []).length > 0;
                    if (!hasStatus) {
                        delete filteredAdditional.status;
                    }
                }
            } catch (_) { /* 静默处理探测错误 */ }

            // 检查用户名是否已存在
            const existingUser = await db.query(
                `SELECT id FROM ${table} WHERE username = $1`,
                [username]
            );

            const existingRows = (existingUser && existingUser.rows) ? existingUser.rows : (Array.isArray(existingUser) ? existingUser : []);
            if (existingRows.length > 0) {
                return res.status(400).json({ message: '用户名已存在' });
            }

            // 在事务中创建用户，确保插入与审计原子性
            await db.runInTransaction(async (client, usePool) => {
                // 加密密码
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(password, salt);

                // 构建插入语句
                let columns = ['username', 'password_hash', 'name'];
                let values = [username, passwordHash, name];
                let placeholders = ['$1', '$2', '$3'];
                let currentPlaceholder = 4;

                // 管理员插入必须包含 email
                if (userType === 'admin') {
                    columns.push('email');
                    values.push(email);
                    placeholders.push(`$${currentPlaceholder++}`);
                }

                // 添加额外信息（仅合法字段）
                for (let [key, value] of Object.entries(filteredAdditional)) {
                    columns.push(key);
                    values.push(value);
                    placeholders.push(`$${currentPlaceholder++}`);
                }

                const insertSql = `
                    INSERT INTO ${table} (${columns.join(', ')})
                    VALUES (${placeholders.join(', ')})
                    RETURNING id, username, name, ${userType === 'admin' ? 'email' : 'NULL as email'}
                `;

                const q = usePool ? db.query : client.query.bind(client);
                const result = await q(insertSql, values);
                const rows = (result && result.rows) ? result.rows : (Array.isArray(result) ? result : []);
                // 记录审计（在事务内）
                try { await recordAudit(req, { op: 'create', entityType: userType, entityId: rows[0]?.id, details: { username, name, email } }); } catch (_) { }

                res.status(201).json(standardResponse(true, rows[0], '创建用户成功'));
            });
        } catch (error) {
            console.error('创建用户错误:', error);
            res.status(500).json(standardResponse(false, null, '服务器错误'));
        }
    },

    async updateUser(req, res) {
        try {
            const { userType, id } = req.params;
            const { username, name, email, ...additionalInfo } = req.body;
            let table;

            switch (userType) {
                case 'admin':
                    table = 'administrators';
                    break;
                case 'teacher':
                    table = 'teachers';
                    break;
                case 'student':
                    table = 'students';
                    break;
                default:
                    return res.status(400).json({ message: '无效的用户类型' });
            }

            // 开发离线模式：跳过数据库更新，直接返回成功
            if (process.env.OFFLINE_DEV === 'true') {
                return res.json({ id, username, name, email, ...additionalInfo });
            }

            // 如果更新管理员权限级别，确保合法(1-3)
            if (userType === 'admin' && Object.prototype.hasOwnProperty.call(additionalInfo, 'permission_level')) {
                const lvl = parseInt(additionalInfo.permission_level, 10);
                if (!Number.isInteger(lvl) || lvl < 1 || lvl > 3) {
                    return res.status(400).json({ message: '权限级别必须在1到3之间' });
                }
                additionalInfo.permission_level = lvl;
            }

            // 检查用户是否存在
            const existingUser = await db.query(
                `SELECT id FROM ${table} WHERE id = $1`,
                [id]
            );
            const existingRows = (existingUser && existingUser.rows) ? existingUser.rows : (Array.isArray(existingUser) ? existingUser : []);
            if (existingRows.length === 0) {
                return res.status(404).json({ message: '用户不存在' });
            }

            // 仅允许更新合法字段
            const allowedAdditionalByType = {
                admin: ['permission_level'],
                teacher: ['profession', 'contact', 'work_location', 'home_address', 'status'],
                student: ['profession', 'contact', 'visit_location', 'home_address', 'status']
            };
            const allowedAdditional = allowedAdditionalByType[userType] || [];
            const filteredAdditional = Object.fromEntries(
                Object.entries(additionalInfo).filter(([key]) => allowedAdditional.includes(key))
            );

            // 若教师/学生表不存在 status 列，则忽略该字段，防止 SQL 错误
            try {
                if ((userType === 'teacher' || userType === 'student') && Object.prototype.hasOwnProperty.call(filteredAdditional, 'status')) {
                    const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='status'`);
                    const hasStatus = (cols.rows || []).length > 0;
                    if (!hasStatus) {
                        delete filteredAdditional.status;
                    }
                }
            } catch (_) { /* 静默处理探测错误 */ }

            // 构建更新语句
            let updates = [];
            let values = [];
            let currentPlaceholder = 1;

            if (typeof username !== 'undefined') {
                updates.push(`username = $${currentPlaceholder}`);
                values.push(username);
                currentPlaceholder++;
            }
            if (typeof name !== 'undefined') {
                updates.push(`name = $${currentPlaceholder}`);
                values.push(name);
                currentPlaceholder++;
            }
            if (userType === 'admin' && typeof email !== 'undefined') {
                const emailRe = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i;
                if (!emailRe.test(email)) {
                    return res.status(400).json({ message: '邮箱格式不合法' });
                }
                updates.push(`email = $${currentPlaceholder}`);
                values.push(email);
                currentPlaceholder++;
            }

            for (let [key, value] of Object.entries(filteredAdditional)) {
                updates.push(`${key} = $${currentPlaceholder}`);
                values.push(value);
                currentPlaceholder++;
            }

            if (updates.length === 0) {
                return res.status(400).json({ message: '无更新字段' });
            }

            values.push(id);

            const query = `
                UPDATE ${table}
                SET ${updates.join(', ')}
                WHERE id = $${currentPlaceholder}
                RETURNING id, username, name, ${userType === 'admin' ? 'email' : 'NULL as email'}
            `;

            await db.runInTransaction(async (client, usePool) => {
                const q = usePool ? db.query : client.query.bind(client);
                const result = await q(query, values);
                const rows = (result && result.rows) ? result.rows : (Array.isArray(result) ? result : []);
                if (!rows[0]) {
                    // 通过抛错让 runInTransaction 回滚
                    throw Object.assign(new Error('更新失败'), { statusCode: 500 });
                }
                try { await recordAudit(req, { op: 'update', entityType: userType, entityId: Number(id), details: { username, name, email, ...filteredAdditional } }); } catch (_) { }
                res.json(standardResponse(true, rows[0], '更新用户成功'));
            });
        } catch (error) {
            console.error('更新用户错误:', error);
            res.status(500).json(standardResponse(false, null, '服务器错误'));
        }
    },

    async deleteUser(req, res) {
        try {
            const { userType, id } = req.params;
            const cascade = (req.query && (req.query.cascade === 'true' || req.query.cascade === '1'));
            let table;

            switch (userType) {
                case 'admin':
                    table = 'administrators';
                    break;
                case 'teacher':
                    table = 'teachers';
                    break;
                case 'student':
                    table = 'students';
                    break;
                default:
                    return res.status(400).json({ message: '无效的用户类型' });
            }

            // 离线开发模式：直接返回成功，避免数据库外键约束
            if (process.env.OFFLINE_DEV === 'true') {
                return res.json(standardResponse(true, null, '用户删除成功 (离线模式)'));
            }

            // 对教师/学生删除前进行外键检查，必要时支持级联删除
            if (userType === 'teacher' || userType === 'student') {
                const refCol = userType === 'teacher' ? 'teacher_id' : 'student_id';
                const refCountRes = await db.query(
                    `SELECT COUNT(*)::int AS count FROM course_arrangement WHERE ${refCol} = $1`,
                    [id]
                );
                const refCount = (refCountRes && refCountRes.rows && refCountRes.rows[0] && typeof refCountRes.rows[0].count !== 'undefined')
                    ? refCountRes.rows[0].count
                    : 0;

                if (refCount > 0 && !cascade) {
                    const entityLabel = userType === 'teacher' ? '教师' : '学生';
                    return res.status(409).json(standardResponse(
                        false,
                        { referencedSchedules: refCount },
                        `该${entityLabel}仍有关联的排课（${refCount} 项），请先删除相关排课或使用级联删除`
                    ));
                }

                if (refCount > 0 && cascade) {
                    // 在事务内先删除关联排课，再删除用户
                    await db.runInTransaction(async (client, usePool) => {
                        const q = usePool ? db.query : client.query.bind(client);
                        await q(`DELETE FROM course_arrangement WHERE ${refCol} = $1`, [id]);
                        await q(`DELETE FROM ${table} WHERE id = $1`, [id]);
                        try { await recordAudit(req, { op: 'delete_cascade', entityType: userType, entityId: Number(id), details: { deletedSchedules: refCount } }); } catch (_) { }
                        res.json(standardResponse(true, { deletedSchedules: refCount }, '用户及其关联排课已删除'));
                    });
                    return;
                }
            }

            // 默认删除（管理员或无关联引用）
            await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
            try { await recordAudit(req, { op: 'delete', entityType: userType, entityId: Number(id) }); } catch (_) { }
            res.json(standardResponse(true, null, '用户删除成功'));
        } catch (error) {
            // 外键约束冲突：返回 409 并给出友好提示
            if (error && error.code === '23503') {
                return res.status(409).json(standardResponse(false, null, '删除失败：存在外键引用，请先删除相关排课或选择级联删除'));
            }
            console.error('删除用户错误:', error);
            res.status(500).json(standardResponse(false, null, '服务器错误'));
        }
    },

    /**
     * 获取排课列表
     * @description 根据日期范围和过滤条件返回排课列表
     * @param {string} req.query.startDate - 开始日期
     * @param {string} req.query.endDate - 结束日期
     * @param {string} req.query.status - 状态过滤（可选）
     * @param {string} req.query.type - 类型过滤（可选）
     */
    async getSchedules(req, res) {
        try {
            let { startDate, endDate, status, type } = req.query;
            // 兼容：若未提供日期，则使用极大范围作为默认值（用于测试或前端未传参场景）
            if (!startDate || !endDate) {
                startDate = startDate || '1970-01-01';
                endDate = endDate || '2099-12-31';
            }

            async function getCaDateExpr() {
                if (getCaDateExpr.cache) return getCaDateExpr.cache;
                const r = await db.query(`
                  SELECT column_name FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='course_arrangement'
                    AND column_name IN ('arr_date','class_date','date')
                `);
                const cols = new Set((r.rows || []).map(x => x.column_name));
                const parts = [];
                if (cols.has('arr_date')) parts.push('ca.arr_date');
                if (cols.has('class_date')) parts.push('ca.class_date');
                if (cols.has('date')) parts.push('ca.date');
                const expr = parts.length > 1 ? `COALESCE(${parts.join(', ')})` : (parts[0] || 'CURRENT_DATE');
                getCaDateExpr.cache = expr;
                return expr;
            }

            const dateExpr = await getCaDateExpr();
            const values = [startDate, endDate];

            // 检测 teacher/student 表是否包含 status 字段
            let teacherHasStatus = false, studentHasStatus = false;
            try {
                const tCols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='teachers' AND column_name='status'`);
                const sCols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='status'`);
                teacherHasStatus = (tCols.rows || []).length > 0;
                studentHasStatus = (sCols.rows || []).length > 0;
            } catch (_) { }

            // 基础 SQL：关联教师与学生以便能够按账号状态过滤
            let sql = `
                SELECT ca.id, ${dateExpr} AS date, ca.start_time, ca.end_time, ca.status, ca.teacher_id, ca.student_id, ca.course_id, ca.location
                FROM course_arrangement ca
                JOIN teachers t ON ca.teacher_id = t.id
                JOIN students s ON ca.student_id = s.id
                WHERE ${dateExpr} BETWEEN $1 AND $2
            `;

            if (teacherHasStatus) sql += ` AND t.status = 1`;
            if (studentHasStatus) sql += ` AND s.status = 1`;

            if (status) {
                values.push(status);
                sql += ` AND ca.status = $${values.length}`;
            }
            if (type) {
                values.push(type);
                sql += ` AND ca.course_id = $${values.length}`;
            }

            sql += ` ORDER BY ${dateExpr} ASC, ca.start_time ASC`;

            const result = await db.query(sql, values);
            res.json(result.rows || []);
        } catch (error) {
            console.error('获取排课列表错误:', error);
            const code = error?.sourceError?.code;
            const msg = String(error?.message || '');
            const isNeonTimeout = code === 'UND_ERR_CONNECT_TIMEOUT' || msg.includes('fetch failed') || msg.includes('ETIMEDOUT');
            if (isNeonTimeout) {
                console.warn('获取排课列表时发生网络超时，返回空数组');
                return res.json([]);
            }
            res.status(500).json({ message: '服务器错误' });
        }
    },

    async getScheduleById(req, res) {
        try {
            const { id } = req.params;
            const numId = Number(id);
            if (!Number.isInteger(numId) || numId <= 0) {
                return res.status(400).json({ message: '无效的排课ID' });
            }
            const rCols = await db.query(`
              SELECT column_name FROM information_schema.columns
              WHERE table_schema='public' AND table_name='course_arrangement' AND column_name IN ('arr_date','class_date','date')
            `);
            const cols = new Set((rCols.rows || []).map(x => x.column_name));
            const dateCol = cols.has('arr_date') ? 'arr_date' : (cols.has('class_date') ? 'class_date' : 'date');

            const result = await db.query(
                `SELECT ca.id,
                        ca.teacher_id,
                        ca.student_id,
                        ca.course_id,
                        ca.status,
                        ca.start_time,
                        ca.end_time,
                        ca.location,
                        ca.${dateCol} AS date
                 FROM course_arrangement ca
                 WHERE ca.id = $1`,
                [numId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: '未找到排课记录' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error('获取排课详情错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 网格视图：返回逐条排课记录，供前端按学生×日期进行精准渲染
    async getSchedulesGrid(req, res) {
        try {
            // 离线开发模式：返回示例行，确保前端渲染不被阻塞
            if (process.env.OFFLINE_DEV === 'true') {
                const today = new Date().toISOString().split('T')[0];
                return res.json([
                    { id: 70, student_id: 201, student_name: '李同学', teacher_id: 101, teacher_name: '张老师', schedule_type: '入户', schedule_types: '入户', date: today, start_time: '09:00', end_time: '10:30', location: '第一教室', status: 'confirmed' }
                ]);
            }

            const { start_date, end_date, status, type_id, teacher_id } = req.query;
            if (!start_date || !end_date) {
                return res.status(400).json({ message: '缺少开始/结束日期' });
            }

            // 统一日期列表达式
            const rCols = await db.query(`
              SELECT column_name FROM information_schema.columns
              WHERE table_schema='public' AND table_name='course_arrangement' AND column_name IN ('arr_date','class_date','date')
            `);
            const cset = new Set((rCols.rows || []).map(x => x.column_name));
            const dateExpr = cset.has('arr_date') ? 'ca.arr_date' : (cset.has('class_date') ? 'ca.class_date' : 'ca.date');

            // 动态 teacher/student 状态列过滤
            let teacherHasStatus = false, studentHasStatus = false;
            try {
                const tCols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='teachers' AND column_name='status'`);
                const sCols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='status'`);
                teacherHasStatus = (tCols.rows || []).length > 0;
                studentHasStatus = (sCols.rows || []).length > 0;
            } catch (_) { }

            let sql = `
                SELECT 
                    ca.id,
                    s.id AS student_id,
                    s.name AS student_name,
                    t.id AS teacher_id,
                    t.name AS teacher_name,
                    stt.name AS schedule_type,
                    COALESCE(stt.description, stt.name) AS schedule_types,
                    ${dateExpr} AS date,
                    ca.start_time,
                    ca.end_time,
                    ca.location,
                    ca.status
                FROM course_arrangement ca
                JOIN students s ON ca.student_id = s.id
                JOIN teachers t ON ca.teacher_id = t.id
                JOIN schedule_types stt ON ca.course_id = stt.id
                WHERE ${dateExpr} BETWEEN $1 AND $2
            `;
            const params = [start_date, end_date];

            if (status) {
                sql += ` AND ca.status = $${params.length + 1}`;
                params.push(status);
            }
            if (type_id) {
                sql += ` AND ca.course_id = $${params.length + 1}`;
                params.push(type_id);
            }
            // 过滤删除状态：允许正常与暂停，但不显示删除
            if (teacherHasStatus) sql += ` AND t.status <> -1`;
            if (studentHasStatus) sql += ` AND s.status <> -1`;
            if (teacher_id) {
                sql += ` AND ca.teacher_id = $${params.length + 1}`;
                params.push(teacher_id);
            }

            sql += ` ORDER BY ${dateExpr} ASC, s.id ASC, ca.start_time ASC`;

            const result = await db.query(sql, params);
            const rows = result.rows || [];

            // 数据完整性检查（基本时间有效性）
            const safeRows = rows.map(r => {
                const toMin = (t) => {
                    const m = /^([0-2]?\d):([0-5]\d)$/.exec(String(t || ''));
                    return m ? (Number(m[1]) * 60 + Number(m[2])) : NaN;
                };
                const sv = toMin(r.start_time), ev = toMin(r.end_time);
                const valid = !Number.isNaN(sv) && !Number.isNaN(ev) && ev > sv;
                return { ...r, valid };
            });

            res.json(safeRows);
        } catch (error) {
            console.error('获取网格排课错误:', error);
            const code = error?.sourceError?.code;
            const msg = String(error?.message || '');
            const isNeonTimeout = code === 'UND_ERR_CONNECT_TIMEOUT' || msg.includes('fetch failed') || msg.includes('ETIMEDOUT');
            if (isNeonTimeout) return res.json([]);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    async createSchedule(req, res) {
        try {
            const {
                teacherId,
                date,
                timeSlot,
                startTime,
                endTime,
                studentIds,
                scheduleTypes,
                location,
                status,
                resolve_strategy
            } = req.body;

            // 离线开发模式：直接返回模拟ID，避免数据库操作
            if (process.env.OFFLINE_DEV === 'true') {
                const mockId = Math.floor(100000 + Math.random() * 900000);
                return res.status(201).json({ id: mockId });
            }

            // 使用统一事务封装，支持 pool client 与 serverless 回退
            await db.runInTransaction(async (client, usePool) => {
                const q = usePool ? db.query : client.query.bind(client);

                // 验证教师与学生状态必须为1(正常)
                try {
                    // 仅当存在 status 列时进行状态校验
                    const tCol = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='teachers' AND column_name='status'`);
                    const sCol = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='status'`);
                    const hasTeacherStatus = (tCol.rows || []).length > 0;
                    const hasStudentStatus = (sCol.rows || []).length > 0;
                    if (hasTeacherStatus) {
                        const tRes = await q('SELECT status FROM teachers WHERE id = $1', [teacherId]);
                        if (!tRes.rows.length) throw Object.assign(new Error('教师不存在'), { statusCode: 400 });
                        const tStatus = Number(tRes.rows[0].status);
                        if (tStatus !== 1) throw Object.assign(new Error('教师状态非正常，无法参与排课'), { statusCode: 400 });
                    }
                    const firstStudentId = Array.isArray(studentIds) ? studentIds[0] : studentIds;
                    if (hasStudentStatus && firstStudentId != null) {
                        const sRes = await q('SELECT status FROM students WHERE id = $1', [firstStudentId]);
                        if (!sRes.rows.length) throw Object.assign(new Error('学生不存在'), { statusCode: 400 });
                        const sStatus = Number(sRes.rows[0].status);
                        if (sStatus !== 1) throw Object.assign(new Error('学生状态非正常，无法参与排课'), { statusCode: 400 });
                    }
                } catch (stErr) {
                    console.error('状态校验错误:', stErr);
                    throw stErr;
                }

                // 适配新结构：每条 course_arrangement 代表一个学生的具体安排
                const firstStudentId = Array.isArray(studentIds) ? studentIds[0] : studentIds;
                const firstTypeId = Array.isArray(scheduleTypes) ? scheduleTypes[0] : scheduleTypes;

                // 兼容不同日期列存在性
                const rCols = await db.query(`
              SELECT column_name FROM information_schema.columns
              WHERE table_schema='public' AND table_name='course_arrangement' AND column_name IN ('arr_date','class_date','date')
            `);
                const cols = new Set((rCols.rows || []).map(x => x.column_name));
                const dateCol = cols.has('arr_date') ? 'arr_date' : (cols.has('class_date') ? 'class_date' : 'date');
                // 基础验证：时间格式与先后关系
                function toMinutes(t) {
                    const m = /^([0-2]?\d):([0-5]\d)$/.exec(String(t || ''));
                    if (!m) return NaN;
                    return Number(m[1]) * 60 + Number(m[2]);
                }
                const sMin = toMinutes(startTime);
                const eMin = toMinutes(endTime);
                if (isNaN(sMin) || isNaN(eMin)) {
                    throw Object.assign(new Error('开始/结束时间格式不正确（HH:MM）'), { statusCode: 400, payload: { errors: [{ field: 'time', message: '开始/结束时间格式不正确（HH:MM）' }] } });
                }
                if (eMin <= sMin) {
                    throw Object.assign(new Error('结束时间必须晚于开始时间'), { statusCode: 400, payload: { errors: [{ field: 'time', message: '结束时间必须晚于开始时间' }] } });
                }

                // 允许完全重复：不进行重复检测（同一教师/学生/日期/时间段也允许保留多条）

                // 冲突检测移除：允许教师同一时间段存在多条排课
                const overlapPredicate = `NOT (end_time <= $3 OR start_time >= $4)`;
                // 学生冲突（如提供）
                // 学生重叠允许：不阻断创建，满足同一时间段同一学生可存在多条记录的需求
                // 地点冲突移除：允许地点同一时间段存在多条排课

                // 按传入状态写入，默认 pending，且限制为四种合法状态
                const allowedStatuses = new Set(['pending', 'confirmed', 'cancelled', 'completed']);
                const nextStatus = allowedStatuses.has(String(status || '').trim()) ? String(status).trim() : 'pending';
                const insertSql = `INSERT INTO course_arrangement (teacher_id, student_id, course_id, ${dateCol}, start_time, end_time, status, location, created_by)
                               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                               RETURNING id`;
                const insertResult = await q(
                    insertSql,
                    [teacherId, firstStudentId, firstTypeId, date, startTime, endTime, nextStatus, location || null, req.user.id]
                );

                // 返回响应（在事务内部返回，在 runInTransaction 结束时会自动 COMMIT）
                res.status(201).json({ id: insertResult.rows[0].id, skipped_students: Array.isArray(studentIds) ? Math.max(0, studentIds.length - 1) : 0 });
            });
        } catch (error) {
            console.error('创建排课错误:', error);
            // 友好错误映射
            const msg = String(error?.message || '');
            if (error.code === '23503') { // foreign_key_violation
                return res.status(400).json({
                    message: '外键约束冲突',
                    errors: [{ field: 'fk', message: '教师/学生/类型不存在或已被删除' }]
                });
            } else if (error.code === '23514') { // check_violation
                return res.status(400).json({
                    message: '检查约束冲突',
                    errors: [{ field: 'check', message: '不符合数据库检查约束' }]
                });
            }
            // 结构化错误（由事务内抛出）支持携带 statusCode / payload
            if (error.statusCode && Number(error.statusCode) >= 400 && Number(error.statusCode) < 600) {
                const status = Number(error.statusCode);
                const payload = error.payload || {};
                return res.status(status).json(Object.assign({ message: error.message }, payload));
            }
            return res.status(500).json({
                message: '服务器错误',
                code: error.code || 'UNKNOWN_ERROR',
                errors: [{ field: 'db', message: error.message || '数据库错误' }]
            });
        }
    },

    async updateSchedule(req, res) {
        try {
            const { id } = req.params;
            // 使用 snake_case 字段以匹配验证规则
            const {
                teacher_id,
                date,
                start_time,
                end_time,
                student_ids,
                type_ids,
                status,
                location
            } = req.body;

            // 将更新逻辑放入事务中，确保读取-验证-更新在同一连接上执行
            await db.runInTransaction(async (client, usePool) => {
                const q = usePool ? db.query : client.query.bind(client);

                // 兼容不同日期列存在性
                const rCols = await q(`
                  SELECT column_name FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='course_arrangement' AND column_name IN ('arr_date','class_date','date')
                `);
                const cols = new Set((rCols.rows || []).map(x => x.column_name));
                const dateCol = cols.has('arr_date') ? 'arr_date' : (cols.has('class_date') ? 'class_date' : 'date');

                // 读取当前记录，便于缺省字段沿用现值并做冲突校验
                const currentRes = await q(`
                  SELECT id, teacher_id, student_id, course_id, ${dateCol} AS date, start_time, end_time, location
                  FROM course_arrangement WHERE id = $1
                `, [id]);
                if (currentRes.rows.length === 0) {
                    throw Object.assign(new Error('排课不存在'), { statusCode: 404 });
                }
                const current = currentRes.rows[0];

                // 适配并计算生效更新值
                const nextStudentId = Array.isArray(student_ids) ? student_ids[0] : student_ids;
                const nextTypeId = Array.isArray(type_ids) ? type_ids[0] : type_ids;
                const effTeacherId = (teacher_id != null) ? teacher_id : current.teacher_id;
                const effStudentId = (nextStudentId != null) ? nextStudentId : current.student_id;
                const effTypeId = (nextTypeId != null) ? nextTypeId : current.course_id;
                const effDate = (date != null && date !== '') ? date : current.date;
                const effStart = (start_time != null && start_time !== '') ? start_time : current.start_time;
                const effEnd = (end_time != null && end_time !== '') ? end_time : current.end_time;
                const effLocation = (location !== undefined) ? (location || null) : current.location;

                // 验证教师与学生状态
                try {
                    const tCol = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='teachers' AND column_name='status'`);
                    const sCol = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='status'`);
                    const hasTeacherStatus = (tCol.rows || []).length > 0;
                    const hasStudentStatus = (sCol.rows || []).length > 0;
                    if (hasTeacherStatus) {
                        const tRes = await q('SELECT status FROM teachers WHERE id = $1', [effTeacherId]);
                        if (!tRes.rows.length) throw Object.assign(new Error('教师不存在'), { statusCode: 400 });
                        if (Number(tRes.rows[0].status) !== 1) throw Object.assign(new Error('教师状态非正常，无法参与排课'), { statusCode: 400 });
                    }
                    if (hasStudentStatus) {
                        const sRes = await q('SELECT status FROM students WHERE id = $1', [effStudentId]);
                        if (!sRes.rows.length) throw Object.assign(new Error('学生不存在'), { statusCode: 400 });
                        if (Number(sRes.rows[0].status) !== 1) throw Object.assign(new Error('学生状态非正常，无法参与排课'), { statusCode: 400 });
                    }
                } catch (stErr) {
                    console.error('状态校验错误:', stErr);
                    throw stErr;
                }

                // 时间格式校验
                function toMinutes(t) {
                    const m = /^([0-2]?\d):([0-5]\d)$/.exec(String(t || ''));
                    if (!m) return NaN;
                    return Number(m[1]) * 60 + Number(m[2]);
                }
                const sMin = toMinutes(effStart);
                const eMin = toMinutes(effEnd);
                if (isNaN(sMin) || isNaN(eMin)) throw Object.assign(new Error('开始/结束时间格式不正确（HH:MM）'), { statusCode: 400, payload: { errors: [{ field: 'time', message: '开始/结束时间格式不正确（HH:MM）' }] } });
                if (eMin <= sMin) throw Object.assign(new Error('结束时间必须晚于开始时间'), { statusCode: 400, payload: { errors: [{ field: 'time', message: '结束时间必须晚于开始时间' }] } });

                // 构建动态 UPDATE 语句
                const sets = [];
                const values = [];
                let vi = 1;
                if (teacher_id != null) { sets.push(`teacher_id = $${vi++}`); values.push(teacher_id); }
                if (date != null) { sets.push(`${dateCol} = $${vi++}`); values.push(date); }
                if (start_time != null) { sets.push(`start_time = $${vi++}`); values.push(start_time); }
                if (end_time != null) { sets.push(`end_time = $${vi++}`); values.push(end_time); }
                if (status != null) { sets.push(`status = $${vi++}`); values.push(status); }
                if (nextStudentId != null) { sets.push(`student_id = $${vi++}`); values.push(nextStudentId); }
                if (nextTypeId != null) { sets.push(`course_id = $${vi++}`); values.push(nextTypeId); }
                if (location !== undefined) { sets.push(`location = $${vi++}`); values.push(location || null); }

                if (sets.length === 0) throw Object.assign(new Error('无更新字段'), { statusCode: 400 });

                const sql = `UPDATE course_arrangement SET ${sets.join(', ')} WHERE id = $${vi}`;
                values.push(id);
                await q(sql, values);

                res.json({ message: '排课更新成功' });
            });
        } catch (error) {
            console.error('更新排课错误:', error);
            // 友好错误映射
            let mapped = { message: '服务器错误', code: error.code || 'UNKNOWN_ERROR', errors: [] };
            if (error.code === '23505') { // unique_violation
                mapped.message = '数据唯一性约束冲突';
                mapped.errors = [{ field: 'unique', message: '相同教师/学生/时间段的排课已存在' }];
            } else if (error.code === '23503') { // foreign_key_violation
                mapped.message = '外键约束冲突';
                mapped.errors = [{ field: 'fk', message: '教师/学生/类型不存在或已被删除' }];
            } else if (error.code === '23514') { // check_violation
                mapped.message = '检查约束冲突';
                mapped.errors = [{ field: 'check', message: '不符合数据库检查约束' }];
            } else if (error.message) {
                mapped.errors = [{ field: 'db', message: error.message }];
            }
            res.status(500).json(mapped);
        }
    },

    async deleteSchedule(req, res) {
        try {
            const { id } = req.params;

            await db.runInTransaction(async (client, usePool) => {
                const q = usePool ? db.query : client.query.bind(client);
                await q('DELETE FROM course_arrangement WHERE id = $1', [id]);
                res.json({ message: '排课删除成功' });
            });
        } catch (error) {
            console.error('删除排课错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    async confirmSchedule(req, res) {
        try {
            const { id } = req.params;
            const { adminConfirmed } = req.body;

            // 离线开发模式：跳过数据库操作，直接返回成功，避免外键约束错误
            if (process.env.OFFLINE_DEV === 'true') {
                return res.json({ message: '离线开发模式下已确认（模拟）' });
            }

            // 适配新结构：更新 course_arrangement 状态，并维护更新时间
            // 注意：数据库schema中不包含notes字段，避免引用不存在的列
            await db.query(
                `UPDATE course_arrangement 
                 SET status = CASE WHEN $2 THEN 'confirmed' ELSE status END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [id, !!adminConfirmed]
            );

            res.json({ message: '课程确认状态更新成功' });
        } catch (error) {
            console.error('确认课程错误:', error);
            res.status(500).json({
                message: '服务器错误',
                code: error.code || 'UNKNOWN_ERROR',
                errors: [{ field: 'db', message: error.message || '数据库错误' }]
            });
        }
    },

    /**
     * 获取总览统计
     * @description 返回系统总览数据：教师/学生数量、排课统计等
     */
    async getOverviewStats(req, res) {
        try {
            async function getCaDateExpr() {
                if (getCaDateExpr.cache) return getCaDateExpr.cache;
                const r = await db.query(`
                  SELECT column_name FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='course_arrangement'
                    AND column_name IN ('arr_date','class_date','date')
                `);
                const cols = new Set((r.rows || []).map(x => x.column_name));
                const parts = [];
                if (cols.has('arr_date')) parts.push('arr_date');
                if (cols.has('class_date')) parts.push('class_date');
                if (cols.has('date')) parts.push('date');
                const expr = parts.length > 1 ? `COALESCE(${parts.join(', ')})` : (parts[0] || 'CURRENT_DATE');
                getCaDateExpr.cache = expr;
                return expr;
            }
            // 开发离线模式：返回示例统计数据
            if (process.env.OFFLINE_DEV === 'true') {
                return res.json({
                    teacher_count: 1,
                    student_count: 1,
                    monthly_schedules: 0,
                    pending_count: 0,
                    total_schedules: 0
                });
            }
            // 获取总览数据
            const caDateExpr = await getCaDateExpr();
            const stats = await db.query(`
                SELECT
                    (SELECT COUNT(*) FROM teachers) as teacher_count,
                    (SELECT COUNT(*) FROM students) as student_count,
                    (SELECT COUNT(*) FROM course_arrangement 
                       WHERE ${caDateExpr} >= DATE_TRUNC('month', CURRENT_DATE)) as monthly_schedules,
                    (SELECT COUNT(*) FROM course_arrangement WHERE status = 'pending') as pending_count,
                    (SELECT COUNT(*) FROM course_arrangement) as total_schedules
            `);

            // 兼容不同驱动返回值形态（对象含 rows 或直接数组）
            const rows = (stats && stats.rows) ? stats.rows : (Array.isArray(stats) ? stats : []);
            // 如果查询结果为空，返回默认值
            if (!rows[0]) {
                return res.json({
                    teacher_count: 0,
                    student_count: 0,
                    monthly_schedules: 0,
                    pending_count: 0,
                    total_schedules: 0
                });
            }

            res.json(rows[0]);
        } catch (error) {
            // 如果是 Neon 连接超时或 fetch 失败，则返回安全的默认统计，避免阻塞仪表盘
            const code = error?.sourceError?.code;
            const msg = String(error?.message || '');
            const isNeonTimeout = code === 'UND_ERR_CONNECT_TIMEOUT' || msg.includes('fetch failed');
            if (isNeonTimeout) {
                console.warn('获取总览统计时发生网络超时，返回默认统计');
                return res.json({
                    teacher_count: 0,
                    student_count: 0,
                    monthly_schedules: 0,
                    pending_count: 0,
                    total_schedules: 0
                });
            }
            console.error('获取总览统计错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    async getScheduleStats(req, res) {
        try {
            // 离线开发模式：返回空数组避免阻塞仪表盘
            if (process.env.OFFLINE_DEV === 'true') {
                return res.json([]);
            }
            let { startDate, endDate } = req.query;

            // 验证和设置默认日期
            if (!startDate || startDate === '') {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate = firstDay.toISOString().split('T')[0];
            }

            if (!endDate || endDate === '') {
                const now = new Date();
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate = lastDay.toISOString().split('T')[0];
            }

            // 获取排课统计数据
            const dateExpr = await (async () => {
                const r = await db.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name='course_arrangement' AND column_name IN ('arr_date','class_date','date')
              `);
                const cols = new Set((r.rows || []).map(x => x.column_name));
                const parts = [];
                if (cols.has('arr_date')) parts.push('ca.arr_date');
                if (cols.has('class_date')) parts.push('ca.class_date');
                if (cols.has('date')) parts.push('ca.date');
                return parts.length > 1 ? `COALESCE(${parts.join(', ')})` : (parts[0] || 'CURRENT_DATE');
            })();

            const query = `
                SELECT
                    COALESCE(st.description, st.name) as type,
                    COUNT(*) as count
                FROM course_arrangement ca
                JOIN schedule_types st ON ca.course_id = st.id
                WHERE ${dateExpr} BETWEEN $1 AND $2
                GROUP BY COALESCE(st.description, st.name)
                ORDER BY count DESC
            `;

            const result = await db.query(query, [startDate, endDate]);
            res.json(result.rows);
        } catch (error) {
            console.error('获取排课统计错误:', error);
            const code = error?.sourceError?.code;
            const msg = String(error?.message || '');
            const isNeonTimeout = code === 'UND_ERR_CONNECT_TIMEOUT' || msg.includes('fetch failed') || msg.includes('ETIMEDOUT');
            if (isNeonTimeout) {
                // Neon 连接超时或网络失败时返回空数据以保证仪表盘可用
                return res.json([]);
            }
            res.status(500).json({ message: '服务器错误' });
        }
    },

    async getUserStats(req, res) {
        try {
            let { startDate, endDate } = req.query;

            // 验证和设置默认日期
            if (!startDate || startDate === '') {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate = firstDay.toISOString().split('T')[0];
            }

            if (!endDate || endDate === '') {
                const now = new Date();
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate = lastDay.toISOString().split('T')[0];
            }

            // 获取用户统计数据
            const dateExpr2 = await (async () => {
                const r = await db.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name='course_arrangement' AND column_name IN ('arr_date','class_date','date')
              `);
                const cols = new Set((r.rows || []).map(x => x.column_name));
                const parts = [];
                if (cols.has('arr_date')) parts.push('ca.arr_date');
                if (cols.has('class_date')) parts.push('ca.class_date');
                if (cols.has('date')) parts.push('ca.date');
                return parts.length > 1 ? `COALESCE(${parts.join(', ')})` : (parts[0] || 'CURRENT_DATE');
            })();

            const teacherStats = await db.query(`
                SELECT
                    t.name as teacher_name,
                    COUNT(ca.id) as schedule_count
                FROM teachers t
                LEFT JOIN course_arrangement ca ON t.id = ca.teacher_id
                 AND ${dateExpr2} BETWEEN $1 AND $2
                GROUP BY t.id, t.name
                ORDER BY schedule_count DESC
                LIMIT 10
            `, [startDate, endDate]);

            const studentStats = await db.query(`
                SELECT
                    st.name as student_name,
                    COUNT(ca.id) as schedule_count
                FROM students st
                LEFT JOIN course_arrangement ca ON st.id = ca.student_id
                 AND ${dateExpr2} BETWEEN $1 AND $2
                GROUP BY st.id, st.name
                ORDER BY schedule_count DESC
                LIMIT 10
            `, [startDate, endDate]);

            res.json({
                teacherStats: teacherStats.rows,
                studentStats: studentStats.rows
            });
        } catch (error) {
            console.error('获取用户统计错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 导出教师数据
    async exportTeacherData(req, res) {
        try {
            const { startDate, endDate, preset } = req.query;

            try {
                // 计算实际日期范围
                const { actualStartDate, actualEndDate } = ExportUtils.calculateDateRange(startDate, endDate, preset);

                // 验证日期范围有效性
                ExportUtils.validateDateRange(actualStartDate, actualEndDate);

                // 获取日期表达式
                const dateExpr = await ExportUtils.getDateExpression();

                // 首先查询记录数以验证数据量
                const countResult = await db.query(`
                    SELECT COUNT(*) as total_teachers
                    FROM teachers t
                    LEFT JOIN course_arrangement ca ON t.id = ca.teacher_id 
                        AND ${dateExpr} BETWEEN $1 AND $2
                    GROUP BY t.id
                `, [ExportUtils.formatDateToISO(actualStartDate), ExportUtils.formatDateToISO(actualEndDate)]);

                const totalRecords = countResult.rows ? countResult.rows.length : 0;

                // 验证数据量
                ExportUtils.validateDataSize(totalRecords);

                // 获取教师详细信息和排课统计
                const teacherDataResult = await db.query(`
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
                        AND ${dateExpr} BETWEEN $1 AND $2
                    GROUP BY t.id, t.username, t.name, t.profession, t.contact, t.work_location, t.home_address, t.last_login, t.created_at
                    ORDER BY t.created_at DESC
                `, [ExportUtils.formatDateToISO(actualStartDate), ExportUtils.formatDateToISO(actualEndDate)]);

                const teacherData = teacherDataResult && teacherDataResult.rows ? teacherDataResult.rows : [];

                // 构建导出数据
                const excelData = ExportUtils.buildExportPayload('teacher', teacherData, actualStartDate, actualEndDate);

                // 记录审计日志
                try {
                    await recordAudit({
                        adminId: req.user?.id,
                        action: 'EXPORT_TEACHER_DATA',
                        details: {
                            dateRange: `${ExportUtils.formatDateToISO(actualStartDate)} - ${ExportUtils.formatDateToISO(actualEndDate)}`,
                            recordCount: teacherData.length
                        }
                    });
                } catch (auditError) {
                    console.warn('记录审计日志失败:', auditError.message);
                }

                res.json(standardResponse(true, excelData, '教师数据导出成功'));
            } catch (validationError) {
                // 处理验证错误
                const statusCode = validationError.message.includes('超过限制') ? 413 : 400;
                return res.status(statusCode).json(standardResponse(false, null, validationError.message));
            }
        } catch (error) {
            console.error('导出教师数据错误:', error);
            const errorMessage = error.message || '导出教师数据失败，请稍后重试';
            res.status(500).json(standardResponse(false, null, errorMessage));
        }
    },

    // 导出学生数据
    async exportStudentData(req, res) {
        try {
            const { startDate, endDate, preset } = req.query;

            try {
                // 计算实际日期范围
                const { actualStartDate, actualEndDate } = ExportUtils.calculateDateRange(startDate, endDate, preset);

                // 验证日期范围有效性
                ExportUtils.validateDateRange(actualStartDate, actualEndDate);

                // 获取日期表达式
                const dateExpr = await ExportUtils.getDateExpression();

                // 首先查询记录数以验证数据量
                const countResult = await db.query(`
                    SELECT COUNT(*) as total_students
                    FROM students s
                    LEFT JOIN course_arrangement ca ON s.id = ca.student_id 
                        AND ${dateExpr} BETWEEN $1 AND $2
                    GROUP BY s.id
                `, [ExportUtils.formatDateToISO(actualStartDate), ExportUtils.formatDateToISO(actualEndDate)]);

                const totalRecords = countResult.rows ? countResult.rows.length : 0;

                // 验证数据量
                ExportUtils.validateDataSize(totalRecords);

                // 获取学生详细信息和排课统计
                const studentDataResult = await db.query(`
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
                        AND ${dateExpr} BETWEEN $1 AND $2
                    GROUP BY s.id, s.username, s.name, s.profession, s.contact, s.visit_location, s.home_address, s.last_login, s.created_at
                    ORDER BY s.created_at DESC
                `, [ExportUtils.formatDateToISO(actualStartDate), ExportUtils.formatDateToISO(actualEndDate)]);

                const studentData = studentDataResult && studentDataResult.rows ? studentDataResult.rows : [];

                // 构建导出数据
                const excelData = ExportUtils.buildExportPayload('student', studentData, actualStartDate, actualEndDate);

                // 记录审计日志
                try {
                    await recordAudit({
                        adminId: req.user?.id,
                        action: 'EXPORT_STUDENT_DATA',
                        details: {
                            dateRange: `${ExportUtils.formatDateToISO(actualStartDate)} - ${ExportUtils.formatDateToISO(actualEndDate)}`,
                            recordCount: studentData.length
                        }
                    });
                } catch (auditError) {
                    console.warn('记录审计日志失败:', auditError.message);
                }

                res.json(standardResponse(true, excelData, '学生数据导出成功'));
            } catch (validationError) {
                // 处理验证错误
                const statusCode = validationError.message.includes('超过限制') ? 413 : 400;
                return res.status(statusCode).json(standardResponse(false, null, validationError.message));
            }
        } catch (error) {
            console.error('导出学生数据错误:', error);
            const errorMessage = error.message || '导出学生数据失败，请稍后重试';
            res.status(500).json(standardResponse(false, null, errorMessage));
        }
    },

    // ============ 高级导出功能 ============
    /**
     * 高级数据导出接口
     * 支持4种导出类型 + 2种文件格式
     * 
     * 查询参数：
     * - type: 导出类型 (teacher_info, student_info, teacher_schedule, student_schedule)
     * - format: 文件格式 (excel, csv)
     * - startDate: 开始日期 (仅对schedule类型有效)
     * - endDate: 结束日期 (仅对schedule类型有效)
     */
    async advancedExport(req, res) {
        let logId = null;
        let startTime = Date.now();

        try {
            const { type, format, startDate, endDate } = req.query;
            const adminId = req.user?.id;
            const adminName = req.user?.name || '未知用户';

            // ===== 参数验证 =====
            if (!type || !format) {
                return res.status(400).json(
                    standardResponse(false, null, '缺少必要参数: type 和 format')
                );
            }

            // ===== 初始化服务 =====
            const exportService = new AdvancedExportService(db);
            const logService = new ExportLogService(db);

            try {
                // 记录导出开始
                logId = await logService.logExportStart(
                    adminId,
                    adminName,
                    type,
                    format,
                    {
                        startDate,
                        endDate,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        userAgent: req.get('user-agent')
                    }
                );
            } catch (logError) {
                console.warn('记录导出日志失败:', logError.message);
                // 继续执行导出，不中断流程
            }

            try {
                // ===== 执行导出 =====
                const result = await exportService.execute(type, format, startDate, endDate);

                // ===== 准备响应数据 =====
                let responseData;
                let contentType;
                let filename;

                if (format === 'excel') {
                    responseData = result.data;
                    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    filename = result.filename;
                } else {
                    responseData = result.data;
                    contentType = 'text/csv;charset=utf-8';
                    filename = result.filename;
                }

                // 记录导出成功
                if (logId) {
                    try {
                        const duration = Date.now() - startTime;
                        let fileSize = 0;
                        if (format === 'excel') {
                            // Excel文件大小估算（实际大小取决于XLSX库）
                            fileSize = JSON.stringify(result.data).length * 2;
                        } else {
                            fileSize = result.data.length;
                        }

                        await logService.logExportComplete(
                            logId,
                            Array.isArray(result.data) ? result.data.length : 0,
                            fileSize,
                            filename
                        );
                    } catch (logError) {
                        console.warn('记录导出完成失败:', logError.message);
                    }
                }

                // ===== 返回导出数据 =====
                return res.json(standardResponse(true, {
                    data: responseData,
                    filename: filename,
                    format: format,
                    contentType: contentType,
                    exportedAt: new Date().toISOString(),
                    recordCount: Array.isArray(result.data) ? result.data.length : 0
                }, '导出成功'));

            } catch (exportError) {
                // 记录导出失败
                if (logId) {
                    try {
                        await logService.logExportFailure(logId, exportError.message);
                    } catch (logError) {
                        console.warn('记录导出失败日志失败:', logError.message);
                    }
                }

                // 处理验证错误
                if (exportError.status === 413) {
                    return res.status(413).json(
                        standardResponse(false, null, '导出数据量过大，' + exportError.message)
                    );
                }

                throw exportError;
            }

        } catch (error) {
            // 记录导出失败
            if (logId) {
                try {
                    await logService.logExportFailure(logId, error.message);
                } catch (logError) {
                    console.warn('记录导出失败日志失败:', logError.message);
                }
            }

            const statusCode = error.status || 400;
            console.error('高级导出错误:', error);
            res.status(statusCode).json(
                standardResponse(false, null, error.message || '导出操作失败，请稍后重试或联系管理员')
            );
        }
    }
};

module.exports = adminController;
