const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

async function createAdminUser() {
  // 创建数据库连接
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // 检查administrators表是否存在
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'administrators'
      );
    `);
    
    // 如果表不存在，创建表
    if (!tableCheck.rows[0].exists) {
      console.log('创建administrators表...');
      await pool.query(`
        CREATE TABLE administrators (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255),
          permission_level INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('administrators表创建成功');
    }

    // 检查是否已存在管理员账户
    const adminCheck = await pool.query(`
      SELECT * FROM administrators WHERE username = 'admin';
    `);

    if (adminCheck.rows.length > 0) {
      console.log('管理员账户已存在，更新密码...');
      
      // 创建密码哈希
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('123456', salt);
      
      // 更新管理员密码
      await pool.query(`
        UPDATE administrators 
        SET password_hash = $1 
        WHERE username = 'admin'
      `, [passwordHash]);
      
      console.log('管理员密码已更新');
    } else {
      console.log('创建新管理员账户...');
      
      // 创建密码哈希
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('123456', salt);
      
      // 插入管理员记录
      const result = await pool.query(`
        INSERT INTO administrators (username, password_hash, name, email, permission_level) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id
      `, ['admin', passwordHash, '系统管理员', 'admin@example.com', 1]);
      
      console.log('管理员账户创建成功，ID:', result.rows[0].id);
    }
  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    // 关闭连接池
    await pool.end();
    console.log('数据库连接已关闭');
  }
}

// 执行函数
createAdminUser().catch(console.error);