#!/usr/bin/env node

/**
 * 演示脚本：展示新的 daily_availability 表结构使用
 */

const db = require('../src/server/db/db');

async function demonstrateNewStructure() {
  try {
    console.log('\n📚 演示新的 daily_availability 表结构\n');

    // 1. 创建测试用户
    console.log('📝 1. 创建测试教师和学生...\n');
    
    const teacherResult = await db.query(
      'INSERT INTO teachers (username, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING id',
      ['test_teacher', 'test_hash', 'Test Teacher']
    );
    const teacherId = teacherResult.rows[0].id;
    console.log(`✓ 教师已创建，ID: ${teacherId}`);

    const studentResult = await db.query(
      'INSERT INTO students (username, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING id',
      ['test_student', 'test_hash', 'Test Student']
    );
    const studentId = studentResult.rows[0].id;
    console.log(`✓ 学生已创建，ID: ${studentId}`);

    // 2. 插入测试数据
    console.log('\n📝 2. 插入可用性数据...\n');
    
    const insertTeacher = await db.query(
      'INSERT INTO teacher_daily_availability (teacher_id, date, morning_available, afternoon_available, evening_available) VALUES ($1, CURRENT_DATE, 1, 1, 0) ON CONFLICT (teacher_id, date) DO UPDATE SET morning_available=EXCLUDED.morning_available, afternoon_available=EXCLUDED.afternoon_available, evening_available=EXCLUDED.evening_available RETURNING *',
      [teacherId]
    );
    console.log('✓ 教师可用性记录:', JSON.stringify(insertTeacher.rows[0], null, 2));

    const insertStudent = await db.query(
      'INSERT INTO student_daily_availability (student_id, date, morning_available, afternoon_available, evening_available) VALUES ($1, CURRENT_DATE, 0, 1, 1) ON CONFLICT (student_id, date) DO UPDATE SET morning_available=EXCLUDED.morning_available, afternoon_available=EXCLUDED.afternoon_available, evening_available=EXCLUDED.evening_available RETURNING *',
      [studentId]
    );
    console.log('\n✓ 学生可用性记录:', JSON.stringify(insertStudent.rows[0], null, 2));

    // 3. 查询测试数据
    console.log('\n\n📖 3. 查询可用时段...\n');
    
    const queryTeacher = await db.query(
      `SELECT teacher_id, date, 
        CASE WHEN morning_available = 1 THEN '上午' END as morning,
        CASE WHEN afternoon_available = 1 THEN '下午' END as afternoon,
        CASE WHEN evening_available = 1 THEN '晚上' END as evening
      FROM teacher_daily_availability 
      WHERE teacher_id = $1 AND date = CURRENT_DATE`,
      [teacherId]
    );
    console.log(`✓ 教师 ID=${teacherId} 的可用时段:`);
    if (queryTeacher.rows.length > 0) {
      const teacher = queryTeacher.rows[0];
      const slots = [];
      if (teacher.morning) slots.push(teacher.morning);
      if (teacher.afternoon) slots.push(teacher.afternoon);
      if (teacher.evening) slots.push(teacher.evening);
      console.log(`  ${slots.join(', ') || '无可用时段'}`);
    }

    const queryStudent = await db.query(
      `SELECT student_id, date,
        CASE WHEN morning_available = 1 THEN '上午' END as morning,
        CASE WHEN afternoon_available = 1 THEN '下午' END as afternoon,
        CASE WHEN evening_available = 1 THEN '晚上' END as evening
      FROM student_daily_availability 
      WHERE student_id = $1 AND date = CURRENT_DATE`,
      [studentId]
    );
    console.log(`\n✓ 学生 ID=${studentId} 的可用时段:`);
    if (queryStudent.rows.length > 0) {
      const student = queryStudent.rows[0];
      const slots = [];
      if (student.morning) slots.push(student.morning);
      if (student.afternoon) slots.push(student.afternoon);
      if (student.evening) slots.push(student.evening);
      console.log(`  ${slots.join(', ') || '无可用时段'}`);
    }

    // 4. 查询特定条件的数据
    console.log('\n\n📋 4. 查询特定时段的人员...\n');
    
    const morningTeachers = await db.query(
      'SELECT teacher_id FROM teacher_daily_availability WHERE date = CURRENT_DATE AND morning_available = 1 LIMIT 5'
    );
    console.log(`✓ 今天上午有可用时段的教师: ${morningTeachers.rows.length} 人`);

    const afternoonStudents = await db.query(
      'SELECT student_id FROM student_daily_availability WHERE date = CURRENT_DATE AND afternoon_available = 1 LIMIT 5'
    );
    console.log(`✓ 今天下午有可用时段的学生: ${afternoonStudents.rows.length} 人`);

    // 5. 检查 CHECK 约束
    console.log('\n\n✅ 5. 验证 CHECK 约束...\n');
    try {
      await db.query(
        'INSERT INTO teacher_daily_availability (teacher_id, date, morning_available, afternoon_available, evening_available) VALUES ($1, CURRENT_DATE + INTERVAL \'1 day\', 2, 1, 0)',
        [teacherId]
      );
      console.log('✗ CHECK 约束失效！（不应该允许值为 2）');
    } catch (error) {
      console.log('✓ CHECK 约束正确工作：拒绝了无效值 (2)');
      const msg = error.message.split('\n')[0];
      console.log(`  错误: ${msg}`);
    }

    // 6. 清理测试数据
    console.log('\n\n🧹 6. 清理测试数据...\n');
    await db.query(
      'DELETE FROM teacher_daily_availability WHERE teacher_id = $1 AND date = CURRENT_DATE',
      [teacherId]
    );
    await db.query(
      'DELETE FROM student_daily_availability WHERE student_id = $1 AND date = CURRENT_DATE',
      [studentId]
    );
    console.log('✓ 测试数据已清理');

    console.log('\n✨ 演示完成！\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 演示失败:', error.message);
    if (error.detail) {
      console.error('   详情:', error.detail);
    }
    process.exit(1);
  }
}

demonstrateNewStructure();
