const express = require('express');
const { attendanceValidation } = require('../../validations');
const attendanceController = require('../../controllers/attendance/attendance.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

// Add this new route for recent attendance

router.get(
  '/recent',
  authVerify,
  validate(attendanceValidation.getRecentAttendance),
  attendanceController.getRecentAttendance
);

// Keep your existing routes
router.post('/clock-in', authVerify, validate(attendanceValidation.clockIn), attendanceController.clockIn);

router.post('/clock-out', authVerify, validate(attendanceValidation.clockOut), attendanceController.clockOut);

router.post('/manual', authVerify, validate(attendanceValidation.manualEntry), attendanceController.createManualEntry);

router.get('/', authVerify, validate(attendanceValidation.getAttendance), attendanceController.getAttendance);

router.get('/summary', authVerify, validate(attendanceValidation.getAttendance), attendanceController.getAttendanceSummary);

router.get(
  '/chart',
  authVerify,
  validate(attendanceValidation.getAttendanceChartData),
  attendanceController.fetchAttendanceChartData
);

module.exports = router;
