const { Pool } = require('pg');
require('dotenv').config();

async function checkTables() {
  // 创建数据库连接
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('开始检查administrators、teachers和students表结构...');
    
    // 检查teachers表结构
    console.log('\nTeachers表结构:');
    const teachersResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'teachers'
      ORDER BY ordinal_position;
    `);
    teachersResult.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}${row.character_maximum_length ? ` (${row.character_maximum_length})` : ''}`);
    });
    const teacherHasLastLogin = teachersResult.rows.some(r => r.column_name === 'last_login');
    console.log(`last_login字段（teachers）存在: ${teacherHasLastLogin}`);
    
    // 检查students表结构
    console.log('\nStudents表结构:');
    const studentsResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'students'
      ORDER BY ordinal_position;
    `);
    studentsResult.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}${row.character_maximum_length ? ` (${row.character_maximum_length})` : ''}`);
    });
    const studentHasLastLogin = studentsResult.rows.some(r => r.column_name === 'last_login');
    const teacherHasStatus = teachersResult.rows.some(r => r.column_name === 'status');
    const studentHasStatus = studentsResult.rows.some(r => r.column_name === 'status');
    console.log(`last_login字段（students）存在: ${studentHasLastLogin}`);
    console.log(`status字段（teachers）存在: ${teacherHasStatus}`);
    console.log(`status字段（students）存在: ${studentHasStatus}`);

    // 检查administrators表结构
    console.log('\nAdministrators表结构:');
    const adminsResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'administrators'
      ORDER BY ordinal_position;
    `);
    adminsResult.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}${row.character_maximum_length ? ` (${row.character_maximum_length})` : ''}`);
    });
    const adminHasLastLogin = adminsResult.rows.some(r => r.column_name === 'last_login');
    console.log(`last_login字段（administrators）存在: ${adminHasLastLogin}`);
  } catch (error) {
    console.error('检查表结构失败:', error);
  } finally {
    // 关闭连接池
    await pool.end();
    console.log('\n数据库连接已关闭');
  }
}

// 执行函数
checkTables().catch(console.error);
