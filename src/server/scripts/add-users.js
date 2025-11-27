const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function addUsers() {
  // 创建数据库连接
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('开始添加教师和学生用户...');
    
    // 为教师和学生生成密码哈希
    const salt = await bcrypt.genSalt(10);
    const teacherPasswordHash = await bcrypt.hash('123', salt);
    const studentPasswordHash = await bcrypt.hash('123', salt);
    
    // 添加教师用户
    const teacherResult = await pool.query(`
      INSERT INTO teachers (username, password_hash, name, email, phone, subject, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, username, name
    `, ['teach1', teacherPasswordHash, '张老师', 'teach1@example.com', '13800138001', '数学', '资深数学教师，有10年教学经验', true]);
    
    console.log('教师用户创建成功:', teacherResult.rows[0]);
    
    // 添加学生用户
    const studentResult = await pool.query(`
      INSERT INTO students (username, password_hash, name, email, phone, grade, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, username, name
    `, ['std1', studentPasswordHash, '李同学', 'std1@example.com', '13900139001', '一年级', true]);
    
    console.log('学生用户创建成功:', studentResult.rows[0]);
    
    console.log('所有用户添加完成');
  } catch (error) {
    console.error('添加用户失败:', error);
  } finally {
    // 关闭连接池
    await pool.end();
    console.log('数据库连接已关闭');
  }
}

// 执行函数
addUsers().catch(console.error);