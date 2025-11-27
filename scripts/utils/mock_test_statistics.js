const path = require('path');
const dbPath = path.resolve(__dirname, '../src/server/db/db.js');

const mockDb = {
  query: async (text, params) => {
    // 如果是按类型统计
    if (String(text).includes('JOIN schedule_types')) {
      return { rows: [ { type: '试听', count: 3 }, { type: '正式课', count: 5 } ] };
    }
    // 如果是 monthly stats
    if (String(text).includes("DATE_TRUNC('month'")) {
      return { rows: [ { month: '2025-10-01T00:00:00.000Z', count: 4 }, { month: '2025-11-01T00:00:00.000Z', count: 6 } ] };
    }
    return { rows: [] };
  }
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb };
const teacherController = require('../src/server/controllers/teacherController');

const req = { user: { id: 42 }, query: { startDate: '2025-10-01', endDate: '2025-11-30' } };
const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(obj) { this.body = obj; console.log('统计响应:', JSON.stringify(obj, null, 2)); } };

(async ()=>{
  await teacherController.getStatistics(req, res);
  console.log('完成，状态码', res.statusCode);
})();
