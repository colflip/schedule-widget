const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Listen for console events
  page.on('console', msg => console.log('Console:', msg.text()));
  
  // Listen for page errors
  page.on('pageerror', error => console.log('Page Error:', error.message));
  
  // Listen for request failures
  page.on('requestfailed', request => 
    console.log('Request Failed:', request.url(), request.failure().errorText)
  );

  // Navigate to teacher dashboard
  await page.goto('http://localhost:3001/teacher/dashboard');
  
  // Wait for a bit to allow scripts to load
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check if there are any JavaScript errors
  const errors = await page.evaluate(() => {
    // Check if the initDashboard function exists
    const initDashboardExists = typeof window.initDashboard !== 'undefined';
    
    // Check if event listeners are attached
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const navItemsWithListeners = Array.from(navItems).filter(item => {
      // This is a simplified check - in reality, we'd need to check the event listener list
      return item.hasAttribute('data-section');
    });
    
    return {
      initDashboardExists,
      navItemCount: navItems.length,
      navItemsWithListeners: navItemsWithListeners.length
    };
  });
  
  console.log('JavaScript Analysis:', errors);
  
  await browser.close();
})();