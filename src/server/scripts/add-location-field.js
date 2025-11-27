const db = require('../db/db');

async function addLocationField() {
    try {
        console.log('正在为schedules表添加location字段...');
        
        // 检查字段是否已存在
        const checkResult = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'schedules' AND column_name = 'location'
        `);
        
        if (checkResult.rows.length > 0) {
            console.log('location字段已存在，跳过添加');
            return;
        }
        
        // 添加location字段
        await db.query('ALTER TABLE schedules ADD COLUMN location TEXT');
        console.log('成功添加location字段到schedules表');
        
        // 为现有记录设置默认值（使用学生的visit_location）
        await db.query(`
            UPDATE schedules 
            SET location = (
                SELECT DISTINCT st.visit_location 
                FROM schedule_students ss 
                JOIN students st ON ss.student_id = st.id 
                WHERE ss.schedule_id = schedules.id 
                LIMIT 1
            )
            WHERE location IS NULL
        `);
        console.log('已为现有记录设置默认location值');
        
    } catch (error) {
        console.error('添加location字段失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    addLocationField()
        .then(() => {
            console.log('迁移完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('迁移失败:', error);
            process.exit(1);
        });
}

module.exports = addLocationField;