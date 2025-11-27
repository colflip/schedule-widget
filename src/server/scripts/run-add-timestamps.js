// 执行新的迁移脚本
const db = require('../db/db');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  try {
    // 读取迁移 SQL
    const sql = await fs.readFile(
      path.join(__dirname, '../db/migrations/20251110_add_timestamps.sql'),
      'utf8'
    );

    // 执行 SQL
    await db.query(sql);
    console.log('迁移成功：添加更新时间字段');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

runMigration().then(() => {
  console.log('迁移完成');
  process.exit(0);
});