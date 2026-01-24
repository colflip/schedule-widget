/**
 * 测试数据生成脚本
 * @description 生成管理员、教师、学生和排课记录的测试数据
 * @usage node seed-test-data.js
 */

const bcrypt = require('bcrypt');
const db = require('../db/db');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad2(n) {
  return n.toString().padStart(2, '0');
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const copy = [...arr];
  const res = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    res.push(copy.splice(idx, 1)[0]);
  }
  return res;
}

function randomCNName(type) {
  const familyNames = ['张', '李', '王', '赵', '刘', '陈', '杨', '黄', '周', '吴'];
  const givenNames = ['伟', '芳', '娜', '敏', '静', '勇', '杰', '军', '磊', '洋', '超', '梅', '霞', '婷', '强'];
  const fn = sample(familyNames);
  const gn = sample(givenNames) + (Math.random() < 0.5 ? '' : sample(givenNames));
  return type === 'teacher' ? fn + gn + '老师' : (type === 'admin' ? fn + gn : fn + gn);
}

function randomAddress() {
  const cities = ['上海', '北京', '广州', '深圳', '杭州', '成都', '南京'];
  const districts = ['浦东新区', '海淀区', '天河区', '南山区', '西湖区', '武侯区', '玄武区'];
  const streets = ['人民路', '解放路', '中山路', '建设路', '新华路', '青年路'];
  return `${sample(cities)}${sample(districts)}${sample(streets)}${randInt(1, 999)}号`;
}

function randomPhone() {
  const prefix = sample(['138', '139', '137', '136', '135', '150', '151', '152']);
  return prefix + randInt(10000000, 99999999);
}

function randomProfession(type) {
  const tp = type === 'teacher'
    ? ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理']
    : ['小学生', '初中生', '高中生'];
  return sample(tp);
}

async function ensureScheduleTypes() {
  // 插入默认类型（若不存在）
  await db.query(`
    INSERT INTO schedule_types (name, description)
    VALUES 
      ('visit', '入户'),
      ('trial', '试教'),
      ('review', '评审'),
      ('review_record', '评审记录'),
      ('half_visit', '半次入户'),
      ('group_activity', '集体活动')
    ON CONFLICT (name) DO NOTHING;
  `);

  const typesRes = await db.query('SELECT id, name FROM schedule_types ORDER BY id');
  const typeIds = (typesRes.rows || []).map(r => r.id);
  if (typeIds.length === 0) {
    throw new Error('未找到任何 schedule_types');
  }
  return typeIds;
}

async function clearExistingData() {
  console.log('清理旧数据...');
  await db.query('DELETE FROM schedule_types_relation');
  await db.query('DELETE FROM schedule_students');
  await db.query('DELETE FROM schedules');
  await db.query('DELETE FROM teacher_availability');
  await db.query('DELETE FROM student_availability');
  await db.query('DELETE FROM teachers');
  await db.query('DELETE FROM students');
  await db.query('DELETE FROM administrators');
}

async function insertAdmins(count, passwordHash) {
  const adminIds = [];
  for (let i = 1; i <= count; i++) {
    const username = `admin${pad2(i)}`;
    const name = randomCNName('admin');
    const permissionLevel = randInt(1, 3);
    const res = await db.query(
      `INSERT INTO administrators (username, password_hash, name, permission_level)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [username, passwordHash, name, permissionLevel]
    );
    adminIds.push(res.rows[0].id);
  }
  return adminIds;
}

async function insertTeachers(count, passwordHash) {
  const teacherIds = [];
  for (let i = 1; i <= count; i++) {
    const username = `teacher${pad2(i)}`;
    const name = randomCNName('teacher');
    const profession = randomProfession('teacher');
    const contact = randomPhone();
    const workLocation = randomAddress();
    const homeAddress = randomAddress();
    const res = await db.query(
      `INSERT INTO teachers (username, password_hash, name, profession, contact, work_location, home_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [username, passwordHash, name, profession, contact, workLocation, homeAddress]
    );
    teacherIds.push(res.rows[0].id);
  }
  return teacherIds;
}

async function insertStudents(count, passwordHash) {
  const studentIds = [];
  for (let i = 1; i <= count; i++) {
    const username = `student${pad2(i)}`;
    const name = randomCNName('student');
    const profession = randomProfession('student');
    const contact = randomPhone();
    const visitLocation = randomAddress();
    const homeAddress = randomAddress();
    const res = await db.query(
      `INSERT INTO students (username, password_hash, name, profession, contact, visit_location, home_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [username, passwordHash, name, profession, contact, visitLocation, homeAddress]
    );
    studentIds.push(res.rows[0].id);
  }
  return studentIds;
}

function timeSlotToRange(slot) {
  switch (slot) {
    case 'morning':
      return { start: '09:00', end: '11:00' };
    case 'afternoon':
      return { start: '14:00', end: '16:00' };
    case 'evening':
      return { start: '18:30', end: '20:00' };
    default:
      return { start: '09:00', end: '11:00' };
  }
}

function randomDateWithin(daysAhead = 30) {
  const now = new Date();
  const offset = randInt(1, daysAhead);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

async function insertSchedules(count, adminId, teacherIds, studentIds, typeIds) {
  const slots = ['morning', 'afternoon', 'evening'];
  const scheduleIds = [];
  for (let i = 0; i < count; i++) {
    const teacherId = sample(teacherIds);
    const date = randomDateWithin(30);
    const timeSlot = sample(slots);
    const { start, end } = timeSlotToRange(timeSlot);
    const location = randomAddress();
    const chosenStudents = pickN(studentIds, randInt(1, Math.min(3, studentIds.length)));
    const chosenTypes = pickN(typeIds, randInt(1, Math.min(2, typeIds.length)));

    // 创建排课
    const scheduleRes = await db.query(
      `INSERT INTO schedules (teacher_id, date, time_slot, start_time, end_time, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING id`,
      [teacherId, date, timeSlot, start, end, adminId]
    );
    const scheduleId = scheduleRes.rows[0].id;
    scheduleIds.push(scheduleId);

    // 学生关联
    for (const sid of chosenStudents) {
      await db.query(
        `INSERT INTO schedule_students (schedule_id, student_id)
         VALUES ($1, $2)`,
        [scheduleId, sid]
      );
    }

    // 类型关联
    for (const tid of chosenTypes) {
      await db.query(
        `INSERT INTO schedule_types_relation (schedule_id, type_id)
         VALUES ($1, $2)`,
        [scheduleId, tid]
      );
    }
  }
  return scheduleIds;
}

async function main() {
  try {
    console.log('开始生成测试数据集...');

    // 统一密码哈希
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('123456', salt);

    await clearExistingData();

    // 确保排课类型存在
    const typeIds = await ensureScheduleTypes();

    // 创建用户
    const adminIds = await insertAdmins(5, passwordHash);
    const teacherIds = await insertTeachers(10, passwordHash);
    const studentIds = await insertStudents(10, passwordHash);

    // 使用第一个管理员作为 created_by
    const createdByAdmin = adminIds[0];

    // 创建排课记录
    const scheduleIds = await insertSchedules(40, createdByAdmin, teacherIds, studentIds, typeIds);

    console.log('数据生成完成:');
    console.log(`管理员: ${adminIds.length} 个`);
    console.log(`教师: ${teacherIds.length} 个`);
    console.log(`学生: ${studentIds.length} 个`);
    console.log(`排课: ${scheduleIds.length} 条`);
  } catch (e) {
    console.error('生成测试数据失败:', e?.message || e);
    throw e;
  } finally {
    // 结束进程
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});