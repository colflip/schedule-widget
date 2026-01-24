const fs = require('fs');
const path = require('path');
const db = require('../db/db');

function getRetentionInterval() {
  const days = parseInt(process.env.DAILY_AVAILABILITY_RETENTION_DAYS || '30', 10);
  if (Number.isNaN(days) || days <= 0) return '30 days';
  return `${days} days`;
}

async function runCleanup() {
  const retention = getRetentionInterval();
  try {
    console.log('开始每日可用时间清理...');
    console.log('保留期:', retention);

    // 使用参数化间隔执行删除以避免 SQL 注入
    const delTeacher = `
      DELETE FROM teacher_daily_availability
      WHERE date < CURRENT_DATE - ($1 || '')::interval;
    `;
    const delStudent = `
      DELETE FROM student_daily_availability
      WHERE date < CURRENT_DATE - ($1 || '')::interval;
    `;

    const tRes = await db.query(delTeacher, [retention]);
    console.log('教师记录删除行数:', tRes.rowCount);
    const sRes = await db.query(delStudent, [retention]);
    console.log('学生记录删除行数:', sRes.rowCount);

    // 防止索引膨胀：清理后执行 VACUUM (ANALYZE)
    await db.query('VACUUM (ANALYZE, VERBOSE) teacher_daily_availability');
    await db.query('VACUUM (ANALYZE, VERBOSE) student_daily_availability');
    console.log('VACUUM 完成');

    console.log('每日清理完成');
  } catch (err) {
    console.error('每日清理失败:', err);
    process.exitCode = 1;
  } finally {
    if (db.end) {
      await db.end();
    }
    process.exit(0);
  }
}

if (require.main === module) {
  runCleanup();
}

module.exports = runCleanup;
