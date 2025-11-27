const scheduleController = require('../controllers/scheduleController');

jest.mock('../db/db', () => {
  return {
    query: jest.fn(async (sql, params) => {
      return { rows: [], rowCount: 0 };
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

describe('scheduleController', () => {
  test('confirmAdmin 更新 course_arrangement 状态', async () => {
    const req = { params: { scheduleId: 123 } };
    const res = mockRes();
    await scheduleController.confirmAdmin(req, res);
    expect(db.query).toHaveBeenCalled();
    const [sql] = db.query.mock.calls[0];
    expect(String(sql)).toContain('course_arrangement');
    expect(res.body).toEqual({ success: true });
  });
});
