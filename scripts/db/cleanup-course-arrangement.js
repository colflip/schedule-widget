/*
 * 课程安排表清理脚本（安全版）
 * - 备份当前数据到备份表
 * - 使用事务删除指定表数据
 * - 验证删除结果并输出总结
 *
 * 运行：
 *   node scripts/cleanup-course_arrangement.js
 * 需要环境变量：DATABASE_URL 或 DB_DRIVER=pg/neon
 */

const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('缺少 DATABASE_URL 环境变量，无法连接数据库。');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  const now = new Date();
  const suffix = now
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const backupTable = `course_arrangement_backup_${suffix}`;

  console.log(`开始清理 course_arrangement 表，备份到 ${backupTable}`);

  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL timezone TO 'Asia/Shanghai'");

    // 1) 创建备份表（结构+数据）
    // 保留表结构与索引（只复制结构），再插入数据
    await client.query(
      `CREATE TABLE ${backupTable} (LIKE course_arrangement INCLUDING ALL)`
    );
    const { rowCount: backupRows } = await client.query(
      `INSERT INTO ${backupTable} SELECT * FROM course_arrangement`
    );
    console.log(`已备份 ${backupRows} 行到 ${backupTable}`);

    // 2) 删除数据（仅 course_arrangement 表）
    const delRes = await client.query('DELETE FROM course_arrangement');
    console.log(`删除 course_arrangement 行数：${delRes.rowCount}`);

    // 3) 验证是否为空
    const countRes = await client.query('SELECT COUNT(*)::int AS cnt FROM course_arrangement');
    const remaining = countRes.rows[0]?.cnt ?? -1;

    if (remaining === 0) {
      await client.query('COMMIT');
      console.log('清理成功，course_arrangement 表已为空。');
      console.log(`备份表：${backupTable}`);
    } else {
      await client.query('ROLLBACK');
      console.error(`清理失败，仍有 ${remaining} 行残留，已回滚。`);
      process.exitCode = 2;
    }
  } catch (err) {
    console.error('执行清理出现错误，事务回滚：', err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

