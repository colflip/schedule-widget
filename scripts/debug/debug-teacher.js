const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false }); // 使用非无头模式以便观察
  const page = await browser.newPage();

  // 设置视口大小
  await page.setViewport({ width: 1920, height: 1080 });

  // 在访问页面之前设置身份验证信息
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('userType', 'teacher');
    localStorage.setItem('userData', JSON.stringify({
      id: 1,
      name: 'Test Teacher',
      username: 'teacher1'
    }));
  });

  // 启用控制台输出
  page.on('console', msg => console.log('Console:', msg.text()));
  
  // 监听页面错误
  page.on('pageerror', error => console.log('Page Error:', error.message));
  
  // 监听请求失败
  page.on('requestfailed', request => 
    console.log('Request Failed:', request.url(), request.failure().errorText)
  );
  
  // 监听响应
  page.on('response', response => {
    if (!response.ok()) {
      console.log('Response Error:', response.status(), response.url());
    }
  });

  console.log('Navigating to teacher dashboard...');
  // 导航到教师仪表板
  await page.goto('http://localhost:3001/teacher/dashboard', { waitUntil: 'networkidle0' });
  
  console.log('Page loaded. Checking for elements...');
  
  // 等待页面加载完成
    await page.waitForSelector('body', { timeout: 10000 });

    // 再等待一段时间确保JavaScript模块加载完成
    await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 检查页面元素和JavaScript状态
  const debugInfo = await page.evaluate(() => {
    // 检查基本元素
    const navMenu = document.querySelector('.nav-menu');
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    
    // 检查JavaScript变量和函数
    const hasWindow = typeof window !== 'undefined';
    const hasInitDashboard = typeof window.initDashboard === 'function';
    const hasDocumentReadyState = document.readyState;
    
    // 检查是否有认证信息
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    
    return {
      hasNavMenu: !!navMenu,
      navItemCount: navItems.length,
      hasWindow,
      hasInitDashboard,
      documentReadyState: hasDocumentReadyState,
      token: !!token,
      userType: userType || 'none'
    };
  });
  
  console.log('Debug Info:', debugInfo);
  
  // 尝试手动调用initDashboard函数
  console.log('Attempting to manually call initDashboard...');
  try {
    // 首先尝试直接调用
    const result = await page.evaluate(() => {
      if (typeof window.initDashboard === 'function') {
        return { success: true, message: 'Function found in window object' };
      }
      return { success: false, message: 'Function not found in window object' };
    });
    
    console.log('Initial check:', result);
    
    // 如果没有找到，尝试其他方法
    if (!result.success) {
      // 尝试通过页面脚本添加函数到全局作用域
      await page.evaluate(() => {
        // 这里我们尝试获取模块导出的函数
        // 注意：在实际浏览器环境中，我们无法直接访问模块导出
        // 这只是一个示例
        console.log('Attempting to access module exports...');
      });
    }
    
    // 最后尝试调用函数
    await page.evaluate(async () => {
      if (typeof window.initDashboard === 'function') {
        try {
          await window.initDashboard();
          return { success: true, message: 'Function called successfully' };
        } catch (error) {
          return { success: false, message: `Function call failed: ${error.message}` };
        }
      } else {
        return { success: false, message: 'initDashboard function not found' };
      }
    }).then(result => {
      console.log('Manual initDashboard call result:', result);
    });
  } catch (error) {
    console.log('Manual initDashboard call failed:', error.message);
  }
  
  // 保持浏览器打开一段时间以便观察
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  await browser.close();
  console.log('Debugging complete.');
})();