-- Clean up existing schema
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

-- Functions
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

-- Table: administrators
CREATE TABLE administrators (
    id INTEGER,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    permission_level INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    email VARCHAR(255) NOT NULL,
    CONSTRAINT administrators_username_key UNIQUE (username),
    CONSTRAINT administrators_email_unique UNIQUE (email),
    CONSTRAINT administrators_pkey PRIMARY KEY (id),
    CONSTRAINT administrators_permission_level_check CHECK (((permission_level >= 1) AND (permission_level <= 3))),
    CONSTRAINT administrators_email_format CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text))
);

-- Table: course_arrangement
CREATE TABLE course_arrangement (
    id INTEGER,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    class_date DATE NOT NULL,
    start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE NOT NULL,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending'::character varying,
    student_rating SMALLINT,
    teacher_rating SMALLINT,
    student_comment TEXT,
    teacher_comment TEXT,
    created_by INTEGER,
    last_auto_update TIMESTAMP,
    CONSTRAINT course_arrangement_pkey PRIMARY KEY (id),
    CONSTRAINT course_arrangement_time_order_chk CHECK ((end_time > start_time)),
    CONSTRAINT course_arrangement_student_rating_range CHECK (((student_rating >= 1) AND (student_rating <= 5))),
    CONSTRAINT course_arrangement_teacher_rating_range CHECK (((teacher_rating >= 1) AND (teacher_rating <= 5))),
    CONSTRAINT course_arrangement_status_enum CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[])))
);

-- Table: export_logs
CREATE TABLE export_logs (
    id INTEGER,
    admin_id INTEGER,
    admin_name VARCHAR(255),
    export_type VARCHAR(50) NOT NULL,
    export_format VARCHAR(20) NOT NULL,
    start_date DATE,
    end_date DATE,
    record_count INTEGER DEFAULT 0,
    file_size BIGINT,
    file_name VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    CONSTRAINT export_logs_pkey PRIMARY KEY (id)
);

-- Table: schedule_auto_update_logs
CREATE TABLE schedule_auto_update_logs (
    id INTEGER,
    schedule_id INTEGER NOT NULL,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    run_id UUID NOT NULL,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT schedule_auto_update_logs_pkey PRIMARY KEY (id)
);

-- Table: schedule_types
CREATE TABLE schedule_types (
    id INTEGER,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    CONSTRAINT schedule_types_name_key UNIQUE (name),
    CONSTRAINT schedule_types_pkey PRIMARY KEY (id)
);

-- Table: student_daily_availability
CREATE TABLE student_daily_availability (
    id INTEGER,
    student_id INTEGER NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    morning_available INTEGER NOT NULL DEFAULT 0,
    afternoon_available INTEGER NOT NULL DEFAULT 0,
    evening_available INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available'::character varying,
    CONSTRAINT uniq_student_daily_availability_slot UNIQUE (student_id, date, start_time, end_time),
    CONSTRAINT uk_student_daily_availability_student_date UNIQUE (student_id, date),
    CONSTRAINT student_availability_pkey PRIMARY KEY (id),
    CONSTRAINT chk_student_daily_availability_status CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'unavailable'::character varying])::text[]))),
    CONSTRAINT chk_student_morning_available CHECK ((morning_available = ANY (ARRAY[0, 1]))),
    CONSTRAINT chk_student_afternoon_available CHECK ((afternoon_available = ANY (ARRAY[0, 1]))),
    CONSTRAINT chk_student_evening_available CHECK ((evening_available = ANY (ARRAY[0, 1])))
);

-- Table: students
CREATE TABLE students (
    id INTEGER,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    profession VARCHAR(100),
    contact VARCHAR(100),
    visit_location TEXT,
    home_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    status INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT students_username_key UNIQUE (username),
    CONSTRAINT students_pkey PRIMARY KEY (id),
    CONSTRAINT students_status_check CHECK ((status = ANY (ARRAY['-1'::integer, 0, 1])))
);

-- Table: teacher_daily_availability
CREATE TABLE teacher_daily_availability (
    id INTEGER,
    teacher_id INTEGER NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    morning_available INTEGER NOT NULL DEFAULT 0,
    afternoon_available INTEGER NOT NULL DEFAULT 0,
    evening_available INTEGER NOT NULL DEFAULT 0,
    start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available'::character varying,
    CONSTRAINT uniq_teacher_daily_availability_slot UNIQUE (teacher_id, date, start_time, end_time),
    CONSTRAINT uk_teacher_daily_availability_teacher_date UNIQUE (teacher_id, date),
    CONSTRAINT teacher_availability_pkey PRIMARY KEY (id),
    CONSTRAINT chk_teacher_daily_availability_status CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'unavailable'::character varying])::text[]))),
    CONSTRAINT chk_teacher_morning_available CHECK ((morning_available = ANY (ARRAY[0, 1]))),
    CONSTRAINT chk_teacher_afternoon_available CHECK ((afternoon_available = ANY (ARRAY[0, 1]))),
    CONSTRAINT chk_teacher_evening_available CHECK ((evening_available = ANY (ARRAY[0, 1])))
);

-- Table: teachers
CREATE TABLE teachers (
    id INTEGER,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    profession VARCHAR(100),
    contact VARCHAR(100),
    work_location TEXT,
    home_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    status INTEGER NOT NULL DEFAULT 1,
    restriction INTEGER DEFAULT 1,
    CONSTRAINT teachers_username_key UNIQUE (username),
    CONSTRAINT teachers_pkey PRIMARY KEY (id),
    CONSTRAINT teachers_status_check CHECK ((status = ANY (ARRAY['-1'::integer, 0, 1]))),
    CONSTRAINT teachers_restriction_check CHECK (restriction IN (0, 1, 2, 3, 4, 5))
);

-- Foreign Keys
ALTER TABLE course_arrangement ADD CONSTRAINT course_arrangement_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;
ALTER TABLE course_arrangement ADD CONSTRAINT course_arrangement_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;
ALTER TABLE course_arrangement ADD CONSTRAINT course_arrangement_course_id_fkey FOREIGN KEY (course_id) REFERENCES schedule_types(id) ON DELETE RESTRICT;
ALTER TABLE course_arrangement ADD CONSTRAINT course_arrangement_created_by_fkey FOREIGN KEY (created_by) REFERENCES administrators(id);
ALTER TABLE schedule_auto_update_logs ADD CONSTRAINT schedule_auto_update_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES course_arrangement(id) ON DELETE CASCADE;
ALTER TABLE student_daily_availability ADD CONSTRAINT student_daily_availability_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE student_daily_availability ADD CONSTRAINT fk_student_daily_availability_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE teacher_daily_availability ADD CONSTRAINT teacher_daily_availability_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE teacher_daily_availability ADD CONSTRAINT fk_teacher_daily_availability_teacher_id FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- Indexes
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
CREATE INDEX idx_teacher_daily_availability_teacher_date ON public.teacher_daily_availability USING btree (teacher_id, date);
CREATE INDEX idx_teachers_created_at ON public.teachers USING btree (created_at);
CREATE INDEX idx_teachers_last_login ON public.teachers USING btree (last_login);
CREATE INDEX idx_teachers_name ON public.teachers USING btree (name);
CREATE INDEX idx_teachers_status ON public.teachers USING btree (status);

-- Triggers
CREATE TRIGGER tr_course_arrangement_updated BEFORE UPDATE ON public.course_arrangement FOR EACH ROW EXECUTE FUNCTION update_course_arrangement_updated_at();
