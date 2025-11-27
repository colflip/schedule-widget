const path = require('path');
const dbPath = path.resolve(__dirname, '../src/server/db/db.js');

const mockDb = {
  query: async (text, params) => {
    // 简单模拟教师可用项查询
    if (String(text).includes('FROM teacher_daily_availability') && String(text).includes('WHERE teacher_id')) {
      return { rows: [ { id:1, date: params[1] || params[2] || params[0], start_time: '08:00', end_time: '12:00', status: 'available' } ] };
    }
    // 对插入/更新返回 ok
    return { rows: [] };
  }
};
// 兼容新增的 getClient 导出
mockDb.getClient = async () => {
  return {
    query: mockDb.query,
    release: () => {}
  };
};
// 提供 runInTransaction 兼容实现（简单回退到 pool 风格）
mockDb.runInTransaction = async (workFn) => {
  // usePool = true 表示使用 mockDb.query
  const clientLike = { query: mockDb.query, release: () => {} };
  return await workFn(clientLike, true);
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb };
const teacherController = require('../src/server/controllers/teacherController');

(async ()=>{
  const reqGet = { user: { id: 42 }, query: { startDate: '2025-11-01', endDate: '2025-11-30' } };
  const resGet = { statusCode: 200, json(obj){ console.log('getAvailability 返回:', obj); } };
  await teacherController.getAvailability(reqGet, resGet);

  const reqSet = { user: { id: 42 }, body: { availabilityList: [ { date: '2025-11-05', timeSlot: 'morning', isAvailable: true } ] } };
  const resSet = { statusCode: 200, json(obj){ console.log('setAvailability 返回:', obj); } };
  await teacherController.setAvailability(reqSet, resSet);

  console.log('availability 测试完成');
})();
