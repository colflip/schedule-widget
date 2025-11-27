-- 2025-11-09: 自动状态更新支持

BEGIN;

-- 为自动化状态更新增加时间戳字段
ALTER TABLE IF EXISTS course_arrangement
  ADD COLUMN IF NOT EXISTS last_auto_update TIMESTAMP NULL;

-- 自动更新审计日志表
CREATE TABLE IF NOT EXISTS schedule_auto_update_logs (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES course_arrangement(id) ON DELETE CASCADE,
  previous_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  run_id UUID NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 根据现有日期列创建索引（提升每日查询性能）
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='course_arrangement' AND column_name='arr_date'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname='idx_ca_status_arrdate_lastupdate'
    ) THEN
      EXECUTE 'CREATE INDEX idx_ca_status_arrdate_lastupdate ON course_arrangement(status, arr_date, last_auto_update)';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='course_arrangement' AND column_name='class_date'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname='idx_ca_status_classdate_lastupdate'
    ) THEN
      EXECUTE 'CREATE INDEX idx_ca_status_classdate_lastupdate ON course_arrangement(status, class_date, last_auto_update)';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='course_arrangement' AND column_name='date'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname='idx_ca_status_date_lastupdate'
    ) THEN
      EXECUTE 'CREATE INDEX idx_ca_status_date_lastupdate ON course_arrangement(status, date, last_auto_update)';
    END IF;
  END IF;
END $$;

COMMIT;

