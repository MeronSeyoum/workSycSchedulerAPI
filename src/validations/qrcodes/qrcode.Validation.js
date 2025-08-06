const Joi = require('joi');

// Base QRCode fields
const baseQRCodeFields = {
  client_id: Joi.number().integer().required(),
  code_value: Joi.string().min(10).max(255).optional(),
  expires_at: Joi.date().greater('now').required() // Ensures expiration is in future
};

// Create validation
const create = {
  body: Joi.object({
    ...baseQRCodeFields,
    id: Joi.forbidden() // Explicitly forbid id in create
  })
};

// Update validation
const update = {
  body: Joi.object({
    client_id: Joi.forbidden(), // Client ID shouldn't be changed
    code_value: Joi.forbidden(), // Code value should be immutable
    expires_at: Joi.date().greater('now').required(),
    id: Joi.forbidden() // ID should come from URL params only
  }),
  params: Joi.object({
    id: Joi.number().integer().required() // Require ID in URL params
  })
};

// Delete validation
const remove = {
  params: Joi.object({
    id: Joi.number().integer().required()
  })
};

// Validate QR code request
const validateQR = {
  body: Joi.object({
    code_value: Joi.string().min(10).max(255).optional()
  })
};

// Get by client ID validation
const getByClient = {
  params: Joi.object({
    client_id: Joi.number().integer().required()
  })
};

module.exports = { 
  create, 
  update, 
  remove, 
  validateQR,
  getByClient
};