-- 检查管理员表是否存在，如果不存在则创建
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'administrators') THEN
        CREATE TABLE administrators (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            permission_level INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            CONSTRAINT administrators_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
        );
    END IF;
END
$$;

-- 插入管理员账户（密码为123456的哈希值）
INSERT INTO administrators (username, password_hash, name, email, permission_level)
VALUES 
('admin', '$2b$10$3euPcmQFCiblsZeEu5s7p.9MUZWg8TGetwpkZnkqN65UzxGBfcAGy', '系统管理员', 'admin@example.com', 1)
ON CONFLICT (username) DO NOTHING;