// 确保环境变量正确加载
require('dotenv').config();

// 如果 dotenv 加载失败，手动设置数据库连接字符串
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_pDu8R7LkAwiv@ep-patient-bird-a1hf50t1.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
}

// 强制使用 Neon serverless 驱动
process.env.DB_DRIVER = 'neon';

const { runInTransaction } = require('../db/db');

// 将刘昊老师的 ID 从 12 更新为 1023
async function updateTeacherId() {
    console.log('开始更新刘昊老师的 ID...');

    const oldId = 12;
    const newId = 1023;
    const teacherName = '刘昊';

    try {
        await runInTransaction(async (client) => {
            const query = (text, params) => client.query(text, params);

            console.log(`\n正在处理: ${teacherName} (ID: ${oldId} -> ${newId})`);

            // 1. 检查旧记录是否存在
            const checkOld = await query('SELECT * FROM teachers WHERE id = $1', [oldId]);
            if (checkOld.rows.length === 0) {
                throw new Error(`未找到 ID 为 ${oldId} 的教师记录`);
            }
            const oldTeacher = checkOld.rows[0];
            console.log(`  找到教师: ${oldTeacher.name} (用户名: ${oldTeacher.username})`);

            // 2. 检查新 ID 是否已占用
            const checkNew = await query('SELECT id FROM teachers WHERE id = $1', [newId]);
            if (checkNew.rows.length > 0) {
                throw new Error(`目标 ID ${newId} 已存在，无法更新！`);
            }

            // 3. 临时重命名旧账号以释放唯一约束
            console.log('  1. 临时重命名旧账号...');
            const tempUsername = `temp_${oldId}_${oldTeacher.username}`;
            await query('UPDATE teachers SET username = $1 WHERE id = $2', [tempUsername, oldId]);

            // 4. 创建新 ID 账号（复制所有数据）
            console.log('  2. 创建新 ID 账号...');
            const insertKeys = Object.keys(oldTeacher).filter(k => k !== 'id').join(', ');
            const insertValues = Object.keys(oldTeacher).filter(k => k !== 'id').map((_, i) => `$${i + 2}`).join(', ');
            const values = Object.keys(oldTeacher).filter(k => k !== 'id').map(k => {
                // 如果是 username，使用原始 username (不是 temp)
                if (k === 'username') return oldTeacher.username;
                return oldTeacher[k];
            });

            const insertSql = `INSERT INTO teachers (id, ${insertKeys}) VALUES ($1, ${insertValues})`;
            await query(insertSql, [newId, ...values]);
            console.log(`  ✓ 已创建新 ID ${newId} 的教师记录`);

            // 5. 更新关联表 (Course Arrangement)
            console.log('  3. 更新关联表 (Course Arrangement)...');
            const updateCa = await query('UPDATE course_arrangement SET teacher_id = $1 WHERE teacher_id = $2', [newId, oldId]);
            console.log(`     ✓ 更新了 ${updateCa.rowCount || 0} 条课程记录`);

            // 6. 更新关联表 (Teacher Availability)
            console.log('  4. 更新关联表 (Teacher Availability)...');
            const updateAvail = await query('UPDATE teacher_daily_availability SET teacher_id = $1 WHERE teacher_id = $2', [newId, oldId]);
            console.log(`     ✓ 更新了 ${updateAvail.rowCount || 0} 条可用性记录`);

            // 7. 删除旧账号
            console.log('  5. 删除旧 ID 记录...');
            await query('DELETE FROM teachers WHERE id = $1', [oldId]);
            console.log(`  ✓ 已删除旧 ID ${oldId} 的记录`);

            // 8. 验证新记录
            console.log('\n验证更新结果...');
            const verifyRes = await query('SELECT id, name, username FROM teachers WHERE id = $1', [newId]);
            if (verifyRes.rows.length > 0) {
                const teacher = verifyRes.rows[0];
                console.log(`✓ 成功：${teacher.name} (ID: ${teacher.id}, 用户名: ${teacher.username})`);
            } else {
                throw new Error('验证失败：未找到新 ID 的记录');
            }
        });

        console.log('\n✅ 教师 ID 更新成功完成！');
        console.log(`刘昊老师的 ID 已从 ${oldId} 更新为 ${newId}`);
        process.exit(0);
    } catch (err) {
        console.error('\n❌ 更新失败，事务已回滚。');
        console.error('错误详情:', err.message);
        process.exit(1);
    }
}

updateTeacherId();
