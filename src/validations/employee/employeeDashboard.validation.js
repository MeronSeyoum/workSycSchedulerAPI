const Joi = require('joi');

const getWorkSummary = {
  query: Joi.object({
    startDate: Joi.date().iso().optional().messages({
      'date.format': 'Start date must be in YYYY-MM-DD format',
      'date.base': 'Start date must be a valid date'
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
      'date.format': 'End date must be in YYYY-MM-DD format',
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date'
    })
  }).with('startDate', 'endDate').messages({
    'object.with': 'Both startDate and endDate must be provided together'
  })
};

module.exports = {
  getWorkSummary
};