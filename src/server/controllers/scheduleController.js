/**
 * 排课管理控制器
 * @description 处理排课相关操作：可用教师/学生查询、冲突检测、课程创建等
 */

const db = require('../db/db');

/**
 * 动态识别 course_arrangement 表中的日期列
 * @description 避免引用不存在的列，带缓存
 * @returns {Promise<string>} SQL日期表达式
 */
let caDateExprCache = null;
async function getCaDateExpr() {
    if (caDateExprCache) return caDateExprCache;
    try {
        const r = await db.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name='course_arrangement' AND column_name IN ('arr_date','class_date','date')
        `);
        const cols = new Set((r.rows || []).map(x => x.column_name));
        const parts = [];
        if (cols.has('arr_date')) parts.push('arr_date');
        if (cols.has('class_date')) parts.push('class_date');
        if (cols.has('date')) parts.push('date');
        const expr = parts.length > 1 ? `COALESCE(${parts.join(', ')})` : (parts[0] || 'date');
        caDateExprCache = expr;
        return expr;
    } catch (_) {
        // 兜底使用 date 列名
        caDateExprCache = 'date';
        return caDateExprCache;
    }
}

const scheduleController = {
    /**
     * 获取可用教师
     * @description 查询指定日期和时间段内可用的教师列表
     * @param {string} req.query.date - 日期
     * @param {string} req.query.timeSlot - 时段（morning/afternoon/evening）
     * @param {string} req.query.startTime - 开始时间（可选）
     * @param {string} req.query.endTime - 结束时间（可选）
     */
    async getAvailableTeachers(req, res) {
        try {
            const { date, timeSlot, startTime, endTime } = req.query;

            // 将 timeSlot 转换为具体时间段（与迁移映射保持一致）
            const slotToRange = (slot) => {
                switch (slot) {
                    case 'morning': return ['08:00', '12:00'];
                    case 'afternoon': return ['13:00', '17:00'];
                    case 'evening': return ['18:00', '21:00'];
                    default: return [null, null];
                }
            };

            const [slotStart, slotEnd] = timeSlot ? slotToRange(timeSlot) : [null, null];
            const qStart = startTime || slotStart;
            const qEnd = endTime || slotEnd;

            const query = `
                SELECT DISTINCT t.*
                FROM teachers t
                JOIN teacher_daily_availability ta ON t.id = ta.teacher_id
                WHERE ta.date = $1
                AND ta.status = 'available'
                AND (ta.start_time, ta.end_time) OVERLAPS ($2::time, $3::time)
                AND NOT EXISTS (
                    SELECT 1
                    FROM course_arrangement ca
                    WHERE ca.teacher_id = t.id
                    AND COALESCE(ca.arr_date, ca.class_date, ca.date) = $1
                    AND (ca.start_time, ca.end_time) OVERLAPS ($2::time, $3::time)
                    AND ca.status != 'cancelled'
                )
            `;

            const result = await db.query(query, [date, qStart, qEnd]);
            res.json(result.rows);
        } catch (error) {
            console.error('获取可用教师错误:', error);
            const code = error?.sourceError?.code;
            const msg = String(error?.message || '');
            const isNeonTimeout = code === 'UND_ERR_CONNECT_TIMEOUT' || msg.includes('fetch failed') || msg.includes('ETIMEDOUT');
            if (isNeonTimeout) {
                return res.json([]);
            }
            res.status(500).json({ message: '服务器错误' });
        }
    },

    /**
     * 获取可用学生
     * @description 查询指定日期和时间段内可用的学生列表
     * @param {string} req.query.date - 日期
     * @param {string} req.query.timeSlot - 时段（morning/afternoon/evening）
     * @param {string} req.query.startTime - 开始时间（可选）
     * @param {string} req.query.endTime - 结束时间（可选）
     */
    async getAvailableStudents(req, res) {
        try {
            const { date, timeSlot, startTime, endTime } = req.query;

            const slotToRange = (slot) => {
                switch (slot) {
                    case 'morning': return ['08:00', '12:00'];
                    case 'afternoon': return ['13:00', '17:00'];
                    case 'evening': return ['18:00', '21:00'];
                    default: return [null, null];
                }
            };

            const [slotStart, slotEnd] = timeSlot ? slotToRange(timeSlot) : [null, null];
            const qStart = startTime || slotStart;
            const qEnd = endTime || slotEnd;

            const query = `
                SELECT DISTINCT s.*
                FROM students s
                JOIN student_daily_availability sa ON s.id = sa.student_id
                WHERE sa.date = $1
                AND sa.status = 'available'
                AND (sa.start_time, sa.end_time) OVERLAPS ($2::time, $3::time)
                AND NOT EXISTS (
                    SELECT 1
                    FROM course_arrangement ca
                    WHERE ca.student_id = s.id
                    AND COALESCE(ca.arr_date, ca.class_date, ca.date) = $1
                    AND (ca.start_time, ca.end_time) OVERLAPS ($2::time, $3::time)
                    AND ca.status != 'cancelled'
                )
            `;

            const result = await db.query(query, [date, qStart, qEnd]);
            res.json(result.rows);
        } catch (error) {
            console.error('获取可用学生错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    /**
     * 检查排课冲突（内部辅助函数）
     * @description 检测教师/学生的时间冲突，返回结构化详情
     * @param {number} teacherId - 教师ID
     * @param {number} studentId - 学生ID
     * @param {string} date - 日期
     * @param {string} timeSlot - 时段
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @param {Object} client - 可选的事务客户端
     * @returns {Promise<Object>} 冲突检测结果
     */
    async _checkScheduleConflicts(teacherId, studentId, date, timeSlot, startTime, endTime, client) {
        try {
            // timeSlot 转时间范围
            const slotToRange = (slot) => {
                switch (slot) {
                    case 'morning': return ['08:00', '12:00'];
                    case 'afternoon': return ['13:00', '17:00'];
                    case 'evening': return ['18:00', '21:00'];
                    default: return [null, null];
                }
            };
            const [slotStart, slotEnd] = timeSlot ? slotToRange(timeSlot) : [null, null];
            const qStart = startTime || slotStart;
            const qEnd = endTime || slotEnd;

            const caDateExpr = await getCaDateExpr();
            // 精确重复检查（同一教师/学生/日期/时间段）
            const q = client ? client.query.bind(client) : db.query;
            const dupRes = await q(
                `SELECT id, teacher_id, student_id, course_id, ${caDateExpr} as date, start_time, end_time, status, location
                 FROM course_arrangement
                 WHERE teacher_id = $1 AND student_id = $2 AND ${caDateExpr} = $3
                   AND start_time = $4 AND end_time = $5 AND status != 'cancelled'
                 LIMIT 1`,
                [teacherId, studentId, date, qStart, qEnd]
            );
            if (dupRes.rows.length > 0) {
                return { hasConflicts: true, type: 'duplicate', message: '存在完全重复的排课记录', existing: dupRes.rows[0] };
            }

            // 教师时间冲突（重叠）
            const teacherConflict = await q(
                `SELECT id, teacher_id, student_id, course_id, ${caDateExpr} as date, start_time, end_time, status, location
                 FROM course_arrangement 
                 WHERE teacher_id = $1 
                   AND ${caDateExpr} = $2 
                   AND (start_time, end_time) OVERLAPS ($3::time, $4::time) 
                   AND status != 'cancelled'
                 LIMIT 1`,
                [teacherId, date, qStart, qEnd]
            );
            if (teacherConflict.rows.length > 0) {
                return { hasConflicts: true, type: 'overlap_teacher', message: '教师时间段与现有排课重叠', existing: teacherConflict.rows[0] };
            }

            // 学生时间冲突（重叠）
            const studentConflict = await q(
                `SELECT id, teacher_id, student_id, course_id, ${caDateExpr} as date, start_time, end_time, status, location
                 FROM course_arrangement 
                 WHERE student_id = $1 
                   AND ${caDateExpr} = $2 
                   AND (start_time, end_time) OVERLAPS ($3::time, $4::time) 
                   AND status != 'cancelled'
                 LIMIT 1`,
                [studentId, date, qStart, qEnd]
            );
            if (studentConflict.rows.length > 0) {
                return { hasConflicts: true, type: 'overlap_student', message: '学生时间段与现有排课重叠', existing: studentConflict.rows[0] };
            }

            // 没有冲突
            return { hasConflicts: false };
        } catch (error) {
            console.error('检查时间冲突错误:', error);
            return { hasConflicts: true, type: 'error', message: '服务器错误' };
        }
    },

    /**
     * 检查排课冲突（接口处理器）
     * @description 提供 HTTP 接口检测排课冲突
     */
    async checkScheduleConflicts(req, res) {
        try {
            const { teacherId, studentId, date, timeSlot, startTime, endTime } = req.body;
            if (!teacherId || !studentId || !date || (!timeSlot && (!startTime || !endTime))) {
                return res.status(400).json({ message: '缺少必要参数' });
            }
            // 注意：Express 调用时不会绑定 this，这里直接引用模块作用域对象以避免 TypeError
            const result = await scheduleController._checkScheduleConflicts(teacherId, studentId, date, timeSlot, startTime, endTime);
            res.json(result);
        } catch (error) {
            console.error('检查时间冲突接口错误:', error);
            res.status(500).json({ hasConflicts: true, type: 'error', message: '服务器错误' });
        }
    },

    /**
     * 创建课程安排
     * @description 在事务中创建排课记录，支持多学生批量创建
     */
    async createSchedule(req, res) {
        try {
            const {
                teacherId,
                studentIds,
                date,
                timeSlot,
                startTime,
                endTime,
                scheduleTypes,
                location
            } = req.body;

            // 使用 db.runInTransaction 保证事务在同一连接上执行（对支持 client 的驱动使用 client，回退到 pool 时仍可工作）
            await db.runInTransaction(async (client /*, usePool */) => {
                // 在事务内先检查时间冲突（使用同一 client）
                for (const studentId of studentIds) {
                    const conflicts = await scheduleController._checkScheduleConflicts(teacherId, studentId, date, timeSlot, startTime, endTime, client);
                    if (conflicts.hasConflicts) {
                        throw Object.assign(new Error(conflicts.message), { statusCode: 400, payload: { type: conflicts.type, existing: conflicts.existing || null } });
                    }
                }

                // 仅支持单课程类型，兼容旧接口：若传数组取第一个
                const courseId = Array.isArray(scheduleTypes) ? scheduleTypes[0] : scheduleTypes;
                if (!courseId) {
                    throw Object.assign(new Error('缺少课程类型（course_id）'), { statusCode: 400 });
                }

                // 创建排课记录（新表）
                const insert = `
                    INSERT INTO course_arrangement (teacher_id, student_id, course_id, arr_date, start_time, end_time, location, status, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
                    RETURNING id
                `;

                // 多学生：分别插入（使用事务 client）
                let createdIds = [];
                for (const studentId of studentIds) {
                    const r = await client.query(insert, [teacherId, studentId, courseId, date, startTime, endTime, location || null, req.user.id]);
                    createdIds.push(r.rows[0].id);
                }

                // 正常返回结果（runInTransaction 将负责提交）
                res.status(201).json({ ids: createdIds });
            });
        } catch (error) {
            // 统一错误处理：如果是业务错误（带 statusCode），按该状态返回
            if (error && error.statusCode === 400) {
                const payload = error.payload || {};
                return res.status(400).json(Object.assign({ message: error.message }, payload));
            }
            console.error('创建课程安排错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    /**
     * 获取课程类型
     * @description 返回所有可用的课程类型列表
     */
    async getScheduleTypes(req, res) {
        try {
            const result = await db.query(
                'SELECT * FROM schedule_types ORDER BY name'
            );
            res.json(result.rows);
        } catch (error) {
            console.error('获取课程类型错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    /**
     * 教师确认课程
     * @description 教师确认指定课程，更新状态为已确认
     * @param {string} req.params.scheduleId - 课程ID
     */
    async confirmTeacher(req, res) {
        try {
            const { scheduleId } = req.params;

            // 检查权限（新表）
            const schedule = await db.query('SELECT teacher_id FROM course_arrangement WHERE id = $1', [scheduleId]);
            if (schedule.rows.length === 0) {
                return res.status(404).json({ message: '课程不存在' });
            }

            // 修复：使用统一的 userType 字段判断管理员身份
            if (schedule.rows[0].teacher_id !== req.user.id && req.user.userType !== 'admin') {
                return res.status(403).json({ message: '无权操作' });
            }

            // 更新状态为 confirmed
            await db.query(
                'UPDATE course_arrangement SET status = \'confirmed\' WHERE id = $1',
                [scheduleId]
            );

            res.json({ success: true });
        } catch (error) {
            console.error('确认课程错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    /**
     * 管理员确认课程
     * @description 管理员确认指定课程，更新状态为已确认
     * @param {string} req.params.scheduleId - 课程ID
     */
    async confirmAdmin(req, res) {
        try {
            const { scheduleId } = req.params;

            // 更新排课状态
            await db.query(
                'UPDATE course_arrangement SET status = \'confirmed\' WHERE id = $1',
                [scheduleId]
            );

            res.json({ success: true });
        } catch (error) {
            console.error('管理员确认课程错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    }
};

module.exports = scheduleController;
