#!/usr/bin/env node

/**
 * 为新字段添加 NOT NULL 约束
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATION_SQL_FILE = path.join(__dirname, '../src/server/db/migrations/20251111_add_not_null_constraints.sql');

async function applyConstraints() {
  try {
    console.log('📋 为新字段添加 NOT NULL 约束...\n');

    if (!process.env.DATABASE_URL) {
      console.error('❌ ERROR: DATABASE_URL 环境变量未设置');
      process.exit(1);
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    try {
      const migrationSQL = fs.readFileSync(MIGRATION_SQL_FILE, 'utf-8');
      await client.query(migrationSQL);
      console.log('✅ NOT NULL 约束添加成功');
    } finally {
      client.release();
      await pool.end();
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

applyConstraints();
