const Joi = require('joi');

const createShiftWithEmployees = {
  body: Joi.object({
    client_id: Joi.number().integer().required(),
    date: Joi.date().iso().required(),
    start_time: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    end_time: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    shift_type: Joi.string().valid('regular', 'emergency').default('regular'),
    employee_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
    notes: Joi.string().allow('').optional(),
    status: Joi.string().allow('').optional()

  })
};

const updateShift = {
  body: Joi.object({
    start_time: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    end_time: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    status: Joi.string().valid('scheduled', 'completed', 'missed', 'draft').optional(),
    notes: Joi.string().allow('').optional()

  })
};

module.exports = {
  createShiftWithEmployees,
  updateShift
};