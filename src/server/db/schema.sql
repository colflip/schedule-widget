-- Clean up existing schema： 清理现有架构
DROP TABLE IF EXISTS administrators CASCADE;
DROP TABLE IF EXISTS course_arrangement CASCADE;
DROP TABLE IF EXISTS export_logs CASCADE;
DROP TABLE IF EXISTS schedule_auto_update_logs CASCADE;
DROP TABLE IF EXISTS schedule_types CASCADE;
DROP TABLE IF EXISTS student_daily_availability CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teacher_daily_availability CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS update_course_arrangement_updated_at CASCADE;

-- Functions： 函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_course_arrangement_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$
;

-- Table: administrators (管理员表)
CREATE TABLE administrators (
    id INTEGER, -- 主键 ID
    username VARCHAR(50) NOT NULL, -- 用户名 (唯一)
    password_hash VARCHAR(255) NOT NULL, -- 密码哈希值
    name VARCHAR(100) NOT NULL, -- 姓名
    permission_level INTEGER NOT NULL, -- 权限等级: 1=普通, 2=高级, 3=超级
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    last_login TIMESTAMP, -- 最后登录时间
    email VARCHAR(255) NOT NULL, -- 邮箱 (用于找回密码等)
    CONSTRAINT administrators_username_key UNIQUE (username),
    CONSTRAINT administrators_email_unique UNIQUE (email),
    CONSTRAINT administrators_pkey PRIMARY KEY (id),
    CONSTRAINT administrators_permission_level_check CHECK (((permission_level >= 1) AND (permission_level <= 3))),
    CONSTRAINT administrators_email_format CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text))
);

-- Table: course_arrangement (课程安排表)
CREATE TABLE course_arrangement (
    id INTEGER, -- 主键 ID
    teacher_id INTEGER NOT NULL, -- 关联教师 ID
    student_id INTEGER NOT NULL, -- 关联学生 ID
    course_id INTEGER NOT NULL, -- 关联课程类型 ID
    class_date DATE NOT NULL, -- 上课日期
    start_time TIME WITHOUT TIME ZONE NOT NULL, -- 开始时间
    end_time TIME WITHOUT TIME ZONE NOT NULL, -- 结束时间
    location TEXT, -- 上课地点
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    status VARCHAR(20) DEFAULT 'pending'::character varying, -- 状态: pending(待确认), confirmed(已确认), cancelled(已取消), completed(已完成)
    student_rating SMALLINT, -- 学生评分 (1-5)
    teacher_rating SMALLINT, -- 教师评分 (1-5)
    student_comment TEXT, -- 学生评价内容
    teacher_comment TEXT, -- 教师评价内容
    created_by INTEGER, -- 创建人管理员 ID
    last_auto_update TIMESTAMP, -- 最后一次自动更新状态的时间
    family_participants INTEGER DEFAULT 13, -- 家庭参加人员: 00=无人, 10=学生, 11=学生+妈, 12=学生+爸, 13=学生+爸妈, 14=学生+多人；01=妈，02=爸，03=爸妈，04=多人
    transport_fee DECIMAL(10,2) DEFAULT 0, -- 交通费
    other_fee DECIMAL(10,2) DEFAULT 0, -- 其他费用
    CONSTRAINT course_arrangement_pkey PRIMARY KEY (id),
    CONSTRAINT course_arrangement_time_order_chk CHECK ((end_time > start_time)),
    CONSTRAINT course_arrangement_student_rating_range CHECK (((student_rating >= 1) AND (student_rating <= 5))),
    CONSTRAINT course_arrangement_teacher_rating_range CHECK (((teacher_rating >= 1) AND (teacher_rating <= 5))),
    CONSTRAINT course_arrangement_status_enum CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[]))),
    CONSTRAINT course_arrangement_family_participants_check CHECK (family_participants IN (0, 1, 2, 3, 4, 10, 11, 12, 13, 14))
);

-- Table: export_logs (导出日志表)
CREATE TABLE export_logs (
    id INTEGER, -- 主键 ID
    admin_id INTEGER, -- 操作管理员 ID
    admin_name VARCHAR(255), -- 操作管理员姓名 (冗余存储，防止人员删除后无法追溯)
    export_type VARCHAR(50) NOT NULL, -- 导出类型
    export_format VARCHAR(20) NOT NULL, -- 导出格式 (xlsx, csv)
    start_date DATE, -- 导出数据开始日期
    end_date DATE, -- 导出数据结束日期
    record_count INTEGER DEFAULT 0, -- 导出记录条数
    file_size BIGINT, -- 文件大小 (字节)
    file_name VARCHAR(255), -- 文件名
    status VARCHAR(20) NOT NULL, -- 状态: success, failed
    error_message TEXT, -- 错误信息
    duration_ms INTEGER, -- 耗时 (毫秒)
    ip_address VARCHAR(45), -- 操作 IP 地址
    user_agent TEXT, -- 用户代理 (浏览器信息)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    completed_at TIMESTAMP, -- 完成时间
    CONSTRAINT export_logs_pkey PRIMARY KEY (id)
);

-- Table: fee_audit_logs (排课费用修改审计日志表)
CREATE TABLE fee_audit_logs (
    id INTEGER, -- 主键 ID
    schedule_id INTEGER NOT NULL, -- 关联排课 ID
    operator_id INTEGER NOT NULL, -- 操作人 ID
    operator_role VARCHAR(20) NOT NULL, -- 操作人角色 (admin, teacher)
    old_transport_fee DECIMAL(10,2) DEFAULT 0, -- 修改前交通费
    new_transport_fee DECIMAL(10,2) DEFAULT 0, -- 修改后交通费
    old_other_fee DECIMAL(10,2) DEFAULT 0, -- 修改前其他费用
    new_other_fee DECIMAL(10,2) DEFAULT 0, -- 修改后其他费用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    CONSTRAINT fee_audit_logs_pkey PRIMARY KEY (id)
);

-- Table: schedule_auto_update_logs (排课自动更新日志表)
CREATE TABLE schedule_auto_update_logs (
    id INTEGER, -- 主键 ID
    schedule_id INTEGER NOT NULL, -- 关联排课 ID
    previous_status VARCHAR(20) NOT NULL, -- 更新前状态
    new_status VARCHAR(20) NOT NULL, -- 更新后状态
    run_id UUID NOT NULL, -- 执行批次 ID
    note TEXT, -- 备注
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    CONSTRAINT schedule_auto_update_logs_pkey PRIMARY KEY (id)
);

-- Table: schedule_types (课程类型表)
CREATE TABLE schedule_types (
    id INTEGER, -- 主键 ID
    name VARCHAR(50) NOT NULL, -- 类型名称 (唯一)
    description TEXT, -- 类型描述
    CONSTRAINT schedule_types_name_key UNIQUE (name),
    CONSTRAINT schedule_types_pkey PRIMARY KEY (id)
);

-- Table: student_daily_availability (学生每日可用性表)
CREATE TABLE student_daily_availability (
    id INTEGER, -- 主键 ID
    student_id INTEGER NOT NULL, -- 关联学生 ID
    date DATE NOT NULL, -- 日期
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    morning_available INTEGER NOT NULL DEFAULT 0, -- 上午是否可用 (0/1)
    afternoon_available INTEGER NOT NULL DEFAULT 0, -- 下午是否可用 (0/1)
    evening_available INTEGER NOT NULL DEFAULT 0, -- 晚上是否可用 (0/1)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    start_time TIME WITHOUT TIME ZONE NOT NULL, -- 开始时间
    end_time TIME WITHOUT TIME ZONE NOT NULL, -- 结束时间
    status VARCHAR(20) NOT NULL DEFAULT 'available'::character varying, -- 状态: available, unavailable
    CONSTRAINT uniq_student_daily_availability_slot UNIQUE (student_id, date, start_time, end_time),
    CONSTRAINT uk_student_daily_availability_student_date UNIQUE (student_id, date),
    CONSTRAINT student_availability_pkey PRIMARY KEY (id),
    CONSTRAINT chk_student_daily_availability_status CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'unavailable'::character varying])::text[]))),
    CONSTRAINT chk_student_morning_available CHECK ((morning_available = ANY (ARRAY[0, 1]))),
    CONSTRAINT chk_student_afternoon_available CHECK ((afternoon_available = ANY (ARRAY[0, 1]))),
    CONSTRAINT chk_student_evening_available CHECK ((evening_available = ANY (ARRAY[0, 1])))
);

-- Table: students (学生表)
CREATE TABLE students (
    id INTEGER, -- 主键 ID
    username VARCHAR(50) NOT NULL, -- 用户名 (唯一)
    password_hash VARCHAR(255) NOT NULL, -- 密码哈希值
    name VARCHAR(100) NOT NULL, -- 姓名
    profession VARCHAR(100), -- 年级
    contact VARCHAR(100), -- 联系方式
    visit_location TEXT, -- 入户/上课地点
    home_address TEXT, -- 家庭住址
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    last_login TIMESTAMP, -- 最后登录时间
    status INTEGER NOT NULL DEFAULT 1, -- 状态: 1=正常, 0=禁用, -1=删除
    CONSTRAINT students_username_key UNIQUE (username),
    CONSTRAINT students_pkey PRIMARY KEY (id),
    CONSTRAINT students_status_check CHECK ((status = ANY (ARRAY['-1'::integer, 0, 1])))
);

-- Table: teacher_daily_availability (教师每日可用性表)
CREATE TABLE teacher_daily_availability (
    id INTEGER, -- 主键 ID
    teacher_id INTEGER NOT NULL, -- 关联教师 ID
    date DATE NOT NULL, -- 日期
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    morning_available INTEGER NOT NULL DEFAULT 0, -- 上午是否可用 (0/1)
    afternoon_available INTEGER NOT NULL DEFAULT 0, -- 下午是否可用 (0/1)
    evening_available INTEGER NOT NULL DEFAULT 0, -- 晚上是否可用 (0/1)
    start_time TIME WITHOUT TIME ZONE NOT NULL, -- 开始时间
    end_time TIME WITHOUT TIME ZONE NOT NULL, -- 结束时间
    status VARCHAR(20) NOT NULL DEFAULT 'available'::character varying, -- 状态: available, unavailable
    CONSTRAINT uniq_teacher_daily_availability_slot UNIQUE (teacher_id, date, start_time, end_time),
    CONSTRAINT uk_teacher_daily_availability_teacher_date UNIQUE (teacher_id, date),
    CONSTRAINT teacher_availability_pkey PRIMARY KEY (id),
    CONSTRAINT chk_teacher_daily_availability_status CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'unavailable'::character varying])::text[]))),
    CONSTRAINT chk_teacher_morning_available CHECK ((morning_available = ANY (ARRAY[0, 1]))),
    CONSTRAINT chk_teacher_afternoon_available CHECK ((afternoon_available = ANY (ARRAY[0, 1]))),
    CONSTRAINT chk_teacher_evening_available CHECK ((evening_available = ANY (ARRAY[0, 1])))
);

-- Table: teachers (教师表)
CREATE TABLE teachers (
    id INTEGER, -- 主键 ID
    username VARCHAR(50) NOT NULL, -- 用户名 (唯一)
    password_hash VARCHAR(255) NOT NULL, -- 密码哈希值
    name VARCHAR(100) NOT NULL, -- 姓名
    profession VARCHAR(100), -- 职业/职称
    contact VARCHAR(100), -- 联系方式
    work_location TEXT, -- 工作地点
    home_address TEXT, -- 家庭住址
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    last_login TIMESTAMP, -- 最后登录时间
    status INTEGER NOT NULL DEFAULT 1, -- 状态: 1=正常, 0=禁用, -1=删除
    restriction INTEGER DEFAULT 1, -- 限制等级 (0-5)，0=无限制，1=按时间安排显示，2及以上暂未定义
    student_ids VARCHAR(500), -- 关联学生ID列表 (逗号分隔)
    CONSTRAINT teachers_username_key UNIQUE (username),
    CONSTRAINT teachers_pkey PRIMARY KEY (id),
    CONSTRAINT teachers_status_check CHECK ((status = ANY (ARRAY['-1'::integer, 0, 1]))),
    CONSTRAINT teachers_restriction_check CHECK (restriction IN (0, 1, 2, 3, 4, 5))
);

-- Foreign Keys： 外键
ALTER TABLE course_arrangement ADD CONSTRAINT course_arrangement_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE course_arrangement ADD CONSTRAINT course_arrangement_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE course_arrangement ADD CONSTRAINT course_arrangement_course_id_fkey FOREIGN KEY (course_id) REFERENCES schedule_types(id) ON DELETE RESTRICT;
ALTER TABLE course_arrangement ADD CONSTRAINT course_arrangement_created_by_fkey FOREIGN KEY (created_by) REFERENCES administrators(id) ON UPDATE CASCADE;
ALTER TABLE schedule_auto_update_logs ADD CONSTRAINT schedule_auto_update_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES course_arrangement(id) ON DELETE CASCADE;
ALTER TABLE student_daily_availability ADD CONSTRAINT student_daily_availability_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE student_daily_availability ADD CONSTRAINT fk_student_daily_availability_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE teacher_daily_availability ADD CONSTRAINT teacher_daily_availability_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE teacher_daily_availability ADD CONSTRAINT fk_teacher_daily_availability_teacher_id FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes： 索引
CREATE INDEX idx_administrators_created_at ON public.administrators USING btree (created_at);
CREATE UNIQUE INDEX idx_administrators_email_unique ON public.administrators USING btree (email);
CREATE INDEX idx_administrators_last_login ON public.administrators USING btree (last_login);
CREATE INDEX idx_ca_status_classdate_lastupdate ON public.course_arrangement USING btree (status, class_date, last_auto_update);
CREATE INDEX idx_course_arrangement_course ON public.course_arrangement USING btree (course_id);
CREATE INDEX idx_course_arrangement_date_status ON public.course_arrangement USING btree (class_date, status);
CREATE INDEX idx_course_arrangement_date_student ON public.course_arrangement USING btree (class_date, student_id);
CREATE INDEX idx_course_arrangement_date_teacher ON public.course_arrangement USING btree (class_date, teacher_id);
CREATE INDEX idx_course_arrangement_student ON public.course_arrangement USING btree (student_id);
CREATE INDEX idx_course_arrangement_teacher ON public.course_arrangement USING btree (teacher_id);
CREATE INDEX idx_course_arrangement_type ON public.course_arrangement USING btree (course_id);
CREATE INDEX idx_admin_id ON public.export_logs USING btree (admin_id);
CREATE INDEX idx_created_at ON public.export_logs USING btree (created_at);
CREATE INDEX idx_export_type ON public.export_logs USING btree (export_type);
CREATE INDEX idx_schedule_types_name ON public.schedule_types USING btree (name);
CREATE INDEX idx_student_availability_date ON public.student_daily_availability USING btree (date);
CREATE INDEX idx_student_daily_availability_date ON public.student_daily_availability USING btree (student_id, date);
CREATE INDEX idx_student_daily_availability_date_status ON public.student_daily_availability USING btree (date, status);
CREATE INDEX idx_student_daily_availability_slots ON public.student_daily_availability USING btree (date, morning_available, afternoon_available, evening_available);
CREATE INDEX idx_student_daily_availability_student_date ON public.student_daily_availability USING btree (student_id, date);
CREATE INDEX idx_students_created_at ON public.students USING btree (created_at);
CREATE INDEX idx_students_last_login ON public.students USING btree (last_login);
CREATE INDEX idx_students_name ON public.students USING btree (name);
CREATE INDEX idx_students_status ON public.students USING btree (status);
CREATE INDEX idx_students_visit_location ON public.students USING btree (visit_location);
CREATE INDEX idx_teacher_availability_date ON public.teacher_daily_availability USING btree (date);
CREATE INDEX idx_teacher_daily_availability_date ON public.teacher_daily_availability USING btree (teacher_id, date);
CREATE INDEX idx_teacher_daily_availability_date_status ON public.teacher_daily_availability USING btree (date, status);
CREATE INDEX idx_teacher_daily_availability_slots ON public.teacher_daily_availability USING btree (date, morning_available, afternoon_available, evening_available);
ALTER TABLE fee_audit_logs ADD CONSTRAINT fee_audit_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES course_arrangement(id) ON DELETE CASCADE;
CREATE INDEX idx_fee_audit_logs_schedule ON public.fee_audit_logs USING btree (schedule_id);
CREATE INDEX idx_fee_audit_logs_operator ON public.fee_audit_logs USING btree (operator_id, operator_role);
CREATE INDEX idx_teacher_daily_availability_teacher_date ON public.teacher_daily_availability USING btree (teacher_id, date);
CREATE INDEX idx_teachers_created_at ON public.teachers USING btree (created_at);
CREATE INDEX idx_teachers_last_login ON public.teachers USING btree (last_login);
CREATE INDEX idx_teachers_name ON public.teachers USING btree (name);
CREATE INDEX idx_teachers_status ON public.teachers USING btree (status);

-- Triggers： 自动更新
CREATE TRIGGER tr_course_arrangement_updated BEFORE UPDATE ON public.course_arrangement FOR EACH ROW EXECUTE FUNCTION update_course_arrangement_updated_at();
