const adminController = require('../controllers/adminController');
const teacherController = require('../controllers/teacherController');
const studentController = require('../controllers/studentController');

// 轻量模拟 db.query（可在每个测试中覆盖实现）
jest.mock('../db/db', () => ({
  query: jest.fn(async () => ({ rows: [] }))
}));
const db = require('../db/db');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('Status field handling', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('adminController.getSchedules adds status filters for teacher and student', async () => {
    // First call: getCaDateExpr column discovery
    db.query.mockImplementationOnce(async () => ({ rows: [{ column_name: 'date' }] }));
    // Second call: actual schedules query
    db.query.mockImplementationOnce(async (sql) => {
      expect(sql).toContain('JOIN teachers t ON ca.teacher_id = t.id AND t.status = 1');
      expect(sql).toContain('JOIN students s ON ca.student_id = s.id AND s.status = 1');
      return { rows: [] };
    });

    const req = { query: {} };
    const res = mockRes();
    await adminController.getSchedules(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('adminController.getSchedulesGrid returns per-record rows with student_id mapping', async () => {
    // Column discovery
    db.query
      .mockImplementationOnce(async () => ({ rows: [{ column_name: 'date' }] })) // date col
      .mockImplementationOnce(async () => ({ rows: [] })) // teacher status col
      .mockImplementationOnce(async () => ({ rows: [] })) // student status col
      .mockImplementationOnce(async (sql, params) => ({
        rows: [
          { id: 70, student_id: 1, student_name: '学生1', teacher_id: 2, teacher_name: '老师A', schedule_type: '入户', date: '2025-11-03', start_time: '09:00', end_time: '10:30', location: '第一教室', status: 'confirmed' }
        ]
      }));

    const req = { query: { start_date: '2025-11-01', end_date: '2025-11-07' } };
    const res = mockRes();
    await adminController.getSchedulesGrid(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].student_id).toBe(1);
    expect(res.body[0].id).toBe(70);
  });

  test('teacherController.updateProfile rejects invalid status value', async () => {
    const req = { user: { id: 10 }, body: { name: 'A', profession: '', contact: '', work_location: '', home_address: '', status: 2 } };
    const res = mockRes();
    await teacherController.updateProfile(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('studentController.updateProfile updates status when valid', async () => {
    db.query.mockImplementation(async (sql) => {
      if (String(sql).includes('UPDATE students')) {
        // 返回更新后的行
        return { rows: [{ id: 7, username: 'stu', name: 'B', profession: '', contact: '', visit_location: '', home_address: '', status: -1 }] };
      }
      return { rows: [] };
    });
    const req = { user: { id: 7 }, body: { name: 'B', profession: '', contact: '', visit_location: '', home_address: '', status: -1 } };
    const res = mockRes();
    await studentController.updateProfile(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.status).toBe(-1);
  });
});
