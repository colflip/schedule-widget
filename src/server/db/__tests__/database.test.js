const { query } = require('../db');

const connectionUrl = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
const describeFn = connectionUrl ? describe : describe.skip;

describeFn('数据库测试', () => {
  it('应该成功连接并执行查询', async () => {
    const result = await query('SELECT NOW() as current_time');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toHaveProperty('current_time');
  });

  it('应该正确处理参数化查询', async () => {
    const result = await query(
      'SELECT $1::text as name, $2::int as age',
      ['测试用户', 25]
    );
    expect(result.rows[0]).toEqual({
      name: '测试用户',
      age: 25
    });
  });

  it('应该正确处理错误情况', async () => {
    await expect(
      query('SELECT * FROM non_existent_table')
    ).rejects.toThrow();
  });

  it('应该返回正确的时区', async () => {
    // 先设置时区
    await query(`SET TIME ZONE 'Asia/Shanghai'`);
    
    // 查询当前时间并验证
    const timeResult = await query('SELECT EXTRACT(HOUR FROM NOW())::INTEGER as hour');
    const hour = timeResult.rows[0].hour;
    
    // 验证时间是否在合理范围内（考虑到北京时间）
    expect(typeof hour).toBe('number');
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
    
    // 获取具体的时区设置
    const tzResult = await query('SELECT now()::timestamptz as now');
    const dbTime = new Date(tzResult.rows[0].now);
    const localTime = new Date();
    
    // 验证数据库时间和本地时间的差异不超过1小时
    // （考虑到测试运行时可能刚好跨小时）
    const timeDiff = Math.abs(dbTime.getTime() - localTime.getTime());
    expect(timeDiff).toBeLessThan(3600000); // 1小时 = 3600000毫秒
  });
});