const adminController = require('../controllers/adminController');

jest.mock('../db/db', () => {
  return {
    query: jest.fn(async (sql, params) => {
      // 返回一个通用空结果，避免真实数据库依赖
      return { rows: [{ teacher_count: 0, student_count: 0, monthly_schedules: 0, pending_count: 0, total_schedules: 0 }], rowCount: 1 };
    })
  };
});

const db = require('../db/db');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
}

describe('adminController', () => {
  test('getOverviewStats 使用 course_arrangement 表', async () => {
    const req = { query: {} };
    const res = mockRes();
    await adminController.getOverviewStats(req, res);
    expect(db.query).toHaveBeenCalled();
    const calls = db.query.mock.calls.map(c => String(c[0]));
    expect(calls.some(sql => sql.includes('course_arrangement'))).toBe(true);
    expect(res.body).toHaveProperty('teacher_count');
  });
});
