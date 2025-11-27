const db = require('../db/db');

const TABLES = [
  'administrators',
  'teachers',
  'students',
  'teacher_availability',
  'student_availability',
  'schedule_types',
  'schedules',
  'schedule_students',
  'schedule_types_relation',
  'schedule_confirmations',
];

async function fetchColumns(table) {
  const q = `
    SELECT column_name, data_type, is_nullable, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `;
  const res = await db.query(q, [table]);
  return res.rows || [];
}

async function fetchIndexes(table) {
  const q = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
    ORDER BY indexname
  `;
  const res = await db.query(q, [table]);
  return res.rows || [];
}

async function inspect() {
  try {
    console.log('开始检查远程数据库表结构与索引');

    for (const table of TABLES) {
      console.log(`\n表: ${table}`);
      const cols = await fetchColumns(table);
      if (!cols.length) {
        console.log('  未找到列（表可能不存在）');
      } else {
        for (const c of cols) {
          const len = c.character_maximum_length ? `(${c.character_maximum_length})` : '';
          console.log(`  ${c.column_name}: ${c.data_type}${len} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        }
      }
      const idx = await fetchIndexes(table);
      if (idx.length) {
        console.log('  索引:');
        idx.forEach(i => console.log(`    ${i.indexname}: ${i.indexdef}`));
      }
    }

    // 额外检查：关键列是否存在
    const schedulesCols = await fetchColumns('schedules');
    const schedulesColNames = new Set(schedulesCols.map(c => c.column_name));
    console.log('\n关键列存在性检查 (schedules):');
    ['teacher_id', 'location', 'updated_at', 'status', 'date', 'time_slot'].forEach(k => {
      console.log(`  ${k}: ${schedulesColNames.has(k)}`);
    });

    console.log('\n检查完成');
  } catch (err) {
    console.error('检查失败:', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  inspect().then(() => process.exit());
}

module.exports = inspect;