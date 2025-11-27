const { Pool } = require('pg');
require('dotenv').config();

async function createTables() {
  // 创建数据库连接
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('开始创建必要的表...');
    
    // 创建teachers表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('teachers表创建成功');
    
    // 创建students表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        grade VARCHAR(50),
        parent_name VARCHAR(100),
        parent_phone VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('students表创建成功');
    
    // 创建schedules表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER REFERENCES teachers(id),
        date DATE NOT NULL,
        time_slot VARCHAR(50),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_by INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('schedules表创建成功');
    
    // 创建schedule_students表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_students (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('schedule_students表创建成功');
    
    // 创建schedule_types表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('schedule_types表创建成功');
    
    // 创建schedule_types_relation表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_types_relation (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
        type_id INTEGER REFERENCES schedule_types(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('schedule_types_relation表创建成功');
    
    // 创建schedule_confirmations表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_confirmations (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
        confirmed_by INTEGER,
        user_type VARCHAR(20),
        confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('schedule_confirmations表创建成功');
    
    // 插入默认的排课类型
    await pool.query(`
      INSERT INTO schedule_types (name, description)
      VALUES 
        ('visit', '入户'),
        ('trial', '试教'),
        ('review', '评审'),
        ('review_record', '评审记录'),
        ('half_visit', '半次入户'),
        ('group_activity', '集体活动')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('默认排课类型插入成功');

    console.log('所有表创建完成');
  } catch (error) {
    console.error('创建表失败:', error);
  } finally {
    await pool.end();
    console.log('数据库连接已关闭');
  }
}

// 执行函数
createTables().catch(console.error);