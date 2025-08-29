const Joi = require('joi');

// Common validation schemas
const commonSchemas = {
  idParam: Joi.string().pattern(/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/).required().messages({
    'string.pattern.base': 'Invalid notification ID format',
    'any.required': 'Notification ID is required'
  }),
 userId: Joi.string().pattern(/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/).required().messages({
    'string.pattern.base': 'Invalid user ID format',
    'any.required': 'User ID is required'
  })
};

module.exports = {
  getNotifications: {
    query: Joi.object({
      userId: commonSchemas.userId,
      filter: Joi.string().valid('all', 'unread').default('all'),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0)
    }).unknown(false)
  },
  markAsRead: {
    params: Joi.object({
      id: commonSchemas.idParam
    }),
    query: Joi.object({
      userId: commonSchemas.userId
    }).unknown(false),
    body: Joi.object({}).unknown(false)
  },
  deleteNotification: {
    params: Joi.object({
      id: commonSchemas.idParam
    }),
    query: Joi.object({
      userId: commonSchemas.userId
    }).unknown(false),
    body: Joi.object({}).unknown(false)
  },
  clearAll: {
    query: Joi.object({
      userId: commonSchemas.userId,
      filter: Joi.string().valid('all', 'unread').default('all')
    }).unknown(false),
    body: Joi.object({}).unknown(false)
  }
};