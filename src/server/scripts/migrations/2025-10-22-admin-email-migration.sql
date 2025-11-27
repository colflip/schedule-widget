BEGIN;

-- 1) 添加 email 列（若不存在）
ALTER TABLE administrators ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2) 为已存在记录填充 email（确保非空且格式正确的占位值）
-- 优先为默认管理员设置固定邮箱
UPDATE administrators 
SET email = 'admin@example.com'
WHERE username = 'admin' AND (email IS NULL OR email = '');

-- 为其他记录生成占位邮箱（username@example.com），避免 NOT NULL 失败
UPDATE administrators 
SET email = username || '@example.com'
WHERE (email IS NULL OR email = '') AND username IS NOT NULL AND username <> 'admin';

-- 3) 添加格式校验约束（若不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'administrators_email_format'
    ) THEN
        ALTER TABLE administrators
        ADD CONSTRAINT administrators_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');
    END IF;
END
$$;

-- 4) 为 email 添加唯一约束（若不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'administrators_email_unique'
    ) THEN
        ALTER TABLE administrators
        ADD CONSTRAINT administrators_email_unique UNIQUE(email);
    END IF;
END
$$;

-- 5) 将 email 设置为 NOT NULL
ALTER TABLE administrators ALTER COLUMN email SET NOT NULL;

COMMIT;