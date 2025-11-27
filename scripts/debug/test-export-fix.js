#!/usr/bin/env node

/**
 * 导出功能修复验证脚本
 * 验证 schedule_types 表关联是否正确
 */

require('dotenv').config();

const db = require('./src/server/db/db');
const AdvancedExportService = require('./src/server/utils/advancedExportService');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function test() {
  console.log(`${colors.cyan}🧪 导出功能修复验证${colors.reset}\n`);
  
  try {
    // 第1步: 检查数据库表
    console.log(`${colors.blue}第1步: 检查数据库表是否存在${colors.reset}`);
    const tables = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('course_arrangement', 'schedule_types', 'teachers', 'students')
      ORDER BY table_name
    `);
    
    if (tables.rows.length < 4) {
      console.log(`${colors.yellow}⚠️  警告: 缺少必要的表${colors.reset}`);
      tables.rows.forEach(t => console.log(`  ✅ ${t.table_name}`));
      process.exit(1);
    }
    console.log(`${colors.green}✅ 所有必要表都存在${colors.reset}`);
    tables.rows.forEach(t => console.log(`  ✓ ${t.table_name}`));
    console.log();

    // 第2步: 检查 course_arrangement 表的日期列
    console.log(`${colors.blue}第2步: 检查 course_arrangement 表的日期列${colors.reset}`);
    const dateColumns = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'course_arrangement' 
      AND column_name IN ('arr_date', 'class_date', 'date')
      ORDER BY column_name
    `);
    
    if (dateColumns.rows.length === 0) {
      console.log(`${colors.red}❌ 错误: course_arrangement 表没有日期列${colors.reset}`);
      process.exit(1);
    }
    console.log(`${colors.green}✅ 日期列检查完成${colors.reset}`);
    dateColumns.rows.forEach(col => console.log(`  ✓ ${col.column_name}`));
    console.log();

    // 第3步: 检查 schedule_types 表
    console.log(`${colors.blue}第3步: 检查 schedule_types 表${colors.reset}`);
    const scheduleTypes = await db.query(`
      SELECT COUNT(*) as count FROM schedule_types
    `);
    
    console.log(`${colors.green}✅ schedule_types 表记录数: ${scheduleTypes.rows[0].count}${colors.reset}`);
    console.log();

    // 第4步: 检查 course_arrangement 和 schedule_types 的关联
    console.log(`${colors.blue}第4步: 检查 course_arrangement 和 schedule_types 的关联${colors.reset}`);
    const dateCol = dateColumns.rows[0].column_name;
    const joinTest = await db.query(`
      SELECT 
        ca.id,
        ca.course_id,
        st.name as type_name,
        ca.${dateCol} as date
      FROM course_arrangement ca
      LEFT JOIN schedule_types st ON ca.course_id = st.id
      LIMIT 3
    `);
    
    if (joinTest.rows.length === 0) {
      console.log(`${colors.yellow}⚠️  警告: course_arrangement 表中没有数据${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ 关联查询成功, 找到 ${joinTest.rows.length} 条记录${colors.reset}`);
      joinTest.rows.forEach((row, idx) => {
        console.log(`  记录 ${idx + 1}: ID=${row.id}, course_id=${row.course_id}, type=${row.type_name}, date=${row.date}`);
      });
    }
    console.log();

    // 第5步: 初始化导出服务
    console.log(`${colors.blue}第5步: 初始化导出服务${colors.reset}`);
    const service = new AdvancedExportService(db);
    console.log(`${colors.green}✅ 导出服务初始化成功${colors.reset}`);
    console.log();

    // 第6步: 测试教师排课导出 SQL
    console.log(`${colors.blue}第6步: 测试教师排课导出查询${colors.reset}`);
    const startDate = '2025-11-01';
    const endDate = '2025-11-15';
    
    try {
      const teacherSchedules = await service.exportTeacherSchedule(startDate, endDate);
      console.log(`${colors.green}✅ 教师排课导出查询成功${colors.reset}`);
      console.log(`   找到 ${teacherSchedules.length} 条记录 (日期范围: ${startDate} 至 ${endDate})`);
      
      if (teacherSchedules.length > 0) {
        console.log(`   第一条记录:`);
        const record = teacherSchedules[0];
        console.log(`     - schedule_id: ${record.schedule_id}`);
        console.log(`     - teacher_name: ${record.teacher_name}`);
        console.log(`     - student_name: ${record.student_name}`);
        console.log(`     - type: ${record.type}`);
        console.log(`     - date: ${record.date}`);
      }
    } catch (err) {
      console.log(`${colors.red}❌ 教师排课导出查询失败: ${err.message}${colors.reset}`);
      if (err.message.includes('relation')) {
        console.log(`${colors.red}   错误原因: 数据库表关联问题${colors.reset}`);
      }
      throw err;
    }
    console.log();

    // 第7步: 测试学生排课导出
    console.log(`${colors.blue}第7步: 测试学生排课导出查询${colors.reset}`);
    try {
      const studentSchedules = await service.exportStudentSchedule(startDate, endDate);
      console.log(`${colors.green}✅ 学生排课导出查询成功${colors.reset}`);
      console.log(`   找到 ${studentSchedules.length} 条记录 (日期范围: ${startDate} 至 ${endDate})`);
      
      if (studentSchedules.length > 0) {
        console.log(`   第一条记录:`);
        const record = studentSchedules[0];
        console.log(`     - schedule_id: ${record.schedule_id}`);
        console.log(`     - student_name: ${record.student_name}`);
        console.log(`     - teacher_name: ${record.teacher_name}`);
        console.log(`     - type: ${record.type}`);
        console.log(`     - date: ${record.date}`);
      }
    } catch (err) {
      console.log(`${colors.red}❌ 学生排课导出查询失败: ${err.message}${colors.reset}`);
      throw err;
    }
    console.log();

    // 第8步: 测试 Excel 格式转换
    console.log(`${colors.blue}第8步: 测试 Excel 格式转换${colors.reset}`);
    try {
      const result = await service.execute('teacher_schedule', 'excel', startDate, endDate);
      console.log(`${colors.green}✅ Excel 格式转换成功${colors.reset}`);
      console.log(`   文件名: ${result.filename}`);
      console.log(`   格式: ${result.format}`);
      console.log(`   数据条数: ${Array.isArray(result.data) ? result.data.length : '无法统计'}`);
    } catch (err) {
      console.log(`${colors.red}❌ Excel 格式转换失败: ${err.message}${colors.reset}`);
      throw err;
    }
    console.log();

    // 第9步: 测试 CSV 格式转换
    console.log(`${colors.blue}第9步: 测试 CSV 格式转换${colors.reset}`);
    try {
      const result = await service.execute('teacher_schedule', 'csv', startDate, endDate);
      console.log(`${colors.green}✅ CSV 格式转换成功${colors.reset}`);
      console.log(`   文件名: ${result.filename}`);
      console.log(`   格式: ${result.format}`);
      console.log(`   数据大小: ${result.data.length} 字节`);
      // 显示前100个字符
      console.log(`   数据预览: ${result.data.substring(0, 100)}...`);
    } catch (err) {
      console.log(`${colors.red}❌ CSV 格式转换失败: ${err.message}${colors.reset}`);
      throw err;
    }
    console.log();

    console.log(`${colors.bright}${colors.green}✅ 所有测试通过! 导出功能修复验证完成${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}${colors.bright}❌ 测试失败${colors.reset}:`, error.message);
    if (error.stack) {
      console.error(`${colors.red}堆栈跟踪:${colors.reset}`);
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

test();
