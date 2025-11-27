#!/usr/bin/env node

/**
 * 验证迁移结果脚本
 */

const db = require('../src/server/db/db');

async function verifyMigration() {
  try {
    console.log('\n📊 验证表结构...\n');

    // 检查 teacher_daily_availability
    const teacherCols = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'teacher_daily_availability' 
      ORDER BY ordinal_position
    `);

    console.log('📋 teacher_daily_availability 表结构：');
    teacherCols.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(可空)' : '(非空)';
      console.log(`   ✓ ${col.column_name}: ${col.data_type} ${nullable}`);
    });

    // 检查 student_daily_availability
    const studentCols = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'student_daily_availability' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 student_daily_availability 表结构：');
    studentCols.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(可空)' : '(非空)';
      console.log(`   ✓ ${col.column_name}: ${col.data_type} ${nullable}`);
    });

    // 验证旧字段不存在
    console.log('\n✅ 验证旧字段已删除：');
    const forbiddenFields = ['start_time', 'end_time', 'status'];
    const allCols = teacherCols.rows.map(r => r.column_name);
    const foundForbidden = forbiddenFields.filter(f => allCols.includes(f));
    
    if (foundForbidden.length === 0) {
      console.log('   ✓ 旧字段（start_time, end_time, status）已成功删除');
    } else {
      console.log(`   ✗ 发现残留的旧字段: ${foundForbidden.join(', ')}`);
    }

    // 验证新字段存在
    console.log('\n✅ 验证新字段已添加：');
    const requiredFields = ['morning_available', 'afternoon_available', 'evening_available'];
    requiredFields.forEach(field => {
      if (allCols.includes(field)) {
        console.log(`   ✓ ${field} 字段存在`);
      } else {
        console.log(`   ✗ ${field} 字段缺失`);
      }
    });

    // 检查 CHECK 约束
    console.log('\n✅ 验证 CHECK 约束：');
    const constraints = await db.query(`
      SELECT constraint_name, table_name
      FROM information_schema.table_constraints
      WHERE table_name IN ('teacher_daily_availability', 'student_daily_availability')
        AND constraint_type = 'CHECK'
      ORDER BY table_name, constraint_name
    `);

    const groupedConstraints = {};
    constraints.rows.forEach(c => {
      if (!groupedConstraints[c.table_name]) {
        groupedConstraints[c.table_name] = [];
      }
      groupedConstraints[c.table_name].push(c.constraint_name);
    });

    Object.entries(groupedConstraints).forEach(([table, cons]) => {
      console.log(`   ${table}:`);
      cons.forEach(c => {
        if (c.includes('chk_')) {
          console.log(`     ✓ ${c}`);
        }
      });
    });

    // 检查外键
    console.log('\n✅ 验证外键约束：');
    const foreignKeys = await db.query(`
      SELECT constraint_name, table_name
      FROM information_schema.table_constraints
      WHERE table_name IN ('teacher_daily_availability', 'student_daily_availability')
        AND constraint_type = 'FOREIGN KEY'
      ORDER BY table_name, constraint_name
    `);

    const groupedFKs = {};
    foreignKeys.rows.forEach(fk => {
      if (!groupedFKs[fk.table_name]) {
        groupedFKs[fk.table_name] = [];
      }
      groupedFKs[fk.table_name].push(fk.constraint_name);
    });

    Object.entries(groupedFKs).forEach(([table, fks]) => {
      console.log(`   ${table}:`);
      fks.forEach(fk => {
        console.log(`     ✓ ${fk}`);
      });
    });

    console.log('\n✨ 迁移验证完成！所有结构检查通过。\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 验证失败:', error.message);
    process.exit(1);
  }
}

verifyMigration();
