const fs = require('fs');
const path = require('path');
const db = require('../db/db');

async function optimizeIndexes() {
    try {
        console.log('开始优化数据库索引...');
        
        // 读取索引优化SQL文件
        const sqlPath = path.join(__dirname, 'optimize-indexes.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // 分割SQL语句（按分号分割，忽略注释）
        const statements = sql
            .split('\n')
            .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
            .join('\n')
            .split(';')
            .filter(stmt => stmt.trim() !== '');
        
        console.log(`准备执行 ${statements.length} 个SQL语句...`);
        
        // 逐个执行SQL语句
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                try {
                    console.log(`执行语句 ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
                    await db.query(statement);
                    console.log(`✓ 语句 ${i + 1} 执行成功`);
                } catch (error) {
                    console.error(`✗ 语句 ${i + 1} 执行失败:`, error.message);
                    // 继续执行其他语句，不中断整个过程
                }
            }
        }
        
        console.log('数据库索引优化完成！');
        
        // 显示当前索引信息
        console.log('\n当前数据库索引信息:');
        const indexQuery = `
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname;
        `;
        
        const result = await db.query(indexQuery);
        result.rows.forEach(row => {
            console.log(`${row.tablename}.${row.indexname}: ${row.indexdef}`);
        });
        
    } catch (error) {
        console.error('索引优化过程中发生错误:', error);
    } finally {
        // 关闭数据库连接
        if (db.end) {
            await db.end();
        }
        process.exit(0);
    }
}

// 检查是否直接运行此脚本
if (require.main === module) {
    optimizeIndexes();
}

module.exports = optimizeIndexes;