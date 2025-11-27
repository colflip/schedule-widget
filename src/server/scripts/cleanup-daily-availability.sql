-- 每日可用时间清理脚本
-- 通过删除过期记录，防止索引膨胀，建议每日执行
-- 本 SQL 作为参考，实际参数由运行脚本注入（保留示例逻辑）

-- 教师每日可用时间：删除超过保留期的记录
-- 参数: :retention_interval
DELETE FROM teacher_daily_availability
WHERE date < CURRENT_DATE - :retention_interval;

-- 学生每日可用时间：删除超过保留期的记录
DELETE FROM student_daily_availability
WHERE date < CURRENT_DATE - :retention_interval;

-- 进行表统计分析以优化执行计划
ANALYZE teacher_daily_availability;
ANALYZE student_daily_availability;
