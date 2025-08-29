// socket/index.js
const { Chat, User, Employee } = require('../models');
const { authenticateToken } = require('../middlewares/auth');

const initSocket = (io) => {
  // Socket.io authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    // Mock request object for authentication
    const mockReq = { headers: { authorization: `Bearer ${token}` } };
    const mockRes = {};
    
    authenticateToken(mockReq, mockRes, (err) => {
      if (err) return next(new Error('Authentication error'));
      socket.request.user = mockReq.user;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    const userId = socket.request.user.id;
    socket.join(`user_${userId}`);

    // Handle joining conversation
    socket.on('joinConversation', (otherUserId) => {
      const roomName = `conversation_${Math.min(userId, otherUserId)}_${Math.max(userId, otherUserId)}`;
      socket.join(roomName);
    });

    // Handle leaving conversation
    socket.on('leaveConversation', (otherUserId) => {
      const roomName = `conversation_${Math.min(userId, otherUserId)}_${Math.max(userId, otherUserId)}`;
      socket.leave(roomName);
    });

    // Handle sending message
    socket.on('sendMessage', async (data) => {
      try {
        const { content, recipient_id, chat_type = 'direct' } = data;
        
        const message = await Chat.create({
          content: content.trim(),
          sender_id: userId,
          recipient_id: chat_type === 'direct' ? recipient_id : null,
          chat_type,
          read: chat_type !== 'direct'
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

        if (chat_type === 'direct') {
          // Send to both users in the conversation
          const roomName = `conversation_${Math.min(userId, recipient_id)}_${Math.max(userId, recipient_id)}`;
          io.to(roomName).emit('newMessage', messageWithSender);
          
          // Also send to individual user rooms for notifications
          io.to(`user_${recipient_id}`).emit('newMessageNotification', messageWithSender);
        } else {
          // Broadcast to all connected users
          io.emit('newBroadcastMessage', messageWithSender);
        }
      } catch (error) {
        console.error('Error sending message via socket:', error);
        socket.emit('messageError', { error: 'Failed to send message' });
      }
    });

    // Handle message read
    socket.on('markAsRead', async (data) => {
      try {
        const { messageIds, senderId } = data;
        
        await Chat.update(
          { read: true, read_at: new Date() },
          {
            where: {
              id: messageIds,
              sender_id: senderId,
              recipient_id: userId
            }
          }
        );

        socket.emit('messagesRead', { messageIds });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = { initSocket };