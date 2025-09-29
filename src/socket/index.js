const { Chat, User, Employee } = require('../models');
const jwt = require('jsonwebtoken');

const initSocket = (io) => {
  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user with employee details
      const user = await User.findByPk(decoded.id, {
        include: [{
          model: Employee,
          as: 'employee',
          attributes: ['employee_code', 'position', 'status']
        }],
        attributes: { exclude: ['password'] }
      });
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.first_name} ${socket.user.last_name} (${socket.id})`);
    
    const userId = socket.userId;
    
    // Join user to their personal room
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined personal room`);

    // Handle user explicitly joining their room (for notifications)
    socket.on('joinUser', (userIdFromClient) => {
      if (userIdFromClient == userId) {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} explicitly joined their room`);
      }
    });

    // Handle joining conversation room
    socket.on('joinConversation', (otherUserId) => {
      if (!otherUserId || otherUserId == userId) return;
      
      const roomName = `conversation_${Math.min(userId, otherUserId)}_${Math.max(userId, otherUserId)}`;
      socket.join(roomName);
      console.log(`User ${userId} joined conversation with ${otherUserId}`);
    });

    // Handle leaving conversation room
    socket.on('leaveConversation', (otherUserId) => {
      if (!otherUserId || otherUserId == userId) return;
      
      const roomName = `conversation_${Math.min(userId, otherUserId)}_${Math.max(userId, otherUserId)}`;
      socket.leave(roomName);
      console.log(`User ${userId} left conversation with ${otherUserId}`);
    });

    // Handle sending message - FIXED VERSION
    socket.on('sendMessage', async (data) => {
      try {
        const { content, recipient_id, chat_type = 'direct' } = data;
        
        console.log('Received message via socket:', { content, recipient_id, chat_type, sender_id: userId });
        
        // Validate message content
        if (!content || !content.trim()) {
          socket.emit('messageError', { error: 'Message content is required' });
          return;
        }

        // Validate recipient for direct messages
        if (chat_type === 'direct' && !recipient_id) {
          socket.emit('messageError', { error: 'Recipient is required for direct messages' });
          return;
        }

        // Create message in database - FIXED: Use proper field names
        const message = await Chat.create({
          content: content.trim(),
          sender_id: userId,
          recipient_id: chat_type === 'direct' ? recipient_id : null,
          chat_type,
          read: chat_type !== 'direct' // Broadcast messages are marked as read by default
        });

        console.log('Message created in database:', message.id);

        // Fetch message with sender and recipient details
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

        console.log('Message with details fetched:', messageWithDetails.id);

        if (chat_type === 'direct') {
          // Send to conversation room
          const roomName = `conversation_${Math.min(userId, recipient_id)}_${Math.max(userId, recipient_id)}`;
          io.to(roomName).emit('newMessage', messageWithDetails);
          console.log(`Sent message to room: ${roomName}`);
          
          // Send notification to recipient's personal room
          io.to(`user_${recipient_id}`).emit('newMessageNotification', {
            message: messageWithDetails,
            unreadCount: await getUnreadCount(recipient_id)
          });
          console.log(`Sent notification to user: ${recipient_id}`);
        } else if (chat_type === 'broadcast') {
          // Send broadcast message to all connected users
          io.emit('newBroadcastMessage', messageWithDetails);
          console.log('Sent broadcast message to all users');
        }

        // Confirm message sent to sender
        socket.emit('messageSent', messageWithDetails);
        console.log('Confirmed message sent to sender');

      } catch (error) {
        console.error('Error sending message via socket:', error);
        socket.emit('messageError', { error: 'Failed to send message: ' + error.message });
      }
    });

    // Handle marking messages as read
    socket.on('markAsRead', async (data) => {
      try {
        const { messageIds, senderId } = data;
        
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
          return;
        }

        // Update messages as read
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

        if (updatedCount > 0) {
          // Notify sender that their messages were read
          io.to(`user_${senderId}`).emit('messagesReadByRecipient', {
            messageIds,
            readBy: userId,
            readAt: new Date()
          });

          // Confirm to the reader
          socket.emit('messagesRead', { messageIds, count: updatedCount });
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('messageError', { error: 'Failed to mark messages as read' });
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      const { recipient_id, isTyping } = data;
      if (recipient_id && recipient_id !== userId) {
        const roomName = `conversation_${Math.min(userId, recipient_id)}_${Math.max(userId, recipient_id)}`;
        socket.to(roomName).emit('userTyping', {
          userId,
          user: socket.user,
          isTyping
        });
      }
    });

    // Handle user status updates
    socket.on('updateStatus', (status) => {
      socket.broadcast.emit('userStatusUpdate', {
        userId,
        status,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.user.first_name} ${socket.user.last_name} (${socket.id}) - Reason: ${reason}`);
      
      // Broadcast user offline status
      socket.broadcast.emit('userStatusUpdate', {
        userId,
        status: 'offline',
        timestamp: new Date()
      });
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });

    // Send initial connection confirmation
    socket.emit('connected', {
      message: 'Successfully connected to chat',
      user: socket.user,
      timestamp: new Date()
    });
  });

  // Handle Socket.IO server errors
  io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection error:', err);
  });
};

// Helper function to get unread count
async function getUnreadCount(userId) {
  return await Chat.count({
    where: {
      recipient_id: userId,
      read: false,
      chat_type: 'direct'
    }
  });
}

module.exports = { initSocket };