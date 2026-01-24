-- 数据库索引优化脚本（2025-11-02 更新）
-- 适配新表：course_arrangement、teacher_daily_availability、student_daily_availability

-- 1. 新排课表（course_arrangement）索引
CREATE INDEX IF NOT EXISTS idx_course_arrangement_arr_date ON course_arrangement(arr_date);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_teacher_date ON course_arrangement(teacher_id, arr_date);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_student_date ON course_arrangement(student_id, arr_date);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_status ON course_arrangement(status);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_date_time ON course_arrangement(arr_date, start_time, end_time);

-- 2. 每日可用时间表索引（教师/学生）
CREATE INDEX IF NOT EXISTS idx_teacher_daily_availability_date_time ON teacher_daily_availability(date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_teacher_daily_availability_teacher_date ON teacher_daily_availability(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_student_daily_availability_date_time ON student_daily_availability(date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_student_daily_availability_student_date ON student_daily_availability(student_id, date);

-- 3. 课程类型与用户表索引
CREATE INDEX IF NOT EXISTS idx_schedule_types_name ON schedule_types(name);
CREATE INDEX IF NOT EXISTS idx_teachers_name ON teachers(name);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_students_visit_location ON students(visit_location);

-- 4. 用户表登录/创建时间索引
CREATE INDEX IF NOT EXISTS idx_administrators_last_login ON administrators(last_login);
CREATE INDEX IF NOT EXISTS idx_teachers_last_login ON teachers(last_login);
CREATE INDEX IF NOT EXISTS idx_students_last_login ON students(last_login);
CREATE INDEX IF NOT EXISTS idx_administrators_created_at ON administrators(created_at);
CREATE INDEX IF NOT EXISTS idx_teachers_created_at ON teachers(created_at);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at);

-- 分析表统计信息，帮助查询优化器选择最佳执行计划（建议每周执行）
ANALYZE course_arrangement;
ANALYZE teacher_daily_availability;
ANALYZE student_daily_availability;
ANALYZE teachers;
ANALYZE students;
ANALYZE schedule_types;
ANALYZE administrators;
