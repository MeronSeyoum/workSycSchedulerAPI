const express = require('express');
const { notificationValidation } = require('../../validations');
const notificationController = require('../../controllers/notification/notification.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

router.get('/', authVerify,  notificationController.getNotifications);
router.put('/:id/read', authVerify, validate(notificationValidation.markAsRead), notificationController.markAsRead);
router.delete('/:id', authVerify, validate(notificationValidation.deleteNotification), notificationController.deleteNotification);
router.delete('/', authVerify, validate(notificationValidation.clearAll), notificationController.clearAll);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management
 */

