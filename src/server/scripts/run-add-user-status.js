const fs = require('fs');
const path = require('path');
const db = require('../db/db');

const migrationFile = path.join(__dirname, '../db/migrations/20251107_add_user_status.sql');

function splitSqlStatements(sql) {
  const stmts = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inDollarTag = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (!inSingle && !inDouble) {
      const m = sql.slice(i).match(/^\$[A-Za-z_0-9]*\$/);
      if (m) {
        const tag = m[0];
        if (inDollarTag === null) inDollarTag = tag; else if (tag === inDollarTag) inDollarTag = null;
        buf += tag; i += tag.length - 1; continue;
      }
    }
    if (!inDollarTag) {
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
    }
    if (ch === ';' && !inSingle && !inDouble && !inDollarTag) {
      const t = buf.trim(); if (t.length) stmts.push(t); buf = '';
    } else { buf += ch; }
  }
  const tail = buf.trim(); if (tail.length) stmts.push(tail);
  return stmts;
}

async function runAddUserStatusMigration() {
  try {
    console.log('读取用户状态迁移脚本:', migrationFile);
    const sql = fs.readFileSync(migrationFile, 'utf-8');
    const statements = splitSqlStatements(sql);
    console.log('开始执行用户状态迁移，共', statements.length, '条语句');
    for (const [idx, stmt] of statements.entries()) {
      try {
        await db.query(stmt);
        console.log(`OK [${idx + 1}/${statements.length}]`);
      } catch (e) {
        console.error(`ERR [${idx + 1}/${statements.length}]`, e?.code || e?.message || e);
        throw e;
      }
    }
    console.log('用户状态迁移执行完成');
  } catch (err) {
    console.error('用户状态迁移执行失败:', err);
    process.exitCode = 1;
  } finally {
    if (db.end) await db.end();
    process.exit(0);
  }
}

if (require.main === module) {
  runAddUserStatusMigration();
}

module.exports = runAddUserStatusMigration;

