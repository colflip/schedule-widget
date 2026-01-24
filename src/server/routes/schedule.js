const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { validate, scheduleValidation } = require('../middleware/validation');
const scheduleController = require('../controllers/scheduleController');

// 获取可用教师和学生
router.get('/available/teachers', authMiddleware, adminOnly, scheduleController.getAvailableTeachers);
router.get('/available/students', authMiddleware, adminOnly, scheduleController.getAvailableStudents);

// 检查时间冲突
router.post('/check-conflicts', authMiddleware, adminOnly, scheduleController.checkScheduleConflicts);

// 创建课程安排（附加验证）
router.post('/create', authMiddleware, adminOnly, validate(scheduleValidation.create), scheduleController.createSchedule);

// 获取课程类型
router.get('/types', authMiddleware, scheduleController.getScheduleTypes);

// 排课确认
router.post('/:id/confirm/teacher', authMiddleware, scheduleController.confirmTeacher);
router.post('/:id/confirm/admin', authMiddleware, adminOnly, scheduleController.confirmAdmin);

module.exports = router;
