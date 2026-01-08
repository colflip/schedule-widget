const fs = require('fs');
const path = require('path');
const db = require('../db/db');

function splitSqlStatements(sql) {
  const stmts = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inDollarTag = null; // e.g. $$ or $tag$
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    // Detect dollar-quoted string start/end
    if (!inSingle && !inDouble) {
      const dollarMatch = sql.slice(i).match(/^\$[A-Za-z_0-9]*\$/);
      if (dollarMatch) {
        const tag = dollarMatch[0];
        if (inDollarTag === null) {
          inDollarTag = tag;
        } else if (tag === inDollarTag) {
          inDollarTag = null;
        }
        buf += tag;
        i += tag.length - 1;
        continue;
      }
    }

    // Track normal quotes
    if (!inDollarTag) {
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
    }

    if (ch === ';' && !inSingle && !inDouble && !inDollarTag) {
      const trimmed = buf.trim();
      if (trimmed.length) stmts.push(trimmed);
      buf = '';
    } else {
      buf += ch;
    }
  }
  const tail = buf.trim();
  if (tail.length) stmts.push(tail);
  return stmts;
}

async function runMigration() {
  const migrationPath = path.join(__dirname, '../db/migrations/20251101_restructure.sql');
  try {
    console.log('读取迁移脚本:', migrationPath);
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    const statements = splitSqlStatements(sql);
    console.log('开始执行数据库架构重构迁移，共', statements.length, '条语句');
    for (const [idx, stmt] of statements.entries()) {
      try {
        await db.query(stmt);
        console.log(`OK [${idx + 1}/${statements.length}]`);
      } catch (e) {
        console.error(`ERR [${idx + 1}/${statements.length}]`, e?.code || e?.message || e);
        throw e;
      }
    }
    console.log('迁移执行完成');
  } catch (err) {
    console.error('迁移执行失败:', err);
    process.exitCode = 1;
  } finally {
    if (db.end) {
      await db.end();
    }
    process.exit();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
