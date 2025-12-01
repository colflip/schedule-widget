const db = require('../db/db');

// 动态构建 course_arrangement 日期表达式（兼容 arr_date/class_date/date 缺失场景）
const __dateExprCache = {};
async function getDateExpr(alias) {
    const key = `expr_${alias || ''}`;
    if (__dateExprCache[key]) return __dateExprCache[key];
    const r = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='course_arrangement'
        AND column_name IN ('arr_date','class_date','date')
    `);
    const cols = new Set((r.rows || []).map(x => x.column_name));
    const mk = (c) => alias ? `${alias}.${c}` : c;
    const parts = [];
    if (cols.has('arr_date')) parts.push(mk('arr_date'));
    if (cols.has('class_date')) parts.push(mk('class_date'));
    if (cols.has('date')) parts.push(mk('date'));
    const expr = parts.length > 1 ? `COALESCE(${parts.join(', ')})` : (parts[0] || 'CURRENT_DATE');
    __dateExprCache[key] = expr;
    return expr;
}

const studentController = {
    // 获取个人信息
    async getProfile(req, res) {
        try {
            // 动态选择是否返回 status 字段
            let selectCols = 'id, username, name, profession, contact, visit_location, home_address, last_login';
            try {
                const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='status'`);
                if ((cols.rows || []).length > 0) {
                    selectCols += ', status';
                }
            } catch (_) { }
            const result = await db.query(
                `SELECT ${selectCols} FROM students WHERE id = $1`,
                [req.user.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: '未找到学生信息' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('获取学生信息错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 更新个人信息
    async updateProfile(req, res) {
        try {
            const { name, profession, contact, visit_location, home_address, status } = req.body;

            let sets = ['name = $1', 'profession = $2', 'contact = $3', 'visit_location = $4', 'home_address = $5'];
            let values = [name, profession, contact, visit_location, home_address];
            let vi = 6;
            if (typeof status !== 'undefined') {
                const s = Number(status);
                if (![-1, 0, 1].includes(s)) {
                    return res.status(400).json({ message: '非法状态值' });
                }
                sets.push(`status = $${vi++}`);
                values.push(s);
            }
            values.push(req.user.id);

            const result = await db.query(
                `UPDATE students
                SET ${sets.join(', ')}
                WHERE id = $${vi}
                RETURNING id, username, name, profession, contact, visit_location, home_address, status`,
                values
            );

            try { const { recordAudit } = require('../middleware/audit'); await recordAudit(req, { op: 'update_status', entityType: 'student', entityId: req.user.id, details: { status } }); } catch (_) { }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('更新学生信息错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 获取时间安排
    async getAvailability(req, res) {
        try {
            const { startDate, endDate } = req.query;
            // 返回新的时段字段
            const result = await db.query(
                `SELECT id, date, morning_available, afternoon_available, evening_available
                FROM student_daily_availability
                WHERE student_id = $1
                  AND date BETWEEN $2 AND $3
                ORDER BY date`,
                [req.user.id, startDate, endDate]
            );

            res.json(result.rows.map(r => ({
                id: r.id,
                date: r.date,
                morning_available: r.morning_available,
                afternoon_available: r.afternoon_available,
                evening_available: r.evening_available
            })));
        } catch (error) {
            console.error('获取时间安排错误:', error);
            const code = error?.sourceError?.code;
            const msg = String(error?.message || '');
            const isNeonTimeout = code === 'UND_ERR_CONNECT_TIMEOUT' || msg.includes('fetch failed') || msg.includes('ETIMEDOUT');
            if (isNeonTimeout) {
                return res.json([]);
            }
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 设置时间安排
    async setAvailability(req, res) {
        try {
            const { availabilityList } = req.body;
            const studentId = req.user.id; // 提前保存 user ID，防止在事务中丢失

            console.log(`[setAvailability] 收到时间安排保存请求，学生ID: ${studentId}`);
            console.log(`[setAvailability] 请求包含 ${availabilityList?.length} 条时间安排记录`);

            if (!Array.isArray(availabilityList)) {
                console.error('[setAvailability] 无效的数据格式: availabilityList 不是数组');
                return res.status(400).json({ message: '无效的数据格式' });
            }

            let updateCount = 0;
            let insertCount = 0;

            // 重要：在事务工作函数中不应该调用 res.json()
            // 应该先完成数据库操作，然后在事务外返回响应
            await db.runInTransaction(async (client, usePool) => {
                const q = usePool ? db.query : client.query.bind(client);

                for (const item of availabilityList) {
                    console.log(`[setAvailability] 处理记录: 日期=${item.date}, 时间段=${item.timeSlot}, isAvailable=${item.isAvailable}`);

                    const slotToCol = (slot) => {
                        switch (slot) {
                            case 'morning': return 'morning_available';
                            case 'afternoon': return 'afternoon_available';
                            case 'evening': return 'evening_available';
                            default: return null;
                        }
                    };
                    const col = slotToCol(item.timeSlot);
                    if (!col) {
                        console.warn(`[setAvailability] 未知的时间段: ${item.timeSlot}，跳过`);
                        continue;
                    }

                    const val = item.isAvailable === false ? 0 : 1;

                    const updateSql = `UPDATE student_daily_availability SET ${col} = $3, updated_at = CURRENT_TIMESTAMP WHERE student_id = $1 AND date = $2`;
                    console.log(`[setAvailability] 执行UPDATE: ${updateSql.substring(0, 80)}...`, { student_id: studentId, date: item.date, col, val });

                    const upd = await q(
                        updateSql,
                        [studentId, item.date, val]
                    );

                    console.log(`[setAvailability] 已更新记录: ${item.date} (${col}=${val}), 影响行数: ${upd?.rowCount}`);

                    if (!upd || upd.rowCount === 0) {
                        const morning = (col === 'morning_available') ? val : 0;
                        const afternoon = (col === 'afternoon_available') ? val : 0;
                        const evening = (col === 'evening_available') ? val : 0;

                        const insertSql = `INSERT INTO student_daily_availability (student_id, date, morning_available, afternoon_available, evening_available, created_at)
                             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`;
                        console.log(`[setAvailability] 执行INSERT:`, { student_id: studentId, date: item.date, morning: morning, afternoon: afternoon, evening: evening });

                        const ins = await q(
                            insertSql,
                            [studentId, item.date, morning, afternoon, evening]
                        );
                        console.log(`[setAvailability] INSERT完成, 影响行数: ${ins?.rowCount}`);
                        insertCount++;
                    } else {
                        updateCount++;
                    }
                }
            });

            // 事务完成后再返回响应
            console.log(`[setAvailability] 事务完成: updateCount=${updateCount}, insertCount=${insertCount}`);
            res.json({ message: '时间安排更新成功', updateCount, insertCount });
        } catch (error) {
            console.error('[setAvailability] 错误:', error);
            console.error('[setAvailability] 错误堆栈:', error.stack);
            res.status(500).json({ message: '服务器错误', error: error.message });
        }
    },

    // 删除时间安排
    async deleteAvailability(req, res) {
        try {
            const { startDate, endDate, timeSlots, ranges } = req.body;

            const slotToCol = (slot) => {
                switch (slot) {
                    case 'morning': return 'morning_available';
                    case 'afternoon': return 'afternoon_available';
                    case 'evening': return 'evening_available';
                    default: return null;
                }
            };

            if (Array.isArray(timeSlots) && timeSlots.length > 0) {
                for (const slot of timeSlots) {
                    const col = slotToCol(slot);
                    if (!col) continue;
                    await db.query(
                        `UPDATE student_daily_availability SET ${col} = 0, updated_at = CURRENT_TIMESTAMP WHERE student_id = $1 AND date BETWEEN $2 AND $3`,
                        [req.user.id, startDate, endDate]
                    );
                }
            }

            if (Array.isArray(ranges) && ranges.length > 0) {
                // ranges 仍然兼容，但作为回退：将对应时段设置为 0
                for (const r of ranges) {
                    // 根据传入的 start_time 来判断是哪个时段
                    const start = r.start_time;
                    let slot = null;
                    if (start === '08:00') slot = 'morning';
                    if (start === '13:00') slot = 'afternoon';
                    if (start === '18:00') slot = 'evening';
                    const col = slotToCol(slot);
                    if (!col) continue;
                    await db.query(
                        `UPDATE student_daily_availability SET ${col} = 0, updated_at = CURRENT_TIMESTAMP WHERE student_id = $1 AND date BETWEEN $2 AND $3`,
                        [req.user.id, startDate, endDate]
                    );
                }
            }

            res.json({ message: '时间安排删除成功' });
        } catch (error) {
            console.error('删除时间安排错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 获取课程安排
    async getSchedules(req, res) {
        try {
            const { startDate, endDate, status } = req.query;

            const dateExpr = await getDateExpr('ca');
            let query = `
                SELECT 
                    ca.id,
                    ${dateExpr} AS date,
                    ca.start_time, ca.end_time, ca.status,
                    ca.location,
                    ca.teacher_id, t.name as teacher_name,
                    sty.name as schedule_type,
                    sty.description as schedule_type_cn
                FROM course_arrangement ca
                JOIN teachers t ON ca.teacher_id = t.id
                JOIN schedule_types sty ON ca.course_id = sty.id
                JOIN students s ON ca.student_id = s.id
                WHERE ca.student_id = $1
                  AND ${dateExpr} BETWEEN $2 AND $3
            `;

            // 若存在 status 列，则过滤仅展示正常状态账号的记录
            try {
                const tCols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='teachers' AND column_name='status'`);
                const sCols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='status'`);
                const teacherHasStatus = (tCols.rows || []).length > 0;
                const studentHasStatus = (sCols.rows || []).length > 0;
                if (teacherHasStatus) query += ` AND t.status = 1`;
                if (studentHasStatus) query += ` AND s.status = 1`;
            } catch (_) { }

            const values = [req.user.id, startDate, endDate];

            if (status) {
                query += ` AND ca.status = $4`;
                values.push(status);
            }

            query += ` ORDER BY date, ca.start_time`;

            const result = await db.query(query, values);
            res.json(result.rows);
        } catch (error) {
            console.error('获取课程安排错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 获取统计数据
    async getStatistics(req, res) {
        try {
            const { startDate, endDate } = req.query;

            // 获取课程类型统计
            const dateExprCa = await getDateExpr('ca');
            const typeStats = await db.query(`
                SELECT 
                    sty.name as type,
                    COUNT(*) as count
                FROM course_arrangement ca
                JOIN schedule_types sty ON ca.course_id = sty.id
                WHERE ca.student_id = $1
                  AND ${dateExprCa} BETWEEN $2 AND $3
                GROUP BY COALESCE(sty.description, sty.name)
                ORDER BY count DESC
            `, [req.user.id, startDate, endDate]);

            // 获取每月课程数统计
            const dateExprNoAlias = await getDateExpr('');
            const monthlyStats = await db.query(`
                SELECT 
                    DATE_TRUNC('month', ${dateExprNoAlias}) as month,
                    COUNT(*) as count
                FROM course_arrangement
                WHERE student_id = $1
                  AND ${dateExprNoAlias} BETWEEN $2 AND $3
                GROUP BY month
                ORDER BY month
            `, [req.user.id, startDate, endDate]);

            res.json({
                typeStats: typeStats.rows,
                monthlyStats: monthlyStats.rows
            });
        } catch (error) {
            console.error('获取统计数据错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 获取总览数据
    async getOverview(req, res) {
        try {
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

            const dateExpr = await getDateExpr('ca');

            // 获取本月课程数
            const monthlyResult = await db.query(`
                SELECT COUNT(*) as count
                FROM course_arrangement ca
                WHERE ca.student_id = $1
                  AND ${dateExpr} BETWEEN $2 AND $3
            `, [req.user.id, firstDayOfMonth.toISOString().split('T')[0], lastDayOfMonth.toISOString().split('T')[0]]);

            // 获取待上课程数
            const upcomingResult = await db.query(`
                SELECT COUNT(*) as count
                FROM course_arrangement ca
                WHERE ca.student_id = $1
                  AND ca.status IN ('pending', 'confirmed')
                  AND ${dateExpr} >= CURRENT_DATE
            `, [req.user.id]);

            // 获取已完成课程数
            const completedResult = await db.query(`
                SELECT COUNT(*) as count
                FROM course_arrangement ca
                WHERE ca.student_id = $1
                  AND ca.status = 'completed'
            `, [req.user.id]);

            // 获取今日课程
            const todayStr = today.toISOString().split('T')[0];
            const todaySchedules = await db.query(`
                SELECT 
                    ca.id,
                    ${dateExpr} AS date,
                    ca.start_time, ca.end_time, ca.status,
                    ca.location,
                    t.name as teacher_name,
                    sty.name as schedule_type,
                    sty.description as schedule_type_cn
                FROM course_arrangement ca
                JOIN teachers t ON ca.teacher_id = t.id
                JOIN schedule_types sty ON ca.course_id = sty.id
                WHERE ca.student_id = $1
                  AND ${dateExpr} = $2
                ORDER BY ca.start_time
            `, [req.user.id, todayStr]);

            res.json({
                monthlyCount: parseInt(monthlyResult.rows[0]?.count || 0),
                upcomingCount: parseInt(upcomingResult.rows[0]?.count || 0),
                completedCount: parseInt(completedResult.rows[0]?.count || 0),
                todaySchedules: todaySchedules.rows
            });
        } catch (error) {
            console.error('获取总览数据错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 获取数据汇总
    async getDataSummary(req, res) {
        try {
            const { startDate, endDate } = req.query;

            const dateExpr = await getDateExpr('ca');
            const result = await db.query(`
                SELECT 
                    ca.id,
                    ${dateExpr} AS date,
                    ca.start_time, ca.end_time, ca.status,
                    ca.location,
                    t.name as teacher_name,
                    sty.name as schedule_type,
                    sty.description as schedule_type_cn
                FROM course_arrangement ca
                JOIN teachers t ON ca.teacher_id = t.id
                JOIN schedule_types sty ON ca.course_id = sty.id
                WHERE ca.student_id = $1
                  AND ${dateExpr} BETWEEN $2 AND $3
                ORDER BY date, ca.start_time
            `, [req.user.id, startDate, endDate]);

            res.json(result.rows);
        } catch (error) {
            console.error('获取数据汇总错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 确认课程
    async confirmSchedule(req, res) {
        try {
            const scheduleId = req.params.id;

            // 验证课程是否属于该学生
            const checkResult = await db.query(
                'SELECT id FROM course_arrangement WHERE id = $1 AND student_id = $2',
                [scheduleId, req.user.id]
            );

            if (checkResult.rows.length === 0) {
                return res.status(404).json({ message: '未找到该课程或无权限' });
            }

            // 更新状态为已确认
            await db.query(
                'UPDATE course_arrangement SET status = $1 WHERE id = $2',
                ['confirmed', scheduleId]
            );

            res.json({ message: '课程确认成功' });
        } catch (error) {
            console.error('确认课程错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    },

    // 修改密码
    async changePassword(req, res) {
        try {
            const bcrypt = require('bcrypt');
            const { currentPassword, newPassword } = req.body;

            // 验证输入
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ message: '请提供当前密码和新密码' });
            }

            if (newPassword.length < 1) {
                return res.status(400).json({ message: '新密码不能为空' });
            }

            // 获取当前密码哈希
            const result = await db.query(
                'SELECT password_hash FROM students WHERE id = $1',
                [req.user.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: '未找到学生信息' });
            }

            const currentPasswordHash = result.rows[0].password_hash;

            // 验证当前密码
            let isValidPassword = false;
            try {
                isValidPassword = await bcrypt.compare(currentPassword, currentPasswordHash);
            } catch (error) {
                console.error('密码比较错误:', error);
                return res.status(500).json({ message: '密码验证失败' });
            }

            if (!isValidPassword) {
                return res.status(401).json({ message: '当前密码不正确' });
            }

            // 生成新密码哈希
            const salt = await bcrypt.genSalt(10);
            const newPasswordHash = await bcrypt.hash(newPassword, salt);

            // 更新密码
            await db.query(
                'UPDATE students SET password_hash = $1 WHERE id = $2',
                [newPasswordHash, req.user.id]
            );

            // 记录审计
            try {
                const { recordAudit } = require('../middleware/audit');
                await recordAudit(req, {
                    op: 'change_password',
                    entityType: 'student',
                    entityId: req.user.id,
                    details: { success: true }
                });
            } catch (_) {
                // 忽略审计错误
            }

            res.json({ message: '密码修改成功' });
        } catch (error) {
            console.error('修改密码错误:', error);
            res.status(500).json({ message: '服务器错误' });
        }
    }
};

module.exports = studentController;
