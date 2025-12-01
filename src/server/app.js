const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { errorHandler } = require('./middleware/validation');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../public')));

// 路由
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const scheduleRoutes = require('./routes/schedule');
const userRoutes = require('./routes/users');
const healthRoutes = require('./routes/health');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/health', healthRoutes);

// 添加仪表盘页面路由
// 管理员仪表盘
app.get(['/admin/dashboard', '/admin/dashboard.html', '/admin/'], (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/dashboard.html'));
});

// 教师仪表盘
app.get(['/teacher/dashboard', '/teacher/dashboard.html', '/teacher/'], (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/teacher/dashboard.html'));
});

// 学生仪表盘
app.get(['/student/dashboard', '/student/dashboard.html', '/student/'], (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/student/dashboard.html'));
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);

    // 启动自动完成排课任务（每5分钟执行一次）
    const runAutoComplete = require('./scripts/run-auto-complete-schedules');
    setInterval(() => {
        runAutoComplete().catch(err => console.error('Auto-complete task failed:', err));
    }, 5 * 60 * 1000);
    // 启动时立即执行一次
    runAutoComplete().catch(err => console.error('Initial auto-complete task failed:', err));
});
