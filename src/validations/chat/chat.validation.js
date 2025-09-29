const Joi = require('joi');

const sendMessage = {
  body: Joi.object().keys({
    content: Joi.string().trim().min(1).max(1000).required().messages({
      'string.empty': 'Message content cannot be empty',
      'string.max': 'Message cannot exceed 1000 characters'
    }),
    recipient_id: Joi.when('chat_type', {
      is: 'direct',
      then: Joi.number().integer().positive().required(),
      otherwise: Joi.number().integer().positive().optional()
    }),
    chat_type: Joi.string().valid('direct', 'broadcast', 'group').default('direct'),
    shift_id: Joi.number().integer().positive().optional()
  })
};

const getMessages = {
  params: Joi.object().keys({
    userId: Joi.number().integer().positive().required()
  }),
  query: Joi.object().keys({
    limit: Joi.number().integer().positive().max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
  })
};

const markAsRead = {
  body: Joi.object().keys({
    messageIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
    senderId: Joi.number().integer().positive().required()
  })
};

const getConversations = {
  query: Joi.object().keys({
    limit: Joi.number().integer().positive().max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  })
};

module.exports = {
  sendMessage,
  getMessages,
  markAsRead,
  getConversations
};