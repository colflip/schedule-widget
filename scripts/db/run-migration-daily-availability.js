#!/usr/bin/env node

/**
 * 运行数据库迁移脚本
 * 用途：将 teacher_daily_availability 和 student_daily_availability 表从
 * start_time/end_time/status 字段重新设计为 morning_available/afternoon_available/evening_available 字段
 * 
 * 使用方法：
 *   export DATABASE_URL="postgresql://user:pass@host:port/dbname"
 *   node scripts/run-migration-daily-availability.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/server/db/db');

// 读取迁移 SQL 文件
const MIGRATION_SQL_FILE = path.join(__dirname, '../src/server/db/migrations/20251111_redesign_daily_availability.sql');
const BACKUP_DIR = path.join(__dirname, '../backups/migrations/20251111');

async function runMigration() {
  try {
    // 验证 DATABASE_URL
    if (!process.env.DATABASE_URL) {
      console.error('❌ ERROR: DATABASE_URL 环境变量未设置');
      console.error('请先执行: export DATABASE_URL="your-database-url"');
      process.exit(1);
    }

    console.log('📋 开始执行数据库迁移...');
    console.log(`📁 迁移文件: ${MIGRATION_SQL_FILE}`);

    // 检查文件是否存在
    if (!fs.existsSync(MIGRATION_SQL_FILE)) {
      console.error(`❌ 错误：迁移文件不存在 ${MIGRATION_SQL_FILE}`);
      process.exit(1);
    }

    // 创建备份目录
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`✅ 创建备份目录: ${BACKUP_DIR}`);
    }

    // 备份数据
    console.log('💾 备份原始数据...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `availability_backup_${timestamp}.json`);

    try {
      // 备份 teacher_daily_availability
      const teacherData = await db.query('SELECT * FROM teacher_daily_availability');
      
      // 备份 student_daily_availability
      const studentData = await db.query('SELECT * FROM student_daily_availability');

      const backupData = {
        timestamp: new Date().toISOString(),
        teacher_daily_availability: teacherData.rows,
        student_daily_availability: studentData.rows,
      };

      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      console.log(`✅ 备份完成: ${backupFile}`);
      console.log(`   - teacher_daily_availability: ${teacherData.rows.length} 行`);
      console.log(`   - student_daily_availability: ${studentData.rows.length} 行`);
    } catch (backupError) {
      console.warn(`⚠️  备份失败（继续执行迁移）: ${backupError.message}`);
    }

    // 读取并执行迁移 SQL
    const migrationSQL = fs.readFileSync(MIGRATION_SQL_FILE, 'utf-8');
    
    console.log('\n⚙️  执行迁移 SQL...');
    
    // 使用原生连接执行完整的 SQL 文件，而不是 query 方法
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    try {
      // 执行整个 SQL 文件（支持多个命令）
      await client.query(migrationSQL);
      console.log('✅ 迁移 SQL 执行成功');
    } finally {
      client.release();
      await pool.end();
    }

    // 验证迁移结果
    console.log('\n🔍 验证迁移结果...');
    
    // 检查 teacher_daily_availability 表结构
    const teacherColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'teacher_daily_availability' 
      ORDER BY ordinal_position
    `);

    console.log('\n📊 teacher_daily_availability 表结构:');
    teacherColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    // 检查 student_daily_availability 表结构
    const studentColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'student_daily_availability' 
      ORDER BY ordinal_position
    `);

    console.log('\n📊 student_daily_availability 表结构:');
    studentColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    // 验证数据
    const teacherData = await db.query('SELECT COUNT(*) FROM teacher_daily_availability');
    const studentData = await db.query('SELECT COUNT(*) FROM student_daily_availability');

    console.log('\n📈 数据统计:');
    console.log(`   - teacher_daily_availability: ${teacherData.rows[0].count} 行`);
    console.log(`   - student_daily_availability: ${studentData.rows[0].count} 行`);

    // 检查约束
    const constraints = await db.query(`
      SELECT constraint_name, table_name
      FROM information_schema.table_constraints
      WHERE (table_name = 'teacher_daily_availability' OR table_name = 'student_daily_availability')
        AND constraint_type = 'CHECK'
      ORDER BY table_name, constraint_name
    `);

    console.log('\n✅ CHECK 约束:');
    constraints.rows.forEach(c => {
      console.log(`   - ${c.table_name}: ${c.constraint_name}`);
    });

    console.log('\n✨ 迁移完成成功！');
    console.log(`   📁 备份保存路径: ${backupFile}`);
    console.log('   ⚠️  如需回滚，请使用备份数据进行恢复');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    if (error.detail) {
      console.error('   详情:', error.detail);
    }
    process.exit(1);
  }
}

// 执行迁移
runMigration().catch(err => {
  console.error('未捕获的错误:', err);
  process.exit(1);
});
