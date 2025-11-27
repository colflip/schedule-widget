-- Migration: 20251111_modify_daily_availability.sql
-- 目标：重构 teacher_daily_availability 与 student_daily_availability 表
-- 1) 删除 start_time, end_time, status
-- 2) 新增 morning_available, afternoon_available, evening_available (0/1, default 0)
-- 3) 数据迁移：基于原有时间段与 status 将可用性映射到新列

BEGIN;

-- 备份原始表（备份为完整表拷贝）
CREATE TABLE IF NOT EXISTS teacher_daily_availability_backup_20251111 AS TABLE teacher_daily_availability;
CREATE TABLE IF NOT EXISTS student_daily_availability_backup_20251111 AS TABLE student_daily_availability;

-- 增加新列（默认 0，非空）
ALTER TABLE teacher_daily_availability
  ADD COLUMN IF NOT EXISTS morning_available INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afternoon_available INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evening_available INTEGER NOT NULL DEFAULT 0;

ALTER TABLE student_daily_availability
  ADD COLUMN IF NOT EXISTS morning_available INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afternoon_available INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evening_available INTEGER NOT NULL DEFAULT 0;

-- 添加 CHECK 约束（先删除同名约束以避免重复）
ALTER TABLE teacher_daily_availability DROP CONSTRAINT IF EXISTS chk_teacher_daily_availability_morning;
ALTER TABLE teacher_daily_availability DROP CONSTRAINT IF EXISTS chk_teacher_daily_availability_afternoon;
ALTER TABLE teacher_daily_availability DROP CONSTRAINT IF EXISTS chk_teacher_daily_availability_evening;
ALTER TABLE teacher_daily_availability
  ADD CONSTRAINT chk_teacher_daily_availability_morning CHECK (morning_available IN (0,1)),
  ADD CONSTRAINT chk_teacher_daily_availability_afternoon CHECK (afternoon_available IN (0,1)),
  ADD CONSTRAINT chk_teacher_daily_availability_evening CHECK (evening_available IN (0,1));

ALTER TABLE student_daily_availability DROP CONSTRAINT IF EXISTS chk_student_daily_availability_morning;
ALTER TABLE student_daily_availability DROP CONSTRAINT IF EXISTS chk_student_daily_availability_afternoon;
ALTER TABLE student_daily_availability DROP CONSTRAINT IF EXISTS chk_student_daily_availability_evening;
ALTER TABLE student_daily_availability
  ADD CONSTRAINT chk_student_daily_availability_morning CHECK (morning_available IN (0,1)),
  ADD CONSTRAINT chk_student_daily_availability_afternoon CHECK (afternoon_available IN (0,1)),
  ADD CONSTRAINT chk_student_daily_availability_evening CHECK (evening_available IN (0,1));

-- 数据迁移：如果原始表包含 start_time/end_time/status 等字段，则基于 status='available' 且时间段重叠设置对应新字段为 1
-- 我们使用 COALESCE/存在性检测以兼容不同版本的表结构

DO $$
BEGIN
  -- teacher table: set slot flags when status='available' and time overlaps
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teacher_daily_availability' AND column_name='status')
  THEN
    UPDATE teacher_daily_availability
    SET morning_available = CASE WHEN status = 'available' AND (start_time, end_time) OVERLAPS ('08:00'::time,'12:00'::time) THEN 1 ELSE morning_available END,
        afternoon_available = CASE WHEN status = 'available' AND (start_time, end_time) OVERLAPS ('13:00'::time,'17:00'::time) THEN 1 ELSE afternoon_available END,
        evening_available = CASE WHEN status = 'available' AND (start_time, end_time) OVERLAPS ('18:00'::time,'21:00'::time) THEN 1 ELSE evening_available END;
  END IF;

  -- student table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_daily_availability' AND column_name='status')
  THEN
    UPDATE student_daily_availability
    SET morning_available = CASE WHEN status = 'available' AND (start_time, end_time) OVERLAPS ('08:00'::time,'12:00'::time) THEN 1 ELSE morning_available END,
        afternoon_available = CASE WHEN status = 'available' AND (start_time, end_time) OVERLAPS ('13:00'::time,'17:00'::time) THEN 1 ELSE afternoon_available END,
        evening_available = CASE WHEN status = 'available' AND (start_time, end_time) OVERLAPS ('18:00'::time,'21:00'::time) THEN 1 ELSE evening_available END;
  END IF;

  -- 兼容旧列名 is_available 或 time_slot：若存在则基于这些列也进行映射
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teacher_daily_availability' AND column_name='is_available')
  THEN
    UPDATE teacher_daily_availability
    SET morning_available = CASE WHEN is_available IS TRUE AND (time_slot = 'morning' OR (start_time, end_time) OVERLAPS ('08:00'::time,'12:00'::time)) THEN 1 ELSE morning_available END,
        afternoon_available = CASE WHEN is_available IS TRUE AND (time_slot = 'afternoon' OR (start_time, end_time) OVERLAPS ('13:00'::time,'17:00'::time)) THEN 1 ELSE afternoon_available END,
        evening_available = CASE WHEN is_available IS TRUE AND (time_slot = 'evening' OR (start_time, end_time) OVERLAPS ('18:00'::time,'21:00'::time)) THEN 1 ELSE evening_available END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_daily_availability' AND column_name='is_available')
  THEN
    UPDATE student_daily_availability
    SET morning_available = CASE WHEN is_available IS TRUE AND (time_slot = 'morning' OR (start_time, end_time) OVERLAPS ('08:00'::time,'12:00'::time)) THEN 1 ELSE morning_available END,
        afternoon_available = CASE WHEN is_available IS TRUE AND (time_slot = 'afternoon' OR (start_time, end_time) OVERLAPS ('13:00'::time,'17:00'::time)) THEN 1 ELSE afternoon_available END,
        evening_available = CASE WHEN is_available IS TRUE AND (time_slot = 'evening' OR (start_time, end_time) OVERLAPS ('18:00'::time,'21:00'::time)) THEN 1 ELSE evening_available END;
  END IF;
END$$;

-- 清理：删除旧列 start_time, end_time, status（如果存在）
ALTER TABLE teacher_daily_availability
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS time_slot,
  DROP COLUMN IF EXISTS is_available;

ALTER TABLE student_daily_availability
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS time_slot,
  DROP COLUMN IF EXISTS is_available;

-- 更新/创建索引：移除基于 start_time/end_time 的旧索引（如果存在），创建新的索引以支持按日期与可用性查询
DROP INDEX IF EXISTS idx_teacher_daily_availability_date_time;
CREATE INDEX IF NOT EXISTS idx_teacher_daily_availability_date ON teacher_daily_availability(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_teacher_daily_availability_date_slots ON teacher_daily_availability(date, morning_available, afternoon_available, evening_available);

DROP INDEX IF EXISTS idx_student_daily_availability_date_time;
CREATE INDEX IF NOT EXISTS idx_student_daily_availability_date ON student_daily_availability(student_id, date);
CREATE INDEX IF NOT EXISTS idx_student_daily_availability_date_slots ON student_daily_availability(date, morning_available, afternoon_available, evening_available);

COMMIT;

-- 完成迁移：请根据需要运行后验性检查并确认表结构与数据一致性
