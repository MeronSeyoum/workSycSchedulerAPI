// routes/v1/chat.route.js
const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chat/chat.controller');
const { authVerify } = require('../../middlewares/auth');

// Apply authentication middleware to all chat routes
router.use(authVerify);

// Get all conversations for current user
router.get('/conversations', chatController.getConversations);

// Get messages between current user and another user
router.get('/messages/:userId', chatController.getMessages);

// Get broadcast messages
router.get('/broadcast', chatController.getBroadcastMessages);

// Send a message
router.post('/send', chatController.sendMessage);

// Get unread message count
router.get('/unread-count', chatController.getUnreadCount);

module.exports = router;