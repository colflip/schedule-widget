# Daily Availability 表设计规范

## 📌 表结构说明

### teacher_daily_availability - 教师日常可用性表

存储教师在某一特定日期内三个时段的可用性状态。

**表名**：`teacher_daily_availability`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY | 记录唯一标识符 |
| `teacher_id` | INTEGER | NOT NULL, FK | 教师ID（引用teachers.id） |
| `date` | DATE | NOT NULL | 日期 |
| `morning_available` | INTEGER | NOT NULL DEFAULT 0, CHECK IN (0,1) | 上午可用性：0=不可用，1=可用 |
| `afternoon_available` | INTEGER | NOT NULL DEFAULT 0, CHECK IN (0,1) | 下午可用性：0=不可用，1=可用 |
| `evening_available` | INTEGER | NOT NULL DEFAULT 0, CHECK IN (0,1) | 晚上可用性：0=不可用，1=可用 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 最后更新时间 |

**唯一约束**：`(teacher_id, date)` - 每个教师每天只能有一条记录  
**时段划分**：
- 上午：08:00 - 12:00
- 下午：13:00 - 17:00
- 晚上：18:00 - 21:00

### student_daily_availability - 学生日常可用性表

存储学生在某一特定日期内三个时段的可用性状态。

**表名**：`student_daily_availability`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY | 记录唯一标识符 |
| `student_id` | INTEGER | NOT NULL, FK | 学生ID（引用students.id） |
| `date` | DATE | NOT NULL | 日期 |
| `morning_available` | INTEGER | NOT NULL DEFAULT 0, CHECK IN (0,1) | 上午可用性：0=不可用，1=可用 |
| `afternoon_available` | INTEGER | NOT NULL DEFAULT 0, CHECK IN (0,1) | 下午可用性：0=不可用，1=可用 |
| `evening_available` | INTEGER | NOT NULL DEFAULT 0, CHECK IN (0,1) | 晚上可用性：0=不可用，1=可用 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**唯一约束**：`(student_id, date)` - 每个学生每天只能有一条记录

## 💾 数据操作示例

### 使用 ON CONFLICT 进行 upsert 操作

```javascript
// 更新或插入教师可用性
const result = await db.query(`
  INSERT INTO teacher_daily_availability 
    (teacher_id, date, morning_available, afternoon_available, evening_available)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (teacher_id, date) DO UPDATE SET
    morning_available = EXCLUDED.morning_available,
    afternoon_available = EXCLUDED.afternoon_available,
    evening_available = EXCLUDED.evening_available,
    updated_at = CURRENT_TIMESTAMP
  RETURNING *
`, [teacherId, date, 1, 1, 0]);
```

### 查询特定教师的可用时段

```javascript
// 查询教师在指定日期的可用时段
const result = await db.query(`
  SELECT 
    teacher_id,
    date,
    morning_available,
    afternoon_available,
    evening_available,
    CASE 
      WHEN morning_available = 1 AND afternoon_available = 1 AND evening_available = 1 THEN '全天'
      WHEN morning_available = 1 AND afternoon_available = 1 THEN '上午和下午'
      WHEN morning_available = 1 THEN '仅上午'
      WHEN afternoon_available = 1 THEN '仅下午'
      WHEN evening_available = 1 THEN '仅晚上'
      ELSE '无空闲'
    END as availability_summary
  FROM teacher_daily_availability
  WHERE teacher_id = $1 AND date = $2
`, [teacherId, date]);
```

### 查询某个时段内可用的所有人员

```javascript
// 查询指定日期上午可用的所有教师
const result = await db.query(`
  SELECT teacher_id, date
  FROM teacher_daily_availability
  WHERE date = $1 AND morning_available = 1
  ORDER BY teacher_id
`, [date]);

// 查询指定日期下午可用的所有学生
const result = await db.query(`
  SELECT student_id, date
  FROM student_daily_availability
  WHERE date = $1 AND afternoon_available = 1
  ORDER BY student_id
`, [date]);
```

### 查询教师和学生的时段重合

```javascript
// 查询教师和学生都在上午可用的情况
const result = await db.query(`
  SELECT 
    t.teacher_id,
    s.student_id,
    t.date,
    '上午' as time_slot
  FROM teacher_daily_availability t
  JOIN student_daily_availability s 
    ON t.date = s.date
  WHERE t.date = $1 
    AND t.morning_available = 1 
    AND s.morning_available = 1
  ORDER BY t.teacher_id, s.student_id
`, [date]);
```

### 查询多天的可用性汇总

```javascript
// 查询教师一周的可用性
const result = await db.query(`
  SELECT 
    teacher_id,
    date,
    morning_available,
    afternoon_available,
    evening_available,
    (morning_available + afternoon_available + evening_available) as available_slots
  FROM teacher_daily_availability
  WHERE teacher_id = $1 
    AND date >= $2 
    AND date < $3
  ORDER BY date
`, [teacherId, startDate, endDate]);
```

## 🔐 约束验证

### CHECK 约束 - 字段值必须为 0 或 1

```javascript
// ❌ 这会触发 CHECK 约束错误
await db.query(`
  INSERT INTO teacher_daily_availability 
    (teacher_id, date, morning_available, afternoon_available, evening_available)
  VALUES (1, CURRENT_DATE, 2, 1, 0)
`);
// 错误: check constraint "chk_teacher_morning_available" is violated

// ✅ 正确的用法
await db.query(`
  INSERT INTO teacher_daily_availability 
    (teacher_id, date, morning_available, afternoon_available, evening_available)
  VALUES (1, CURRENT_DATE, 1, 1, 0)
`);
```

### 唯一约束 - 每个用户每天只有一条记录

```javascript
// ❌ 第二次插入相同的 (teacher_id, date) 会违反唯一约束
await db.query(`
  INSERT INTO teacher_daily_availability 
    (teacher_id, date, morning_available, afternoon_available, evening_available)
  VALUES (1, CURRENT_DATE, 1, 1, 0)
`);

await db.query(`
  INSERT INTO teacher_daily_availability 
    (teacher_id, date, morning_available, afternoon_available, evening_available)
  VALUES (1, CURRENT_DATE, 0, 1, 1)
`);
// 错误: duplicate key value violates unique constraint "uk_teacher_daily_availability_teacher_date"

// ✅ 使用 ON CONFLICT 进行更新
await db.query(`
  INSERT INTO teacher_daily_availability 
    (teacher_id, date, morning_available, afternoon_available, evening_available)
  VALUES (1, CURRENT_DATE, 0, 1, 1)
  ON CONFLICT (teacher_id, date) DO UPDATE SET
    morning_available = EXCLUDED.morning_available,
    afternoon_available = EXCLUDED.afternoon_available,
    evening_available = EXCLUDED.evening_available
`);
```

### 外键约束 - 教师/学生必须存在

```javascript
// ❌ 这会触发外键约束错误（teacher_id 不存在）
await db.query(`
  INSERT INTO teacher_daily_availability 
    (teacher_id, date, morning_available, afternoon_available, evening_available)
  VALUES (99999, CURRENT_DATE, 1, 1, 0)
`);
// 错误: insert or update on table "teacher_daily_availability" violates foreign key constraint

// ✅ 确保 teacher_id 存在于 teachers 表中
const teacherExists = await db.query(
  'SELECT id FROM teachers WHERE id = $1',
  [teacherId]
);
if (teacherExists.rows.length > 0) {
  // 安全进行插入
}
```

## 📊 常见查询模式

### 1. 获取用户的完整可用性信息

```javascript
async function getUserAvailability(userId, role, date) {
  const table = role === 'teacher' ? 'teacher_daily_availability' : 'student_daily_availability';
  const userField = role === 'teacher' ? 'teacher_id' : 'student_id';
  
  const result = await db.query(`
    SELECT * FROM ${table}
    WHERE ${userField} = $1 AND date = $2
  `, [userId, date]);
  
  return result.rows[0] || {
    morning_available: 0,
    afternoon_available: 0,
    evening_available: 0
  };
}
```

### 2. 检查某个时段是否可用

```javascript
async function isAvailableInSlot(userId, role, date, slot) {
  const availability = await getUserAvailability(userId, role, date);
  const slotMap = {
    'morning': 'morning_available',
    'afternoon': 'afternoon_available',
    'evening': 'evening_available'
  };
  return availability[slotMap[slot]] === 1;
}
```

### 3. 获取可用的时段列表

```javascript
async function getAvailableSlots(userId, role, date) {
  const availability = await getUserAvailability(userId, role, date);
  const slots = [];
  
  if (availability.morning_available === 1) slots.push('morning');
  if (availability.afternoon_available === 1) slots.push('afternoon');
  if (availability.evening_available === 1) slots.push('evening');
  
  return slots;
}
```

## 🎯 业务规则

1. **每个用户每天只能有一条可用性记录**
   - 使用 `(teacher_id/student_id, date)` 的唯一约束

2. **时段值必须为 0（不可用）或 1（可用）**
   - 使用 CHECK 约束强制执行

3. **默认情况下所有时段都不可用**
   - 新插入记录时，所有时段默认为 0

4. **支持部分时段可用**
   - 例如：教师只在上午和下午可用，晚上不可用 (1, 1, 0)

5. **记录一旦创建，可以通过 upsert 更新**
   - 使用 ON CONFLICT 子句处理更新

---

**最后更新**：2025-11-11  
**版本**：1.0
# 数据库文档

## 表名列表
- administrators
- course_arrangement
- schedule_types
- student_daily_availability
- students
- teacher_daily_availability
- teachers

## 表间关系图
```mermaid
erDiagram
  administrators {
    integer id PK
    character varying username
    character varying password_hash
    character varying name
    integer permission_level
    timestamp without time zone created_at
    timestamp without time zone last_login
    character varying email
  }
  course_arrangement {
    integer id PK
    integer teacher_id
    integer student_id
    integer course_id
    date class_date
    time without time zone start_time
    time without time zone end_time
    text location
    timestamp without time zone created_at
    timestamp without time zone updated_at
    character varying status
    smallint student_rating
    smallint teacher_rating
    text student_comment
    text teacher_comment
    integer created_by
  }
  schedule_types {
    integer id PK
    character varying name
    text description
  }
  student_daily_availability {
    integer id PK
    integer student_id
    date date
    timestamp without time zone created_at
    time without time zone start_time
    time without time zone end_time
    text status
  }
  students {
    integer id PK
    character varying username
    character varying password_hash
    character varying name
    character varying profession
    character varying contact
    text visit_location
    text home_address
    timestamp without time zone created_at
    timestamp without time zone last_login
  }
  teacher_daily_availability {
    integer id PK
    integer teacher_id
    date date
    timestamp without time zone created_at
    time without time zone start_time
    time without time zone end_time
    text status
  }
  teachers {
    integer id PK
    character varying username
    character varying password_hash
    character varying name
    character varying profession
    character varying contact
    text work_location
    text home_address
    timestamp without time zone created_at
    timestamp without time zone last_login
  }
  course_arrangement }o--|| teachers : teacher_id→id
  course_arrangement }o--|| students : student_id→id
  course_arrangement }o--|| schedule_types : course_id→id
  course_arrangement }o--|| administrators : created_by→id
  student_daily_availability }o--|| students : student_id→id
  teacher_daily_availability }o--|| teachers : teacher_id→id
```

## 表详细说明
### administrators
- 业务含义：管理员账户与权限相关信息
- 字段
  - id (integer, NOT NULL, DEFAULT nextval('administrators_id_seq'::regclass), PK)
  - username (character varying, NOT NULL)
  - password_hash (character varying, NOT NULL)
  - name (character varying, NOT NULL)
  - permission_level (integer, NOT NULL)
  - created_at (timestamp without time zone, DEFAULT CURRENT_TIMESTAMP)
  - last_login (timestamp without time zone)
  - email (character varying, NOT NULL)
- 主键：id
- 索引：
  - administrators_email_unique: CREATE UNIQUE INDEX administrators_email_unique ON public.administrators USING btree (email)
  - administrators_pkey: CREATE UNIQUE INDEX administrators_pkey ON public.administrators USING btree (id)
  - administrators_username_key: CREATE UNIQUE INDEX administrators_username_key ON public.administrators USING btree (username)
  - idx_administrators_created_at: CREATE INDEX idx_administrators_created_at ON public.administrators USING btree (created_at)
  - idx_administrators_email_unique: CREATE UNIQUE INDEX idx_administrators_email_unique ON public.administrators USING btree (email)
  - idx_administrators_last_login: CREATE INDEX idx_administrators_last_login ON public.administrators USING btree (last_login)

### course_arrangement
- 业务含义：业务表（依据字段名可进一步细化）
- 字段
  - id (integer, NOT NULL, DEFAULT nextval('course_arrangement_id_seq'::regclass), PK)
  - teacher_id (integer, NOT NULL)
  - student_id (integer, NOT NULL)
  - course_id (integer, NOT NULL)
  - class_date (date, NOT NULL)
  - start_time (time without time zone, NOT NULL)
  - end_time (time without time zone, NOT NULL)
  - location (text)
  - created_at (timestamp without time zone, DEFAULT CURRENT_TIMESTAMP)
  - updated_at (timestamp without time zone, DEFAULT CURRENT_TIMESTAMP)
  - status (character varying, DEFAULT 'pending'::character varying)
  - student_rating (smallint)
  - teacher_rating (smallint)
  - student_comment (text)
  - teacher_comment (text)
  - created_by (integer)
- 主键：id
- 外键：
  - course_arrangement_teacher_id_fkey: (teacher_id) → teachers(id)
  - course_arrangement_student_id_fkey: (student_id) → students(id)
  - course_arrangement_course_id_fkey: (course_id) → schedule_types(id)
  - course_arrangement_created_by_fkey: (created_by) → administrators(id)
- 索引：
  - course_arrangement_pkey: CREATE UNIQUE INDEX course_arrangement_pkey ON public.course_arrangement USING btree (id)
  - idx_course_arrangement_course: CREATE INDEX idx_course_arrangement_course ON public.course_arrangement USING btree (course_id)
  - idx_course_arrangement_date_status: CREATE INDEX idx_course_arrangement_date_status ON public.course_arrangement USING btree (class_date, status)
  - idx_course_arrangement_date_student: CREATE INDEX idx_course_arrangement_date_student ON public.course_arrangement USING btree (class_date, student_id)
  - idx_course_arrangement_date_teacher: CREATE INDEX idx_course_arrangement_date_teacher ON public.course_arrangement USING btree (class_date, teacher_id)
  - idx_course_arrangement_student: CREATE INDEX idx_course_arrangement_student ON public.course_arrangement USING btree (student_id)
  - idx_course_arrangement_teacher: CREATE INDEX idx_course_arrangement_teacher ON public.course_arrangement USING btree (teacher_id)
  - idx_course_arrangement_teacher_datetime: CREATE UNIQUE INDEX idx_course_arrangement_teacher_datetime ON public.course_arrangement USING btree (teacher_id, class_date, start_time, end_time)
  - idx_course_arrangement_type: CREATE INDEX idx_course_arrangement_type ON public.course_arrangement USING btree (course_id)
  - uq_course_arrangement_unique: CREATE UNIQUE INDEX uq_course_arrangement_unique ON public.course_arrangement USING btree (teacher_id, student_id, class_date, start_time, end_time)

#### 兼容日期列说明
- 由于后续分区迁移，course_arrangement 可能同时存在 `arr_date` 或历史列 `class_date`/`date`。
- 后端接口通过动态检测列存在性选择有效日期列（arr_date > class_date > date），避免接口与数据库结构不一致。

#### 冲突判定与校验规则
- 时间重叠定义：两个区间 [start_time, end_time) 与 [new_start, new_end) 重叠当且仅当 NOT (end_time <= new_start OR start_time >= new_end)。
- 教师冲突：同一教师在同一日期列上出现时间重叠视为冲突。
- 学生冲突：同一学生在同一日期列上出现时间重叠视为冲突。
- 地点冲突：同一地点在同一日期列上出现时间重叠视为冲突。
- 更新接口在保存前执行上述冲突检测，若存在冲突将返回 400 与明确字段与提示文案；若数据库唯一约束触发，将返回详细错误映射。

### schedule_types
- 业务含义：课程/活动类型定义字典
- 字段
  - id (integer, NOT NULL, DEFAULT nextval('schedule_types_id_seq'::regclass), PK)
  - name (character varying, NOT NULL)
  - description (text)
- 主键：id
- 索引：
  - idx_schedule_types_name: CREATE INDEX idx_schedule_types_name ON public.schedule_types USING btree (name)
  - schedule_types_name_key: CREATE UNIQUE INDEX schedule_types_name_key ON public.schedule_types USING btree (name)
  - schedule_types_pkey: CREATE UNIQUE INDEX schedule_types_pkey ON public.schedule_types USING btree (id)

### student_daily_availability
- 业务含义：学生信息、可用性与课程关联
- 字段
  - id (integer, NOT NULL, DEFAULT nextval('student_availability_id_seq'::regclass), PK)
  - student_id (integer, NOT NULL)
  - date (date, NOT NULL)
  - created_at (timestamp without time zone, DEFAULT CURRENT_TIMESTAMP)
  - start_time (time without time zone, NOT NULL)
  - end_time (time without time zone, NOT NULL)
  - status (text, NOT NULL)
- 主键：id
- 外键：
  - student_daily_availability_student_id_fkey: (student_id) → students(id)
- 索引：
  - idx_student_availability_date: CREATE INDEX idx_student_availability_date ON public.student_daily_availability USING btree (date)
  - idx_student_daily_availability_date_status: CREATE INDEX idx_student_daily_availability_date_status ON public.student_daily_availability USING btree (date, status)
  - idx_student_daily_availability_student_date: CREATE INDEX idx_student_daily_availability_student_date ON public.student_daily_availability USING btree (student_id, date)
  - idx_student_daily_availability_unique: CREATE UNIQUE INDEX idx_student_daily_availability_unique ON public.student_daily_availability USING btree (student_id, date, start_time, end_time)
  - student_availability_pkey: CREATE UNIQUE INDEX student_availability_pkey ON public.student_daily_availability USING btree (id)
  - uniq_student_daily_availability_slot: CREATE UNIQUE INDEX uniq_student_daily_availability_slot ON public.student_daily_availability USING btree (student_id, date, start_time, end_time)

### students
- 业务含义：学生信息、可用性与课程关联
- 字段
  - id (integer, NOT NULL, DEFAULT nextval('students_id_seq'::regclass), PK)
  - username (character varying, NOT NULL)
  - password_hash (character varying, NOT NULL)
  - name (character varying, NOT NULL)
  - profession (character varying)
  - contact (character varying)
  - visit_location (text)
  - home_address (text)
  - status (integer, NOT NULL, DEFAULT 1)  // -1 删除，0 暂停，1 正常
  - created_at (timestamp without time zone, DEFAULT CURRENT_TIMESTAMP)
  - last_login (timestamp without time zone)
- 主键：id
- 索引：
  - idx_students_created_at: CREATE INDEX idx_students_created_at ON public.students USING btree (created_at)
  - idx_students_last_login: CREATE INDEX idx_students_last_login ON public.students USING btree (last_login)
  - idx_students_name: CREATE INDEX idx_students_name ON public.students USING btree (name)
  - idx_students_visit_location: CREATE INDEX idx_students_visit_location ON public.students USING btree (visit_location)
  - students_pkey: CREATE UNIQUE INDEX students_pkey ON public.students USING btree (id)
  - students_username_key: CREATE UNIQUE INDEX students_username_key ON public.students USING btree (username)

### teacher_daily_availability
- 业务含义：教师基本信息、可用性、排课与确认
- 字段
  - id (integer, NOT NULL, DEFAULT nextval('teacher_availability_id_seq'::regclass), PK)
  - teacher_id (integer, NOT NULL)
  - date (date, NOT NULL)
  - created_at (timestamp without time zone, DEFAULT CURRENT_TIMESTAMP)
  - start_time (time without time zone, NOT NULL)
  - end_time (time without time zone, NOT NULL)
  - status (text, NOT NULL)
- 主键：id
- 外键：
  - teacher_daily_availability_teacher_id_fkey: (teacher_id) → teachers(id)
- 索引：
  - idx_teacher_availability_date: CREATE INDEX idx_teacher_availability_date ON public.teacher_daily_availability USING btree (date)
  - idx_teacher_daily_availability_date_status: CREATE INDEX idx_teacher_daily_availability_date_status ON public.teacher_daily_availability USING btree (date, status)
  - idx_teacher_daily_availability_teacher_date: CREATE INDEX idx_teacher_daily_availability_teacher_date ON public.teacher_daily_availability USING btree (teacher_id, date)
  - idx_teacher_daily_availability_unique: CREATE UNIQUE INDEX idx_teacher_daily_availability_unique ON public.teacher_daily_availability USING btree (teacher_id, date, start_time, end_time)
  - teacher_availability_pkey: CREATE UNIQUE INDEX teacher_availability_pkey ON public.teacher_daily_availability USING btree (id)
  - uniq_teacher_daily_availability_slot: CREATE UNIQUE INDEX uniq_teacher_daily_availability_slot ON public.teacher_daily_availability USING btree (teacher_id, date, start_time, end_time)

### teachers
- 业务含义：教师基本信息、可用性、排课与确认
- 字段
  - id (integer, NOT NULL, DEFAULT nextval('teachers_id_seq'::regclass), PK)
  - username (character varying, NOT NULL)
  - password_hash (character varying, NOT NULL)
  - name (character varying, NOT NULL)
  - profession (character varying)
  - contact (character varying)
  - work_location (text)
  - home_address (text)
  - status (integer, NOT NULL, DEFAULT 1)  // -1 删除，0 暂停，1 正常
  - created_at (timestamp without time zone, DEFAULT CURRENT_TIMESTAMP)
  - last_login (timestamp without time zone)
- 主键：id
- 索引：
  - idx_teachers_created_at: CREATE INDEX idx_teachers_created_at ON public.teachers USING btree (created_at)
  - idx_teachers_last_login: CREATE INDEX idx_teachers_last_login ON public.teachers USING btree (last_login)
  - idx_teachers_name: CREATE INDEX idx_teachers_name ON public.teachers USING btree (name)
  - teachers_pkey: CREATE UNIQUE INDEX teachers_pkey ON public.teachers USING btree (id)
  - teachers_username_key: CREATE UNIQUE INDEX teachers_username_key ON public.teachers USING btree (username)
