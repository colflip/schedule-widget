-- 2025-11-02: 将 course_arrangement 迁移为按月分区表
-- 兼容旧列方案（arr_date/class_date/date），统一到 arr_date 分区键

BEGIN;

-- 确保存在分区键 arr_date，并填充数据
ALTER TABLE IF EXISTS course_arrangement
  ADD COLUMN IF NOT EXISTS arr_date DATE;
UPDATE course_arrangement
  SET arr_date = COALESCE(arr_date, class_date, date)
  WHERE arr_date IS NULL;

-- 创建分区父表（使用旧表结构复制约束与默认值，不复制索引）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='course_arrangement_part'
  ) THEN
    EXECUTE 'CREATE TABLE course_arrangement_part (
      LIKE course_arrangement INCLUDING DEFAULTS INCLUDING CONSTRAINTS
    ) PARTITION BY RANGE (arr_date)';
  END IF;
END $$;

-- 创建月度分区（过去12个月 + 未来6个月）
DO $$
DECLARE m_start DATE; m_end DATE; part_name TEXT; cur_month DATE;
BEGIN
  FOR cur_month IN SELECT date_trunc('month', CURRENT_DATE) + (i || ' months')::interval FROM generate_series(-12, 6) i LOOP
    m_start := DATE(cur_month);
    m_end := (m_start + INTERVAL '1 month')::DATE;
    part_name := 'course_arrangement_' || to_char(m_start, 'YYYYMM');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF course_arrangement_part FOR VALUES FROM (%L) TO (%L)', part_name, m_start, m_end);
  END LOOP;
END $$;

-- 将数据迁移至分区父表（自动路由到对应分区）
INSERT INTO course_arrangement_part SELECT * FROM course_arrangement;

-- 交换表名，保留备份
ALTER TABLE course_arrangement RENAME TO course_arrangement_backup;
ALTER TABLE course_arrangement_part RENAME TO course_arrangement;

-- 重新创建高频查询索引
CREATE INDEX IF NOT EXISTS idx_course_arrangement_arr_date ON course_arrangement(arr_date);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_teacher_date ON course_arrangement(teacher_id, arr_date);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_student_date ON course_arrangement(student_id, arr_date);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_status ON course_arrangement(status);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_date_time ON course_arrangement(arr_date, start_time, end_time);

COMMIT;

-- 注意：如需回滚，可执行：
-- BEGIN; DROP TABLE course_arrangement CASCADE; ALTER TABLE course_arrangement_backup RENAME TO course_arrangement; COMMIT;
