const express = require('express');
const { authVerify } = require('../../middlewares/auth');
const dashboardController = require('../../controllers/dashboard/employeeDashboard.controller');

const router = express.Router();

// Updated routes with consistent naming
router.get('/stats', authVerify, dashboardController.getDashboardStats);
router.get('/:id/profile', authVerify, dashboardController.getEmployeeProfile); // Changed from employeeProfile
router.get('/today-shifts', authVerify, dashboardController.getTodaysShifts);

module.exports = router;