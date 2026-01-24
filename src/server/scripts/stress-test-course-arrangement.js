const db = require('../db/db');

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return String(n).padStart(2, '0'); }

async function seedLarge(n = 20000) {
  console.log(`插入模拟排课记录 ${n} 条...`);
  const teacherId = 1; // 可调整
  const studentId = 1; // 可调整
  const base = new Date();
  const batches = 1000;
  const perBatch = Math.ceil(n / batches);

  for (let b = 0; b < batches; b++) {
    const values = [];
    const params = [];
    let p = 1;
    for (let i = 0; i < perBatch; i++) {
      const d = new Date(base.getTime() + randInt(-180, 180) * 86400000);
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const startH = randInt(8, 18);
      const endH = Math.min(startH + randInt(1, 2), 20);
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, 'pending')`);
      params.push(teacherId, studentId, dateStr, `${pad(startH)}:00:00`, `${pad(endH)}:00:00`);
    }
    const sql = `INSERT INTO course_arrangement (teacher_id, student_id, arr_date, start_time, end_time, status) VALUES ${values.join(',')}`;
    await db.query(sql, params);
    if ((b + 1) % 50 === 0) console.log(`进度: ${b + 1}/${batches}`);
  }
  console.log('插入完成');
}

async function runQueries() {
  console.log('执行典型查询以评估性能...');
  const start = Date.now();
  await db.query(`SELECT COUNT(*) FROM course_arrangement WHERE arr_date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE`);
  await db.query(`SELECT COUNT(*) FROM course_arrangement WHERE teacher_id = 1 AND arr_date BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE`);
  await db.query(`SELECT COUNT(*) FROM course_arrangement WHERE status = 'pending'`);
  const end = Date.now();
  console.log('查询耗时(ms):', end - start);
}

async function main() {
  try {
    const mode = process.argv[2] || 'run';
    if (mode === 'seed') {
      const n = parseInt(process.argv[3] || '20000', 10);
      await seedLarge(n);
    }
    await runQueries();
  } catch (e) {
    console.error('压力测试失败:', e);
  } finally {
    if (db.end) await db.end();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedLarge, runQueries };
