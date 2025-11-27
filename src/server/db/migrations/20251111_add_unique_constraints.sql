-- Migration: 20251111_add_unique_constraints.sql
-- 为 teacher_daily_availability 和 student_daily_availability 添加唯一约束

BEGIN;

-- 为 teacher_daily_availability 添加唯一约束
ALTER TABLE teacher_daily_availability
  ADD CONSTRAINT uk_teacher_daily_availability_teacher_date UNIQUE (teacher_id, date);

-- 为 student_daily_availability 添加唯一约束  
ALTER TABLE student_daily_availability
  ADD CONSTRAINT uk_student_daily_availability_student_date UNIQUE (student_id, date);

COMMIT;
