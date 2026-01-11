/**
 * 数据库初始化脚本
 * @description 执行 schema.sql 初始化数据库结构
 * @usage node init-db.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../db/db');

async function initializeDatabase() {
    try {
        console.log('开始初始化数据库...');

        // 读取 schema.sql 文件
        const schemaPath = path.join(__dirname, '../db/schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

        // 执行 SQL 脚本
        await db.query(schemaSQL);

        console.log('数据库表结构创建成功！');
    } catch (error) {
        console.error('数据库初始化失败:', error);
    } finally {
        // 结束数据库连接
        process.exit(0);
    }
}

initializeDatabase();
