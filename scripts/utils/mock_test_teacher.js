// 简单的无依赖测试脚本，用于验证 teacherController.getSchedules 在被注入 mock db 时的行为
const path = require('path');

// 目标模块路径
const dbPath = path.resolve(__dirname, '../src/server/db/db.js');
// 创建一个简单的 mock db
const mockDb = {
  query: async (text, params) => {
    // 模拟根据查询返回不同的数据
    if (String(text).includes('FROM course_arrangement')) {
      return { rows: [
        { id: 1, date: params[1], start_time: '09:00', end_time: '10:00', status: 'pending', teacher_id: params[0], location: '教室 A', student_name: '学生甲', schedule_type: '试听' },
        { id: 2, date: params[1], start_time: '14:00', end_time: '15:00', status: 'confirmed', teacher_id: params[0], location: '教室 B', student_name: '学生乙', schedule_type: '正式课' }
      ] };
    }
    // 默认返回空
    return { rows: [] };
  }
};

// 将 mock 注入 require cache
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: mockDb
};

// Mock process.env for offline mode testing
process.env.OFFLINE_DEV = 'false'; // 默认关闭离线模式

// 现在加载 controller
const teacherController = require('../src/server/controllers/teacherController');

// 构造 mock req/res
const req = {
  user: { id: 42 },
  query: { startDate: '2025-11-03', endDate: '2025-11-09' }
};

const res = {
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(obj) { this.body = obj; console.log('响应 body:', JSON.stringify(obj, null, 2)); }
};

(async () => {
  try {
    // 测试 getSchedules 接口
    console.log('\n=== 测试 getSchedules 接口 ===');
    await teacherController.getSchedules(req, res);
    console.log('✓ getSchedules 接口测试完成');

    // 测试离线模式下的 getDetailedSchedules 接口
    console.log('\n=== 测试离线模式下的 getDetailedSchedules 接口 ===');
    process.env.OFFLINE_DEV = 'true'; // 开启离线模式
    const mockDetailedReq = {
        query: {
            startDate: '2023-05-01',
            endDate: '2023-05-31'
        },
        user: {
            id: 1
        }
    };
    
    const mockDetailedRes = {
        json: (data) => {
            console.log('离线模式返回的数据:', JSON.stringify(data, null, 2));
            // 验证返回的数据结构
            if (Array.isArray(data) && data.length > 0) {
                console.log('✓ 离线模式数据结构正确');
            } else {
                console.log('✗ 离线模式数据结构不正确');
            }
        },
        status: function(code) {
            this.statusCode = code;
            return this;
        }
    };
    
    await teacherController.getDetailedSchedules(mockDetailedReq, mockDetailedRes);
    console.log('✓ 离线模式 getDetailedSchedules 接口测试完成');
    
    // 恢复环境变量
    process.env.OFFLINE_DEV = 'false';

    // 结束测试
    console.log('\n=== 所有测试完成 ===');
  } catch (e) {
    console.error('测试运行出错:', e);
    process.exit(1);
  }
})();
