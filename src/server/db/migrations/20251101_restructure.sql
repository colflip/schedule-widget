-- 数据库架构重构迁移脚本
-- 目标：
-- 1) 重命名与重构每日可用时间表（教师/学生）
-- 2) 新建 course_arrangement 排课表并迁移旧数据
-- 3) 清理不再需要的旧表与索引

BEGIN;

-- ===============
-- 1. 可用时间表重构
-- ===============

-- 教师每日可用时间表重命名
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='teacher_availability'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='teacher_daily_availability'
  ) THEN
    EXECUTE 'ALTER TABLE teacher_availability RENAME TO teacher_daily_availability';
  END IF;
END $$;

-- 学生每日可用时间表重命名
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_availability'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_daily_availability'
  ) THEN
    EXECUTE 'ALTER TABLE student_availability RENAME TO student_daily_availability';
  END IF;
END $$;

-- 为教师每日可用时间表添加开始/结束时间与状态字段（先允许为空，迁移后再置为非空）
ALTER TABLE IF EXISTS teacher_daily_availability
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available';

-- 为学生每日可用时间表添加开始/结束时间与状态字段（先允许为空，迁移后再置为非空）
ALTER TABLE IF EXISTS student_daily_availability
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available';

-- 将旧的 time_slot / is_available 映射到新的时间段与状态
-- 约定时段映射：morning(08:00-12:00), afternoon(13:00-17:00), evening(18:00-21:00)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='teacher_daily_availability' AND column_name='time_slot'
  ) THEN
    EXECUTE 'UPDATE teacher_daily_availability SET
      start_time = CASE time_slot
        WHEN ''morning'' THEN TIME ''08:00''
        WHEN ''afternoon'' THEN TIME ''13:00''
        WHEN ''evening'' THEN TIME ''18:00''
        ELSE start_time
      END,
      end_time = CASE time_slot
        WHEN ''morning'' THEN TIME ''12:00''
        WHEN ''afternoon'' THEN TIME ''17:00''
        WHEN ''evening'' THEN TIME ''21:00''
        ELSE end_time
      END
    WHERE start_time IS NULL OR end_time IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='teacher_daily_availability' AND column_name='is_available'
  ) THEN
    EXECUTE 'UPDATE teacher_daily_availability SET
      status = CASE WHEN COALESCE(is_available, false) = true THEN ''available'' ELSE ''unavailable'' END
    WHERE status IS NULL';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='student_daily_availability' AND column_name='time_slot'
  ) THEN
    EXECUTE 'UPDATE student_daily_availability SET
      start_time = CASE time_slot
        WHEN ''morning'' THEN TIME ''08:00''
        WHEN ''afternoon'' THEN TIME ''13:00''
        WHEN ''evening'' THEN TIME ''18:00''
        ELSE start_time
      END,
      end_time = CASE time_slot
        WHEN ''morning'' THEN TIME ''12:00''
        WHEN ''afternoon'' THEN TIME ''17:00''
        WHEN ''evening'' THEN TIME ''21:00''
        ELSE end_time
      END
    WHERE start_time IS NULL OR end_time IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='student_daily_availability' AND column_name='is_available'
  ) THEN
    EXECUTE 'UPDATE student_daily_availability SET
      status = CASE WHEN COALESCE(is_available, true) = true THEN ''available'' ELSE ''unavailable'' END
    WHERE status IS NULL';
  END IF;
END $$;

-- 置为非空并建立约束
ALTER TABLE teacher_daily_availability
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN end_time SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE student_daily_availability
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN end_time SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

-- 添加状态检查约束（仅约束常用值，便于前端筛选）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_teacher_daily_availability_status'
  ) THEN
    ALTER TABLE teacher_daily_availability
      ADD CONSTRAINT chk_teacher_daily_availability_status
      CHECK (status IN ('available','unavailable'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_daily_availability_status'
  ) THEN
    ALTER TABLE student_daily_availability
      ADD CONSTRAINT chk_student_daily_availability_status
      CHECK (status IN ('available','unavailable'));
  END IF;
END $$;

-- 唯一性约束：同一人同一天同一时间段唯一
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_teacher_daily_availability_slot'
  ) THEN
    ALTER TABLE teacher_daily_availability
      ADD CONSTRAINT uniq_teacher_daily_availability_slot
      UNIQUE(teacher_id, date, start_time, end_time);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_student_daily_availability_slot'
  ) THEN
    ALTER TABLE student_daily_availability
      ADD CONSTRAINT uniq_student_daily_availability_slot
      UNIQUE(student_id, date, start_time, end_time);
  END IF;
END $$;

-- 外键约束（若未定义则补充，并启用级联删除以保持数据一致性）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_daily_availability_teacher_id_fkey'
  ) THEN
    ALTER TABLE teacher_daily_availability
      ADD CONSTRAINT teacher_daily_availability_teacher_id_fkey
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_daily_availability_student_id_fkey'
  ) THEN
    ALTER TABLE student_daily_availability
      ADD CONSTRAINT student_daily_availability_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 索引（高频查询优化：按日期/教师/学生/状态）
CREATE INDEX IF NOT EXISTS idx_teacher_daily_availability_date_status ON teacher_daily_availability(date, status);
CREATE INDEX IF NOT EXISTS idx_teacher_daily_availability_teacher_date ON teacher_daily_availability(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_student_daily_availability_date_status ON student_daily_availability(date, status);
CREATE INDEX IF NOT EXISTS idx_student_daily_availability_student_date ON student_daily_availability(student_id, date);

-- 清理旧列
ALTER TABLE teacher_daily_availability DROP COLUMN IF EXISTS time_slot;
ALTER TABLE teacher_daily_availability DROP COLUMN IF EXISTS is_available;
ALTER TABLE student_daily_availability DROP COLUMN IF EXISTS time_slot;
ALTER TABLE student_daily_availability DROP COLUMN IF EXISTS is_available;

-- ===============
-- 2. 新建排课表并迁移旧数据
-- ===============

CREATE TABLE IF NOT EXISTS course_arrangement (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  course_id INTEGER NOT NULL REFERENCES schedule_types(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  evaluation_student TEXT,
  evaluation_teacher TEXT,
  created_by INTEGER REFERENCES administrators(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 迁移旧数据：schedules + schedule_students + schedule_types_relation -> course_arrangement
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='course_arrangement' AND column_name='class_date'
  ) THEN
    EXECUTE 'INSERT INTO course_arrangement (
      teacher_id, student_id, course_id, class_date, start_time, end_time, location, status, created_by, created_at, updated_at
    )
    SELECT DISTINCT ON (s.teacher_id, s.date, s.start_time, s.end_time)
      s.teacher_id,
      ss.student_id,
      str.type_id,
      s.date,
      s.start_time,
      s.end_time,
      s.location,
      s.status,
      s.created_by,
      s.created_at,
      s.updated_at
    FROM schedules s
    LEFT JOIN schedule_students ss ON ss.schedule_id = s.id
    LEFT JOIN schedule_types_relation str ON str.schedule_id = s.id
    WHERE NOT EXISTS (
      SELECT 1 FROM course_arrangement ca
      WHERE ca.teacher_id = s.teacher_id
        AND ca.class_date = s.date
        AND ca.start_time = s.start_time
        AND ca.end_time = s.end_time
    )
    ORDER BY s.teacher_id, s.date, s.start_time, s.end_time, ss.student_id NULLS LAST, str.type_id NULLS LAST';
  ELSE
    EXECUTE 'INSERT INTO course_arrangement (
      teacher_id, student_id, course_id, date, start_time, end_time, location, status, created_by, created_at, updated_at
    )
    SELECT DISTINCT ON (s.teacher_id, s.date, s.start_time, s.end_time)
      s.teacher_id,
      ss.student_id,
      str.type_id,
      s.date,
      s.start_time,
      s.end_time,
      s.location,
      s.status,
      s.created_by,
      s.created_at,
      s.updated_at
    FROM schedules s
    LEFT JOIN schedule_students ss ON ss.schedule_id = s.id
    LEFT JOIN schedule_types_relation str ON str.schedule_id = s.id
    WHERE NOT EXISTS (
      SELECT 1 FROM course_arrangement ca
      WHERE ca.teacher_id = s.teacher_id
        AND ca.date = s.date
        AND ca.start_time = s.start_time
        AND ca.end_time = s.end_time
    )
    ORDER BY s.teacher_id, s.date, s.start_time, s.end_time, ss.student_id NULLS LAST, str.type_id NULLS LAST';
  END IF;
END $$;

-- 索引（高频查询优化）
-- 针对 class_date / date 双方案的索引创建
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_arrangement' AND column_name='class_date'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_course_arrangement_date_status ON course_arrangement(class_date, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_course_arrangement_date_teacher ON course_arrangement(class_date, teacher_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_course_arrangement_date_student ON course_arrangement(class_date, student_id)';
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_course_arrangement_date_status ON course_arrangement(date, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_course_arrangement_date_teacher ON course_arrangement(date, teacher_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_course_arrangement_date_student ON course_arrangement(date, student_id)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_course_arrangement_teacher ON course_arrangement(teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_student ON course_arrangement(student_id);
CREATE INDEX IF NOT EXISTS idx_course_arrangement_course ON course_arrangement(course_id);

-- ===============
-- 3. 清理旧表与索引
-- ===============

-- 不再需要的周期性可用表
DROP TABLE IF EXISTS teacher_availabilities CASCADE;

-- 旧排课相关表
DROP TABLE IF EXISTS schedule_confirmations CASCADE;
DROP TABLE IF EXISTS schedule_types_relation CASCADE;
DROP TABLE IF EXISTS schedule_students CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;

COMMIT;

-- 备注：
-- - 可根据前端实际选择的时间段进一步调整状态枚举与约束。
-- - 如需兼容旧接口，可临时创建视图映射旧表名到新结构（未在本迁移中启用）。
