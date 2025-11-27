-- 2025-11-03: 排课唯一性与冲突日志

BEGIN;

-- 统一使用 arr_date 作为日期列（如不存在则通过 COALESCE 视角保持约束一致）
-- 添加唯一索引：同一教师/学生/日期/时间段唯一
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_course_arrangement_unique'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_course_arrangement_unique ON course_arrangement(teacher_id, student_id, arr_date, start_time, end_time)';
  END IF;
END $$;

-- 冲突日志表（管理员审计）
CREATE TABLE IF NOT EXISTS schedule_conflict_logs (
  id SERIAL PRIMARY KEY,
  existing_id INTEGER REFERENCES course_arrangement(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES administrators(id) ON DELETE SET NULL,
  decided_action VARCHAR(20) CHECK (decided_action IN (''merge'',''override'',''cancel'')),
  reason TEXT,
  attempted_payload JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;

