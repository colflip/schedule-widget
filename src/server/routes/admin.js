const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { validate, scheduleValidation, userValidation } = require('../middleware/validation');
const adminController = require('../controllers/adminController');

// 用户管理路由
router.get('/users/:userType', authMiddleware, adminOnly, adminController.getUsers);
router.get('/users/:userType/:id', authMiddleware, adminOnly, adminController.getUserById);
router.post('/users', authMiddleware, adminOnly, validate(userValidation.create), adminController.createUser);
router.put('/users/:userType/:id', authMiddleware, adminOnly, validate(userValidation.update), adminController.updateUser);
router.delete('/users/:userType/:id', authMiddleware, adminOnly, adminController.deleteUser);

// 排课管理路由
router.get('/schedules', authMiddleware, adminOnly, validate(scheduleValidation.query, 'query'), adminController.getSchedules);
// 放在 :id 之前，避免被动态参数匹配到
router.get('/schedules/grid', authMiddleware, adminOnly, adminController.getSchedulesGrid);
// 仅匹配数字ID，避免 'grid' 等字符串被当作ID
router.get('/schedules/:id(\\d+)', authMiddleware, adminOnly, adminController.getScheduleById);
router.post('/schedules', authMiddleware, adminOnly, validate(scheduleValidation.create), adminController.createSchedule);
router.put('/schedules/:id', authMiddleware, adminOnly, validate(scheduleValidation.update), adminController.updateSchedule);
router.delete('/schedules/:id', authMiddleware, adminOnly, adminController.deleteSchedule);
router.post('/schedules/:id/confirm', authMiddleware, adminOnly, adminController.confirmSchedule);

// 统计数据路由
router.get('/statistics/overview', authMiddleware, adminOnly, adminController.getOverviewStats);
router.get('/statistics/schedules', authMiddleware, adminOnly, adminController.getScheduleStats);
router.get('/statistics/users', authMiddleware, adminOnly, adminController.getUserStats);

// 数据导出路由
router.get('/export/teachers', authMiddleware, adminOnly, adminController.exportTeacherData);
router.get('/export/students', authMiddleware, adminOnly, adminController.exportStudentData);

// 高级数据导出路由（支持多种导出类型和格式）
router.get('/export-advanced', authMiddleware, adminOnly, adminController.advancedExport);

module.exports = router;
