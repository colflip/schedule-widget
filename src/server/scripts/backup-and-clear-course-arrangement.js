const db = require('../db/db');
require('dotenv').config();

function tsSuffix(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

async function ensureLogsTable() {
  const q = `
    CREATE TABLE IF NOT EXISTS operation_logs (
      id SERIAL PRIMARY KEY,
      operation VARCHAR(100) NOT NULL,
      detail TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(100)
    );
  `;
  await db.query(q);
}

async function backupAndClear() {
  const operator = process.env.OPERATOR || 'script';
  const suffix = tsSuffix();
  const backupTable = `course_arrangement_backup_${suffix}`;

  console.log('开始安全清空排课表（course_arrangement）操作');
  try {
    await db.runInTransaction(async (client, usePool) => {
      const q = usePool ? db.query : client.query.bind(client);
      // 日志表确保存在
      await ensureLogsTable();

      // 创建备份表，保留全部结构与数据
      console.log(`创建备份表: ${backupTable}`);
      await q(`CREATE TABLE ${backupTable} AS TABLE course_arrangement`);

      const backupCountRes = await q(`SELECT COUNT(*)::int AS cnt FROM ${backupTable}`);
      const backupCount = (backupCountRes.rows[0] && backupCountRes.rows[0].cnt) || 0;
      console.log(`备份完成，记录数: ${backupCount}`);

      // 执行删除
      console.log('执行删除: DELETE FROM course_arrangement');
      await q('DELETE FROM course_arrangement');

      // 验证表是否为空
      const verifyRes = await q('SELECT COUNT(*)::int AS cnt FROM course_arrangement');
      const remainCount = (verifyRes.rows[0] && verifyRes.rows[0].cnt) || 0;
      if (remainCount !== 0) {
        throw new Error(`删除后剩余记录数为 ${remainCount}，将回滚事务`);
      }

      // 记录操作日志
      const detail = `备份表: ${backupTable}, 备份记录数: ${backupCount}, 删除目标表: course_arrangement`;
      await q(
        'INSERT INTO operation_logs(operation, detail, created_by) VALUES ($1, $2, $3)',
        ['backup_and_clear_course_arrangement', detail, operator]
      );

      console.log('操作成功完成并已提交事务');
    });
  } catch (err) {
    console.error('操作失败，事务已回滚或发生错误:', err?.message || err);
    process.exitCode = 1;
  } finally {
    // 结束进程
    process.exit(0);
  }
}

if (require.main === module) {
  backupAndClear();
}

module.exports = backupAndClear;

