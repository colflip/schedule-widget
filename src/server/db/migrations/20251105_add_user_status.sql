-- 为教师与学生表增加状态字段，并设置默认值与检查约束
-- 允许值：-1(删除)、0(暂停)、1(正常)

-- 教师表：增加 status 列
ALTER TABLE IF EXISTS teachers
  ADD COLUMN IF NOT EXISTS status INT;

-- 设置默认值并确保非空
ALTER TABLE IF EXISTS teachers
  ALTER COLUMN status SET DEFAULT 1;
UPDATE teachers SET status = 1 WHERE status IS NULL;
ALTER TABLE IF EXISTS teachers
  ALTER COLUMN status SET NOT NULL;

-- 添加检查约束（若已存在则忽略）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_teachers_status'
  ) THEN
    ALTER TABLE teachers ADD CONSTRAINT chk_teachers_status CHECK (status IN (-1, 0, 1));
  END IF;
END$$;

-- 学生表：增加 status 列
ALTER TABLE IF EXISTS students
  ADD COLUMN IF NOT EXISTS status INT;

-- 设置默认值并确保非空
ALTER TABLE IF EXISTS students
  ALTER COLUMN status SET DEFAULT 1;
UPDATE students SET status = 1 WHERE status IS NULL;
ALTER TABLE IF EXISTS students
  ALTER COLUMN status SET NOT NULL;

-- 添加检查约束（若已存在则忽略）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_students_status'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT chk_students_status CHECK (status IN (-1, 0, 1));
  END IF;
END$$;

