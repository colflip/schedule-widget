const db = require('../db/db');

async function runWeeklyAnalyze() {
  try {
    console.log('开始执行每周 ANALYZE 计划...');
    const statements = [
      'ANALYZE course_arrangement',
      'ANALYZE teacher_daily_availability',
      'ANALYZE student_daily_availability',
      'ANALYZE teachers',
      'ANALYZE students',
      'ANALYZE schedule_types',
      'ANALYZE administrators'
    ];

    for (const [i, stmt] of statements.entries()) {
      try {
        console.log(`执行 ${i + 1}/${statements.length}: ${stmt}`);
        await db.query(stmt);
        console.log('✓ 完成');
      } catch (e) {
        console.warn(`✗ 失败: ${stmt}`, e?.message || e);
      }
    }
    console.log('每周 ANALYZE 完成');
  } catch (err) {
    console.error('执行失败:', err);
    process.exitCode = 1;
  } finally {
    if (db.end) {
      await db.end();
    }
    process.exit(0);
  }
}

if (require.main === module) {
  runWeeklyAnalyze();
}

module.exports = runWeeklyAnalyze;
