-- 添加更新时间字段迁移脚本
-- 目标：为 teacher_daily_availability 等表添加更新时间字段

BEGIN;

-- 添加更新时间字段
ALTER TABLE teacher_daily_availability
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 创建触发器以自动更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 teacher_daily_availability 添加触发器
DROP TRIGGER IF EXISTS tr_teacher_daily_availability_updated_at ON teacher_daily_availability;
CREATE TRIGGER tr_teacher_daily_availability_updated_at
  BEFORE UPDATE ON teacher_daily_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMIT;