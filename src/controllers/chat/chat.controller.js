const { Chat, User, Employee } = require('../../models');
const { Op } = require('sequelize');

exports.getEmployees = async (req, res) => {
  try {
    const employees = await User.findAll({
      where: {
        role: ['employee', 'manager']
      },
      include: [{
        model: Employee,
        as: 'employee',
        attributes: ['employee_code', 'position', 'status']
      }],
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'status'],
      order: [['first_name', 'ASC']]
    });

    if (!employees || employees.length === 0) {
      return res.status(404).json({ message: 'No employees found' });
    }

    const formatted = employees.map(user => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      status: user.status,
      employee: user.employee ? {
        employee_code: user.employee.employee_code,
        position: user.employee.position,
        status: user.employee.status
      } : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching employees for chat:', error);
    res.status(500).json({
      message: 'Failed to retrieve employees',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const conversations = await Chat.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { recipient_id: userId }
        ],
        chat_type: 'direct'
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          include: [{
            model: Employee,
            as: 'employee',
            attributes: ['employee_code', 'position', 'status']
          }]
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          include: [{
            model: Employee,
            as: 'employee',
            attributes: ['employee_code', 'position', 'status']
          }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    if (!conversations || conversations.length === 0) {
      return res.json([]);
    }

    const conversationMap = new Map();
    
    conversations.forEach(chat => {
      const otherUserId = chat.sender_id === userId ? chat.recipient_id : chat.sender_id;
      const otherUser = chat.sender_id === userId ? chat.recipient : chat.sender;
      
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          user: otherUser,
          lastMessage: chat.content,
          timestamp: chat.created_at,
          unread: chat.read === false && chat.recipient_id === userId
        });
      }
    });

    const formattedConversations = Array.from(conversationMap.values());

    res.json(formattedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      message: 'Failed to retrieve conversations',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = parseInt(req.params.userId);
    
    if (isNaN(otherUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
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
          attributes: ['id', 'first_name', 'last_name', 'email'],
          include: [{
            model: Employee,
            as: 'employee',
            attributes: ['employee_code', 'position']
          }]
        }
      ],
      order: [['created_at', 'ASC']]
    });

    // Mark received messages as read
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

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      message: 'Failed to retrieve messages',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

exports.getBroadcastMessages = async (req, res) => {
  try {
    const messages = await Chat.findAll({
      where: {
        chat_type: 'broadcast'
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          include: [{
            model: Employee,
            as: 'employee',
            attributes: ['employee_code', 'position']
          }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching broadcast messages:', error);
    res.status(500).json({
      message: 'Failed to retrieve broadcast messages',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { content, recipient_id, chat_type = 'direct' } = req.body;
    const sender_id = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    if (chat_type === 'direct' && !recipient_id) {
      return res.status(400).json({ message: 'Recipient is required for direct messages' });
    }

    const message = await Chat.create({
      content: content.trim(),
      sender_id,
      recipient_id: chat_type === 'direct' ? recipient_id : null,
      chat_type,
      read: chat_type !== 'direct'
    });

    const messageWithDetails = await Chat.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          include: [{
            model: Employee,
            as: 'employee',
            attributes: ['employee_code', 'position']
          }]
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          include: [{
            model: Employee,
            as: 'employee',
            attributes: ['employee_code', 'position']
          }]
        }
      ]
    });

    // Emit socket event
    if (req.app.get('io')) {
      const io = req.app.get('io');
      
      if (chat_type === 'direct') {
        const roomName = `conversation_${Math.min(sender_id, recipient_id)}_${Math.max(sender_id, recipient_id)}`;
        io.to(roomName).emit('newMessage', messageWithDetails);
        
        io.to(`user_${recipient_id}`).emit('newMessageNotification', {
          message: messageWithDetails,
          unreadCount: await getUnreadCount(recipient_id)
        });
      } else if (chat_type === 'broadcast') {
        io.emit('newBroadcastMessage', messageWithDetails);
      }
    }

    res.status(201).json(messageWithDetails);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      message: 'Failed to send message',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const count = await Chat.count({
      where: {
        recipient_id: userId,
        read: false,
        chat_type: 'direct'
      }
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      message: 'Failed to retrieve unread count',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { messageIds, senderId } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ message: 'Message IDs are required' });
    }

    const [updatedCount] = await Chat.update(
      { read: true, read_at: new Date() },
      {
        where: {
          id: messageIds,
          sender_id: senderId,
          recipient_id: userId,
          read: false
        }
      }
    );

    // Notify sender via socket
    if (req.app.get('io') && updatedCount > 0) {
      req.app.get('io').to(`user_${senderId}`).emit('messagesReadByRecipient', {
        messageIds,
        readBy: userId,
        readAt: new Date()
      });
    }

    res.json({ updatedCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      message: 'Failed to mark messages as read',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

// Helper function
async function getUnreadCount(userId) {
  return await Chat.count({
    where: {
      recipient_id: userId,
      read: false,
      chat_type: 'direct'
    }
  });
}