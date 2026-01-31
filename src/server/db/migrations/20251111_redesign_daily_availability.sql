-- Migration: 20251111_redesign_daily_availability.sql
-- 目标：重构 teacher_daily_availability 与 student_daily_availability 表
-- 操作步骤：
-- 1) 创建备份表（用于数据恢复）
-- 2) 新增三个时间可用性字段（morning_available, afternoon_available, evening_available）
-- 3) 基于 start_time/end_time/status 进行数据迁移
-- 4) 删除旧字段（start_time, end_time, status）
-- 5) 添加 CHECK 约束确保字段值为 0 或 1
-- 6) 创建新的索引以支持查询性能

BEGIN;

-- ====== TEACHER_DAILY_AVAILABILITY ======

-- 1. 创建备份表
DROP TABLE IF EXISTS teacher_daily_availability_backup_20251111;
CREATE TABLE teacher_daily_availability_backup_20251111 AS TABLE teacher_daily_availability;

-- 2. 删除旧的约束（避免冲突）
ALTER TABLE teacher_daily_availability DROP CONSTRAINT IF EXISTS teacher_availability_fk CASCADE;

-- 3. 添加新列（默认值为 0）
ALTER TABLE teacher_daily_availability
  ADD COLUMN IF NOT EXISTS morning_available INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afternoon_available INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evening_available INTEGER DEFAULT 0;

-- 4. 数据迁移：根据 start_time 和 end_time 推断时段可用性
-- 时段划分规则：
--   上午: 08:00 - 12:00
--   下午: 13:00 - 17:00
--   晚上: 18:00 - 21:00
UPDATE teacher_daily_availability
SET 
  morning_available = CASE 
    WHEN status = 'available' AND (
      (start_time < '12:00'::time AND end_time > '08:00'::time)
    ) THEN 1 
    ELSE 0 
  END,
  afternoon_available = CASE 
    WHEN status = 'available' AND (
      (start_time < '17:00'::time AND end_time > '13:00'::time)
    ) THEN 1 
    ELSE 0 
  END,
  evening_available = CASE 
    WHEN status = 'available' AND (
      (start_time < '21:00'::time AND end_time > '18:00'::time)
    ) THEN 1 
    ELSE 0 
  END;

-- 5. 删除旧列
ALTER TABLE teacher_daily_availability
  DROP COLUMN start_time,
  DROP COLUMN end_time,
  DROP COLUMN status;

-- 6. 添加 CHECK 约束以确保字段值为 0 或 1
ALTER TABLE teacher_daily_availability
  ADD CONSTRAINT chk_teacher_morning_available CHECK (morning_available IN (0, 1)),
  ADD CONSTRAINT chk_teacher_afternoon_available CHECK (afternoon_available IN (0, 1)),
  ADD CONSTRAINT chk_teacher_evening_available CHECK (evening_available IN (0, 1));

-- 7. 重新创建外键
ALTER TABLE teacher_daily_availability
  ADD CONSTRAINT fk_teacher_daily_availability_teacher_id 
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- ====== STUDENT_DAILY_AVAILABILITY ======

-- 1. 创建备份表
DROP TABLE IF EXISTS student_daily_availability_backup_20251111;
CREATE TABLE student_daily_availability_backup_20251111 AS TABLE student_daily_availability;

-- 2. 删除旧的约束（避免冲突）
ALTER TABLE student_daily_availability DROP CONSTRAINT IF EXISTS student_availability_fk CASCADE;

-- 3. 添加新列（默认值为 0）
ALTER TABLE student_daily_availability
  ADD COLUMN IF NOT EXISTS morning_available INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afternoon_available INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evening_available INTEGER DEFAULT 0;

-- 4. 数据迁移：根据 start_time 和 end_time 推断时段可用性
UPDATE student_daily_availability
SET 
  morning_available = CASE 
    WHEN status = 'available' AND (
      (start_time < '12:00'::time AND end_time > '08:00'::time)
    ) THEN 1 
    ELSE 0 
  END,
  afternoon_available = CASE 
    WHEN status = 'available' AND (
      (start_time < '17:00'::time AND end_time > '13:00'::time)
    ) THEN 1 
    ELSE 0 
  END,
  evening_available = CASE 
    WHEN status = 'available' AND (
      (start_time < '21:00'::time AND end_time > '18:00'::time)
    ) THEN 1 
    ELSE 0 
  END;

-- 5. 删除旧列
ALTER TABLE student_daily_availability
  DROP COLUMN start_time,
  DROP COLUMN end_time,
  DROP COLUMN status;

-- 6. 添加 CHECK 约束以确保字段值为 0 或 1
ALTER TABLE student_daily_availability
  ADD CONSTRAINT chk_student_morning_available CHECK (morning_available IN (0, 1)),
  ADD CONSTRAINT chk_student_afternoon_available CHECK (afternoon_available IN (0, 1)),
  ADD CONSTRAINT chk_student_evening_available CHECK (evening_available IN (0, 1));

-- 7. 重新创建外键
ALTER TABLE student_daily_availability
  ADD CONSTRAINT fk_student_daily_availability_student_id 
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- ====== 更新索引 ======

-- 删除旧索引（如果存在）
DROP INDEX IF EXISTS idx_teacher_daily_availability_date_time;
DROP INDEX IF EXISTS idx_student_daily_availability_date_time;

-- 创建新索引以支持常见查询
CREATE INDEX IF NOT EXISTS idx_teacher_daily_availability_date 
  ON teacher_daily_availability(teacher_id, date);
  
CREATE INDEX IF NOT EXISTS idx_teacher_daily_availability_slots 
  ON teacher_daily_availability(date, morning_available, afternoon_available, evening_available);

CREATE INDEX IF NOT EXISTS idx_student_daily_availability_date 
  ON student_daily_availability(student_id, date);
  
CREATE INDEX IF NOT EXISTS idx_student_daily_availability_slots 
  ON student_daily_availability(date, morning_available, afternoon_available, evening_available);

COMMIT;

-- 迁移完成
-- 验证步骤：
-- 1. SELECT * FROM teacher_daily_availability LIMIT 5;
-- 2. SELECT * FROM student_daily_availability LIMIT 5;
-- 3. 检查约束和索引是否正确创建
