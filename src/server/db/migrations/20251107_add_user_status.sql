-- 为 teachers 与 students 表新增/规范化用户状态列
-- 语义：1=正常，0=暂停，-1=删除

DO $$ BEGIN
  -- teachers.status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='teachers' AND column_name='status'
  ) THEN
    ALTER TABLE teachers ADD COLUMN status INT NOT NULL DEFAULT 1;
    -- 约束：仅允许 -1,0,1
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'teachers_status_check'
    ) THEN
      ALTER TABLE teachers ADD CONSTRAINT teachers_status_check CHECK (status IN (-1,0,1));
    END IF;
  ELSE
    -- 若存在但类型非 integer，尝试转换
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='teachers' AND column_name='status' AND data_type <> 'integer'
    ) THEN
      ALTER TABLE teachers ALTER COLUMN status TYPE INT USING
        CASE 
          WHEN status::text IN ('-1','0','1') THEN status::int
          WHEN lower(status::text) IN ('deleted','删除') THEN -1
          WHEN lower(status::text) IN ('paused','暂停') THEN 0
          WHEN lower(status::text) IN ('active','正常') THEN 1
          ELSE 1
        END;
      ALTER TABLE teachers ALTER COLUMN status SET DEFAULT 1;
      UPDATE teachers SET status = 1 WHERE status IS NULL;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teachers_status_check'
      ) THEN
        ALTER TABLE teachers ADD CONSTRAINT teachers_status_check CHECK (status IN (-1,0,1));
      END IF;
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  -- students.status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='students' AND column_name='status'
  ) THEN
    ALTER TABLE students ADD COLUMN status INT NOT NULL DEFAULT 1;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check'
    ) THEN
      ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN (-1,0,1));
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='students' AND column_name='status' AND data_type <> 'integer'
    ) THEN
      ALTER TABLE students ALTER COLUMN status TYPE INT USING
        CASE 
          WHEN status::text IN ('-1','0','1') THEN status::int
          WHEN lower(status::text) IN ('deleted','删除') THEN -1
          WHEN lower(status::text) IN ('paused','暂停') THEN 0
          WHEN lower(status::text) IN ('active','正常') THEN 1
          ELSE 1
        END;
      ALTER TABLE students ALTER COLUMN status SET DEFAULT 1;
      UPDATE students SET status = 1 WHERE status IS NULL;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check'
      ) THEN
        ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN (-1,0,1));
      END IF;
    END IF;
  END IF;
END $$;

-- 便于筛选的索引
CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

