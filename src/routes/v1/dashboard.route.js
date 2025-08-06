const express = require('express');
const { dashboardValidation } = require('../../validations');
const dashboardController = require('../../controllers/dashboard/dashboard.controller'); // Fixed path
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

// Changed from getStats to getDashboardStats to match controller
router.get('/', authVerify, dashboardController.getDashboardStats);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard statistics
 */