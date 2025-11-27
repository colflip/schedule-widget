-- 重建前清理旧对象
DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS schedule_confirmations CASCADE;
DROP TABLE IF EXISTS schedule_types_relation CASCADE;
DROP TABLE IF EXISTS schedule_students CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS schedule_types CASCADE;
DROP TABLE IF EXISTS student_availability CASCADE;
DROP TABLE IF EXISTS teacher_availability CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS administrators CASCADE;

-- 创建管理员表
CREATE TABLE administrators (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    permission_level INTEGER NOT NULL CHECK (permission_level BETWEEN 1 AND 3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    CONSTRAINT administrators_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
);

-- 创建教师表
CREATE TABLE teachers (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    profession VARCHAR(100),
    contact VARCHAR(100),
    work_location TEXT,
    home_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- 创建学生表
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    profession VARCHAR(100),
    contact VARCHAR(100),
    visit_location TEXT,
    home_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- 创建教师空闲时间表
CREATE TABLE teacher_availability (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES teachers(id),
    date DATE NOT NULL,
    time_slot VARCHAR(20) CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
    is_available BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, date, time_slot)
);

-- 创建学生空闲时间表
CREATE TABLE student_availability (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    date DATE NOT NULL,
    time_slot VARCHAR(20) CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, date, time_slot)
);

-- 创建课程类型表
CREATE TABLE schedule_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- 插入默认的课程类型
INSERT INTO schedule_types (name, description) VALUES
    ('visit', '入户'),
    ('trial', '试教'),
    ('review', '评审'),
    ('review_record', '评审记录'),
    ('half_visit', '半次入户'),
    ('group_activity', '集体活动');

-- 创建排班表
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES teachers(id),
    date DATE NOT NULL,
    time_slot VARCHAR(20) CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    created_by INTEGER REFERENCES administrators(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建排班-学生关联表
CREATE TABLE schedule_students (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id),
    student_id INTEGER REFERENCES students(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建排班-课程类型关联表
CREATE TABLE schedule_types_relation (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id),
    type_id INTEGER REFERENCES schedule_types(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建授课确认记录表
CREATE TABLE schedule_confirmations (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id),
    teacher_confirmed BOOLEAN DEFAULT FALSE,
    teacher_confirmation_time TIMESTAMP,
    admin_confirmed BOOLEAN DEFAULT FALSE,
    admin_confirmation_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建索引以提高查询性能
CREATE INDEX idx_teacher_availability_date ON teacher_availability(date);
CREATE INDEX idx_student_availability_date ON student_availability(date);
CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX idx_schedule_students_schedule ON schedule_students(schedule_id);
CREATE INDEX idx_schedule_students_student ON schedule_students(student_id);

-- 为排课确认添加唯一索引，确保每个排课仅有一条确认记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_confirmations_schedule ON schedule_confirmations (schedule_id);