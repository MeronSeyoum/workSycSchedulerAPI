// controllers/chatController.js
const { Chat, User, Employee } = require('../../models');
const { Op } = require('sequelize');

const chatController = {
  // Get all conversations for current user
  getConversations: async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get unique users that the current user has chatted with
      const conversations = await Chat.findAll({
        where: {
          [Op.or]: [
            { sender_id: userId },
            { recipient_id: userId }
          ]
        },
        include: [
          {
            model: User,
            as: 'sender',
            include: [{
              model: Employee,
              as: 'employee',
              attributes: ['employee_code', 'position', 'status']
            }]
          },
          {
            model: User,
            as: 'recipient',
            include: [{
              model: Employee,
              as: 'employee',
              attributes: ['employee_code', 'position', 'status']
            }]
          }
        ],
        order: [['created_at', 'DESC']],
        group: [
          'Chat.sender_id',
          'Chat.recipient_id',
          'sender.id',
          'recipient.id'
        ]
      });

      // Process conversations to get unique users
      const uniqueUsers = new Set();
      const formattedConversations = [];

      conversations.forEach(chat => {
        const otherUser = chat.sender_id === userId ? chat.recipient : chat.sender;
        
        if (otherUser && !uniqueUsers.has(otherUser.id)) {
          uniqueUsers.add(otherUser.id);
          formattedConversations.push({
            user: otherUser,
            lastMessage: chat.content,
            timestamp: chat.created_at,
            unread: chat.read === false && chat.sender_id !== userId
          });
        }
      });

      res.json({
        success: true,
        data: formattedConversations
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching conversations',
        error: process.env.NODE_ENV === 'DEVELOPMENT' ? error.message : undefined
      });
    }
  },

  // Get messages between current user and another user
  getMessages: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const otherUserId = parseInt(req.params.userId);
      
      if (isNaN(otherUserId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }
      
      const messages = await Chat.findAll({
        where: {
          [Op.or]: [
            {
              sender_id: currentUserId,
              recipient_id: otherUserId,
              chat_type: 'direct'
            },
            {
              sender_id: otherUserId,
              recipient_id: currentUserId,
              chat_type: 'direct'
            }
          ]
        },
        include: [
          {
            model: User,
            as: 'sender',
            include: [{
              model: Employee,
              as: 'employee',
              attributes: ['employee_code', 'position']
            }]
          }
        ],
        order: [['created_at', 'ASC']]
      });

      // Mark messages as read
      await Chat.update(
        { read: true, read_at: new Date() },
        {
          where: {
            sender_id: otherUserId,
            recipient_id: currentUserId,
            read: false
          }
        }
      );

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching messages',
        error: process.env.NODE_ENV === 'DEVELOPMENT' ? error.message : undefined
      });
    }
  },

  // Get broadcast messages
  getBroadcastMessages: async (req, res) => {
    try {
      const messages = await Chat.findAll({
        where: {
          chat_type: 'broadcast'
        },
        include: [
          {
            model: User,
            as: 'sender',
            include: [{
              model: Employee,
              as: 'employee',
              attributes: ['employee_code', 'position']
            }]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 50
      });

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      console.error('Error fetching broadcast messages:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching broadcast messages',
        error: process.env.NODE_ENV === 'DEVELOPMENT' ? error.message : undefined
      });
    }
  },

  // Send a message
  sendMessage: async (req, res) => {
    try {
      const { content, recipient_id, chat_type = 'direct' } = req.body;
      const sender_id = req.user.id;

      if (!content || !content.trim()) {
        return res.status(400).json({ 
          success: false,
          message: 'Message content is required' 
        });
      }

      if (chat_type === 'direct' && !recipient_id) {
        return res.status(400).json({ 
          success: false,
          message: 'Recipient is required for direct messages' 
        });
      }

      const message = await Chat.create({
        content: content.trim(),
        sender_id,
        recipient_id: chat_type === 'direct' ? recipient_id : null,
        chat_type,
        read: chat_type !== 'direct' // Broadcast messages are marked as read by default
      });

      const messageWithSender = await Chat.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'sender',
            include: [{
              model: Employee,
              as: 'employee',
              attributes: ['employee_code', 'position']
            }]
          },
          {
            model: User,
            as: 'recipient',
            include: [{
              model: Employee,
              as: 'employee',
              attributes: ['employee_code', 'position']
            }]
          }
        ]
      });

      // Emit socket event if socket.io is available
      if (req.app.get('io')) {
        req.app.get('io').emit('newMessage', messageWithSender);
      }

      res.status(201).json({
        success: true,
        data: messageWithSender
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error sending message',
        error: process.env.NODE_ENV === 'DEVELOPMENT' ? error.message : undefined
      });
    }
  },

  // Get unread message count
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const count = await Chat.count({
        where: {
          recipient_id: userId,
          read: false,
          chat_type: 'direct'
        }
      });

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching unread count',
        error: process.env.NODE_ENV === 'DEVELOPMENT' ? error.message : undefined
      });
    }
  }
};

module.exports = chatController;