const Joi = require('joi');

// Base complaint fields
const baseComplaintFields = {
  photoId: Joi.string().uuid().required(),
  clientId: Joi.string().uuid().required(),
  reason: Joi.string().valid(
    'poor_quality',
    'task_incomplete',
    'wrong_location',
    'safety_concern',
    'other'
  ).required(),
  description: Joi.string().required().min(10).max(1000)
};

// Create validation
const create = {
  body: Joi.object({
    ...baseComplaintFields
  })
};

// Update status validation
const updateStatus = {
  body: Joi.object({
    status: Joi.string().valid('filed', 'under_review', 'resolved', 'dismissed').required(),
    resolutionNote: Joi.string().optional().allow('')
  }),
  params: Joi.object({
    id: Joi.string().uuid().required()
  })
};

// Get complaints validation
const getComplaints = {
  query: Joi.object({
    status: Joi.string().valid('filed', 'under_review', 'resolved', 'dismissed').optional(),
    clientId: Joi.string().uuid().optional(),
    photoId: Joi.string().uuid().optional()
  })
};

// ID validation
const byId = {
  params: Joi.object({
    id: Joi.string().uuid().required()
  })
};

module.exports = { create, updateStatus, getComplaints, byId };