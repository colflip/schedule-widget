const fs = require('fs');
const path = require('path');
const db = require('../db/db');

async function exec(query) {
  try {
    await db.query(query);
    console.log('OK:', query.split('\n')[0]);
  } catch (err) {
    console.warn('WARN:', err.code || err.message);
  }
}

const EMAIL_RE = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$";

async function runMigration() {
  try {
    console.log('开始执行管理员邮箱迁移(逐条语句)...');

    // 1) 添加 email 列（若不存在）
    await exec("ALTER TABLE administrators ADD COLUMN IF NOT EXISTS email VARCHAR(255);");

    // 2) 为已存在记录填充 email（确保非空且格式正确的占位值）
    await exec("UPDATE administrators SET email = 'admin@example.com' WHERE username = 'admin' AND (email IS NULL OR email = '');");
    await exec("UPDATE administrators SET email = username || '@example.com' WHERE (email IS NULL OR email = '') AND username IS NOT NULL AND username <> 'admin';");

    // 2.1) 清洗：去空白、统一小写、去除字符串中的单引号
    await exec("UPDATE administrators SET email = lower(trim(email));");
    await exec("UPDATE administrators SET email = replace(email, '''', '') WHERE email LIKE '%''%';");

    // 2.2) 对不符合格式的历史数据，生成兼容邮箱（user-<id>@example.com）
    await exec(`UPDATE administrators SET email = 'user-' || id || '@example.com' WHERE NOT (email ~* '${EMAIL_RE}');`);

    // 3) 添加格式校验约束（若不存在，若已存在则忽略错误）
    await exec(`ALTER TABLE administrators ADD CONSTRAINT administrators_email_format CHECK (email ~* '${EMAIL_RE}');`);

    // 4) 添加唯一索引（若不存在）
    await exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_administrators_email_unique ON administrators(email);");

    // 5) 尝试添加唯一约束（若已存在或与索引冲突则忽略错误）
    await exec("ALTER TABLE administrators ADD CONSTRAINT administrators_email_unique UNIQUE(email);");

    // 6) 将 email 设置为 NOT NULL
    await exec("ALTER TABLE administrators ALTER COLUMN email SET NOT NULL;");

    // 7) 再次校正不合规数据（如仍存在不匹配，保持兼容）
    await exec(`UPDATE administrators SET email = 'user-' || id || '@example.com' WHERE NOT (email ~* '${EMAIL_RE}');`);

    // 8) 若之前因数据不合规导致约束未能创建，则重试一次（先删后建）
    await exec("ALTER TABLE administrators DROP CONSTRAINT IF EXISTS administrators_email_format;");
    await exec(`ALTER TABLE administrators ADD CONSTRAINT administrators_email_format CHECK (email ~* '${EMAIL_RE}');`);

    console.log('迁移执行完成');
  } catch (err) {
    console.error('迁移执行失败:', err);
    process.exitCode = 1;
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;