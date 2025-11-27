// 性能优化版本：减少DOM操作，添加表单验证，优化错误处理

// 预缓存DOM元素以减少重复查询
const domElements = {
    loginBtn: null,
    username: null,
    password: null,
    userType: null,
    loginError: null,
    loginForm: null
};

// 初始化DOM元素缓存
function initDomCache() {
    domElements.loginBtn = document.getElementById('loginBtn');
    domElements.username = document.getElementById('username');
    domElements.password = document.getElementById('password');
    domElements.userType = document.getElementById('userType');
    domElements.loginForm = document.querySelector('.login-form');

    // 预先创建错误元素
    domElements.loginError = document.createElement('div');
    domElements.loginError.id = 'loginError';
    domElements.loginError.style.color = 'red';
    domElements.loginError.style.marginTop = '10px';
    domElements.loginError.style.textAlign = 'center';
    domElements.loginError.style.display = 'none';
    domElements.loginForm.appendChild(domElements.loginError);
}

// 显示错误信息的函数
function showError(message) {
    domElements.loginError.textContent = message;
    domElements.loginError.style.display = 'block';
}

// 隐藏错误信息
function hideError() {
    domElements.loginError.style.display = 'none';
}

// 表单验证
function validateForm(username, password) {
    if (!username.trim()) {
        showError('请输入用户名');
        domElements.username.focus();
        return false;
    }
    if (!password.trim()) {
        showError('请输入密码');
        domElements.password.focus();
        return false;
    }
    return true;
}

// 安全解析响应JSON
async function safeJson(resp) {
    try {
        const text = await resp.text();
        if (!text || text.trim() === '') return null;
        return JSON.parse(text);
    } catch (e) {
        console.warn('响应解析为JSON失败:', e?.message || e);
        return null;
    }
}

// 登录函数
async function handleLogin(e) {
    e.preventDefault();

    const username = domElements.username.value;
    const password = domElements.password.value;
    const userType = domElements.userType.value;

    // 隐藏之前的错误信息
    hideError();

    // 表单验证
    if (!validateForm(username, password)) {
        return;
    }

    try {
        // 显示加载状态 - 减少DOM查询
        const originalText = domElements.loginBtn.textContent;
        domElements.loginBtn.textContent = '登录中...';
        domElements.loginBtn.disabled = true;

        // 使用AbortController添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, userType }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await safeJson(response);

        if (response.ok) {
            // 保存数据到本地存储
            localStorage.setItem('token', data.token);
            localStorage.setItem('userType', userType);
            localStorage.setItem('userData', JSON.stringify(data.user));

            // 如果是教师登录，更新页面右上角的教师姓名显示
            if (userType === 'teacher') {
                const teacherNameElement = document.getElementById('teacherName');
                if (teacherNameElement) {
                    const name = data.user.name || data.user.username || '教师';
                    teacherNameElement.textContent = name;
                }
            }

            // 减少DOM操作，直接使用对象映射进行重定向
            const redirectMap = {
                'admin': '/admin/dashboard',
                'teacher': '/teacher/dashboard',
                'student': '/student/dashboard'
            };
            window.location.href = redirectMap[userType] || '/index.html';
        } else {
            // 恢复按钮状态
            domElements.loginBtn.textContent = originalText;
            domElements.loginBtn.disabled = false;
            const msg = (data && data.message) ? data.message : '登录失败，请检查用户名和密码';
            showError(msg);
        }
    } catch (error) {
        console.error('登录错误:', error);
        // 恢复按钮状态
        domElements.loginBtn.textContent = '登录';
        domElements.loginBtn.disabled = false;

        // 错误处理优化
        if (error.name === 'AbortError') {
            showError('登录请求超时，请检查网络连接');
        } else {
            showError('登录过程中发生错误，请稍后重试');
        }
    }
}

// 页面加载完成后执行
function init() {
    // 缓存DOM元素
    initDomCache();

    // 添加事件监听
    domElements.loginBtn.addEventListener('click', handleLogin);

    // 添加键盘事件支持
    domElements.loginForm.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });

    // 初始化自定义下拉菜单
    setupCustomDropdown();
}

// 自定义下拉菜单逻辑
function setupCustomDropdown() {
    const wrapper = document.querySelector('.custom-select-wrapper');
    const trigger = document.querySelector('.custom-select-trigger');
    const options = document.querySelectorAll('.custom-option');
    const hiddenSelect = document.getElementById('userType');
    const triggerText = document.getElementById('customSelectText');

    if (!wrapper || !trigger || !hiddenSelect) return;

    // 切换下拉菜单显示
    trigger.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止冒泡触发document点击
        wrapper.classList.toggle('open');
    });

    // 选项点击处理
    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();

            // 更新选中状态样式
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // 更新显示文本和隐藏select的值
            const value = option.dataset.value;
            const text = option.textContent;

            hiddenSelect.value = value;
            triggerText.textContent = text;

            // 关闭下拉菜单
            wrapper.classList.remove('open');
        });
    });

    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
        }
    });
}

// 使用更轻量的DOM加载检测方式
document.addEventListener('DOMContentLoaded', init);

// 添加性能监控
if ('performance' in window && 'mark' in window.performance) {
    performance.mark('main-js-loaded');
}