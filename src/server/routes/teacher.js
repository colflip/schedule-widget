const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const teacherController = require('../controllers/teacherController');

// 个人信息管理
router.get('/profile', authMiddleware, teacherController.getProfile);
router.put('/profile', authMiddleware, teacherController.updateProfile);
router.put('/password', authMiddleware, teacherController.changePassword);

// 时间安排管理
router.get('/availability', authMiddleware, teacherController.getAvailability);
router.post('/availability', authMiddleware, teacherController.setAvailability);
router.delete('/availability', authMiddleware, teacherController.deleteAvailability);

// 课程安排
router.get('/schedules', authMiddleware, teacherController.getSchedules);
router.post('/schedules/:id/confirm', authMiddleware, teacherController.confirmSchedule);
router.put('/schedules/:id/status', authMiddleware, teacherController.updateScheduleStatus);
router.patch('/schedules/:id', authMiddleware, teacherController.updateScheduleStatus);
// 总览数据
router.get('/overview', authMiddleware, teacherController.getOverview);

// 统计数据
router.get('/statistics', authMiddleware, teacherController.getStatistics);
router.get('/teaching-count', authMiddleware, teacherController.getTeachingCount);
router.get('/detailed-schedules', authMiddleware, teacherController.getDetailedSchedules);

module.exports = router;