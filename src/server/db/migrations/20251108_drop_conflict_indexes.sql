-- 删除会导致老师时间/地点/学生冲突的唯一索引，允许同一时间段多条排课
-- 直接删除索引（如存在），避免在函数中使用 CONCURRENTLY
DROP INDEX IF EXISTS uq_course_arrangement_unique;
DROP INDEX IF EXISTS idx_course_arrangement_teacher_datetime;
