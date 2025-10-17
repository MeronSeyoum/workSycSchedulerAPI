// validations/shiftPhoto.validation.js
const Joi = require('joi');

const shiftPhotoValidation = {
  getPhotos: {
    query: Joi.object().keys({
      shift_id: Joi.number().integer().optional(),
      employee_id: Joi.number().integer().optional(),
      status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
      includeComplaints: Joi.boolean().optional(),
    }),
  },

  byId: {
    params: Joi.object().keys({
      id: Joi.string().required(),
    }),
  },

  // ✅ UPDATED: Validation for file upload (FormData)
  create: {
    body: Joi.object().keys({
      shift_id: Joi.number().integer().required(),
      employee_id: Joi.number().integer().required(),
      task_name: Joi.string().optional().allow('', null),
      task_id: Joi.string().optional().allow('', null),
      description: Joi.string().optional().allow('', null),
    }),
    // Note: File validation is handled by multer middleware
  },

  updateApproval: {
    params: Joi.object().keys({
      id: Joi.string().required(),
    }),
    body: Joi.object().keys({
      manager_approval_status: Joi.string()
        .valid('pending', 'approved', 'rejected')
        .required(),
      manager_comment: Joi.string().optional().allow('', null),
    }),
  },

  bulkUpdateApproval: {
    body: Joi.object().keys({
      photo_ids: Joi.array().items(Joi.string()).min(1).required(),
      manager_approval_status: Joi.string()
        .valid('approved', 'rejected')
        .required(),
      manager_comment: Joi.string().optional().allow('', null),
    }),
  },
};

module.exports = {
  shiftPhotoValidation,
};