const bcrypt = require('bcrypt');
const db = require('../db/db');
require('dotenv').config();

async function createInitialAdmin() {
    try {
        // 检查是否已存在管理员
        const existingAdmin = await db.query('SELECT * FROM administrators WHERE username = $1', ['admin']);
        
        if (existingAdmin.rows.length > 0) {
            console.log('管理员账号已存在');
            return;
        }

        // 创建密码哈希
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('123456', salt);

        // 插入管理员记录
        const result = await db.query(
            'INSERT INTO administrators (username, password_hash, name, permission_level) VALUES ($1, $2, $3, $4) RETURNING id',
            ['admin', passwordHash, '系统管理员', 1]
        );

        console.log('管理员账号创建成功，ID:', result.rows[0].id);
    } catch (error) {
        console.error('创建管理员账号时出错:', error);
    } finally {
        // 等待所有查询完成后退出
        process.exit(0);
    }
}

createInitialAdmin();