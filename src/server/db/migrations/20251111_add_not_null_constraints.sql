-- Migration: 20251111_add_not_null_constraints.sql
-- 为新添加的时间可用性字段设置 NOT NULL 约束

BEGIN;

-- 首先更新任何为 NULL 的值为 0（如果存在的话）
UPDATE teacher_daily_availability 
SET morning_available = COALESCE(morning_available, 0),
    afternoon_available = COALESCE(afternoon_available, 0),
    evening_available = COALESCE(evening_available, 0);

UPDATE student_daily_availability 
SET morning_available = COALESCE(morning_available, 0),
    afternoon_available = COALESCE(afternoon_available, 0),
    evening_available = COALESCE(evening_available, 0);

ALTER TABLE teacher_daily_availability
  ALTER COLUMN morning_available SET NOT NULL,
  ALTER COLUMN afternoon_available SET NOT NULL,
  ALTER COLUMN evening_available SET NOT NULL;

ALTER TABLE student_daily_availability
  ALTER COLUMN morning_available SET NOT NULL,
  ALTER COLUMN afternoon_available SET NOT NULL,
  ALTER COLUMN evening_available SET NOT NULL;

COMMIT;
