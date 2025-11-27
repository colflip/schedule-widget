const db = require('../db/db');

async function addUniqueIndexForConfirmations() {
  try {
    console.log('检查 schedule_confirmations(schedule_id) 唯一索引...');

    // 检查是否已存在唯一索引/约束
    const existing = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'schedule_confirmations'
        AND indexdef ILIKE '%UNIQUE% (schedule_id)';
    `);

    if (existing.rows && existing.rows.length > 0) {
      console.log('唯一索引已存在：', existing.rows[0].indexname);
      return;
    }

    // 处理可能存在的重复记录（保留最新一条）
    console.log('检测并清理重复的 schedule_id 记录...');
    await db.query(`
      WITH ranked AS (
        SELECT id, schedule_id,
               ROW_NUMBER() OVER (
                 PARTITION BY schedule_id
                 ORDER BY COALESCE(admin_confirmation_time, teacher_confirmation_time, created_at) DESC, id DESC
               ) AS rn
        FROM schedule_confirmations
      )
      DELETE FROM schedule_confirmations
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);

    // 创建唯一索引
    console.log('创建唯一索引 idx_schedule_confirmations_schedule...');
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_confirmations_schedule
      ON schedule_confirmations (schedule_id);
    `);

    console.log('唯一索引创建完成');
  } catch (error) {
    console.error('创建唯一索引失败:', error);
    throw error;
  }
}

if (require.main === module) {
  addUniqueIndexForConfirmations()
    .then(() => {
      console.log('脚本执行成功');
      process.exit(0);
    })
    .catch(err => {
      console.error('脚本执行失败:', err);
      process.exit(1);
    });
}

module.exports = addUniqueIndexForConfirmations;