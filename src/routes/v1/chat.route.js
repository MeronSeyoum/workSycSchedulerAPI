const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chat/chat.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');
const { chatValidation } = require('../../validations');

// Apply authentication to all chat routes
router.use(authVerify);

// Chat routes
router.get('/employees', chatController.getEmployees);
router.get('/conversations', validate(chatValidation.getConversations), chatController.getConversations);
router.get('/messages/:userId', validate(chatValidation.getMessages), chatController.getMessages);
router.get('/broadcast', chatController.getBroadcastMessages);
router.post('/send', validate(chatValidation.sendMessage), chatController.sendMessage);
router.post('/mark-read', validate(chatValidation.markAsRead), chatController.markAsRead);
router.get('/unread-count', chatController.getUnreadCount);

module.exports = router;