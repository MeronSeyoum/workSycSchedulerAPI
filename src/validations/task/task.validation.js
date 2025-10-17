const Joi = require('joi');

// Base task fields
const baseTaskFields = {
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().optional().allow(''),
  category: Joi.string().required(),
  estimated_time_minutes: Joi.number().integer().min(1).optional(),
  requires_photo: Joi.boolean().default(true),
  sample_photo_url: Joi.string().uri().optional().allow(''),
  instructions: Joi.string().optional().allow(''),
  client_specific: Joi.boolean().default(false),
  client_id: Joi.number().integer().optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  tags: Joi.array().items(Joi.string()).default([])
};

// Create validation
const create = {
  body: Joi.object({
    ...baseTaskFields
  })
};

// Update validation
const update = {
  body: Joi.object({
    ...baseTaskFields,
    status: Joi.string().valid('active', 'inactive', 'archived').optional()
  }),
  params: Joi.object({
    id: Joi.string().uuid().required()
  })
};

// Get tasks validation
const getTasks = {
  query: Joi.object({
    category: Joi.string().optional(),
    client_id: Joi.number().integer().optional(),
    status: Joi.string().valid('active', 'inactive', 'archived').optional(),
    requires_photo: Joi.boolean().optional(),
    client_specific: Joi.boolean().optional()
  })
};

// ID validation
const byId = {
  params: Joi.object({
    id: Joi.string().uuid().required()
  })
};

// Client ID validation
const byClientId = {
  params: Joi.object({
    clientId: Joi.number().integer().required()
  })
};

module.exports = { 
  create, 
  update, 
  getTasks, 
  byId,
  byClientId 
};