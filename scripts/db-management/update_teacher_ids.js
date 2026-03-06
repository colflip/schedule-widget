const fs = require('fs');
const path = require('path');
const { runInTransaction } = require('../db/db');

// ID 映射配置
const ID_MAPPING = [
    { oldId: 10, newId: 1001, name: '侯老师' },
    { oldId: 9, newId: 1002, name: '金博' },
    { oldId: 7, newId: 1003, name: '叶婷婷' },
    { oldId: 8, newId: 1022, name: '何俊华' },
    { oldId: 1, newId: 1020, name: '周耀华' },
    { oldId: 11, newId: 1021, name: '高渊' }
];

async function updateTeacherIds() {
    console.log('开始执行教师 ID 迁移...');

    // 1. 备份数据 (简化为 JSON 写入)
    const backupDir = path.join(__dirname, '../../../backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `teacher_migration_backup_${timestamp}.json`);

    console.log(`正在备份数据到: ${backupFile}`);

    try {
        await runInTransaction(async (client, usePool) => {
            // 这里的 client 可能是 pg client 也可能是 neon 的 adapter
            // 为了兼容性，如果是 neon (usePool=true)，我们调用全局 query，但 runInTransaction 内部已经处理了
            // 但注意：db.js 中，如果 usePool=true，client 是一个模拟对象 { query: exportedQuery }

            const query = (text, params) => client.query(text, params);

            // 获取当前数据进行备份
            const teachersRes = await query('SELECT * FROM teachers');
            const caRes = await query('SELECT * FROM course_arrangement WHERE teacher_id IN (' + ID_MAPPING.map(m => m.oldId).join(',') + ')');
            const availRes = await query('SELECT * FROM teacher_daily_availability WHERE teacher_id IN (' + ID_MAPPING.map(m => m.oldId).join(',') + ')');

            const backupData = {
                teachers: teachersRes.rows,
                course_arrangement: caRes.rows,
                teacher_daily_availability: availRes.rows
            };

            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
            console.log('数据备份完成。');

            // 2. 执行迁移
            for (const { oldId, newId, name } of ID_MAPPING) {
                console.log(`\n正在处理: ${name} (ID: ${oldId} -> ${newId})`);

                // 检查旧记录是否存在
                const checkOld = await query('SELECT * FROM teachers WHERE id = $1', [oldId]);
                if (checkOld.rows.length === 0) {
                    console.warn(`  ⚠️ 未找到 ID 为 ${oldId} 的教师记录，跳过。`);
                    continue;
                }
                const oldTeacher = checkOld.rows[0];

                // 检查新 ID 是否已占用
                const checkNew = await query('SELECT id FROM teachers WHERE id = $1', [newId]);
                if (checkNew.rows.length > 0) {
                    throw new Error(`目标 ID ${newId} 已存在，无法迁移！`);
                }

                console.log('  1. 临时重命名旧账号以释放唯一约束...');
                const tempUsername = `temp_${oldId}_${oldTeacher.username}`;
                await query('UPDATE teachers SET username = $1 WHERE id = $2', [tempUsername, oldId]);

                console.log('  2. 创建新 ID 账号...');
                // 复制旧教师数据，插入新 ID
                // 注意：Postgres 的 SERIAL 自增主键如果不冲突可以直接插入指定 ID
                const insertKeys = Object.keys(oldTeacher).filter(k => k !== 'id').join(', ');
                const insertValues = Object.keys(oldTeacher).filter(k => k !== 'id').map((_, i) => `$${i + 2}`).join(', ');
                const values = Object.keys(oldTeacher).filter(k => k !== 'id').map(k => {
                    // 如果是 username，使用原始 username (不是 temp)
                    if (k === 'username') return oldTeacher.username;
                    return oldTeacher[k];
                });

                const insertSql = `INSERT INTO teachers (id, ${insertKeys}) VALUES ($1, ${insertValues})`;
                await query(insertSql, [newId, ...values]);

                console.log('  3. 更新关联表 (Course Arrangement)...');
                const updateCa = await query('UPDATE course_arrangement SET teacher_id = $1 WHERE teacher_id = $2', [newId, oldId]);
                console.log(`     更新了 ${updateCa.rowCount || updateCa.rows?.length || 0} 条课程记录`);

                console.log('  4. 更新关联表 (Teacher Availability)...');
                const updateAvail = await query('UPDATE teacher_daily_availability SET teacher_id = $1 WHERE teacher_id = $2', [newId, oldId]);
                console.log(`     更新了 ${updateAvail.rowCount || updateAvail.rows?.length || 0} 条可用性记录`);

                console.log('  5. 删除旧账号...');
                await query('DELETE FROM teachers WHERE id = $1', [oldId]);
            }

            // 3. 验证
            console.log('\n验证迁移结果...');
            const verifyIds = ID_MAPPING.map(m => m.newId);
            const verifyRes = await query(`SELECT id, name FROM teachers WHERE id = ANY($1::int[])`, [verifyIds]);
            console.log('当前存在的教师 ID:', verifyRes.rows.map(r => `${r.name}(${r.id})`).join(', '));

            if (verifyRes.rows.length !== ID_MAPPING.filter(m => m.oldId !== 999).length) { // 简单校验数量
                // 这里不做严格数量校验，因为可能有些旧 ID 本身就不存在
            }

        });

        console.log('\n✅ 教师 ID 迁移成功完成！');
    } catch (err) {
        console.error('\n❌ 迁移失败，事务已回滚。');
        console.error(err);
        process.exit(1);
    }
}

updateTeacherIds();
